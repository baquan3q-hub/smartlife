-- =====================================================================
-- SmartLife — Public API v1 cho AI bên ngoài (Personal Access Token)
-- =====================================================================
-- Chạy file này 1 lần trong Supabase SQL Editor. Có thể chạy lại an toàn.
--
-- Thiết kế bảo mật:
--   * Không dùng Service Role Key. Vercel Function chỉ dùng ANON key.
--   * Mọi truy cập dữ liệu qua API đi qua các hàm SECURITY DEFINER
--     `api_v1_*`. Mỗi hàm nhận key gốc (sl_live_...), tự hash SHA-256
--     trong Postgres, đối chiếu bảng api_keys, kiểm tra scope + hạn dùng
--     + rate limit, rồi CHỈ đọc/ghi dữ liệu của đúng user_id đó.
--   * Hash được tính trong DB nên bản thân key_hash không thể dùng làm
--     "chìa khóa" (gửi hash lên sẽ bị hash lần nữa và không khớp).
--   * Cột key_hash không được cấp quyền SELECT cho client.
--
-- Mã lỗi: các hàm RAISE với SQLSTATE 'PTxxx' → PostgREST trả HTTP xxx.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. BẢNG api_keys
-- ---------------------------------------------------------------------
create table if not exists public.api_keys (
    id              uuid primary key default gen_random_uuid(),
    user_id         uuid not null references auth.users(id) on delete cascade,
    name            text not null check (char_length(name) between 1 and 80),
    key_prefix      text not null,              -- vd: 'sl_live_3fa9c1' (hiển thị để nhận diện)
    key_hash        text not null,              -- SHA-256 hex của toàn bộ key
    scopes          text[] not null default array['read:all'],
    is_active       boolean not null default true,
    last_used_at    timestamptz,
    expires_at      timestamptz,                -- null = không bao giờ hết hạn
    revoked_at      timestamptz,
    created_at      timestamptz not null default now(),
    -- Rate limit theo cửa sổ 1 phút
    rl_window_start timestamptz,
    rl_count        integer not null default 0
);

create unique index if not exists api_keys_key_hash_idx on public.api_keys (key_hash);
create index if not exists api_keys_user_id_idx on public.api_keys (user_id, created_at desc);

alter table public.api_keys enable row level security;

drop policy if exists "api_keys_select_own" on public.api_keys;
create policy "api_keys_select_own" on public.api_keys
    for select to authenticated using (auth.uid() = user_id);

drop policy if exists "api_keys_delete_own" on public.api_keys;
create policy "api_keys_delete_own" on public.api_keys
    for delete to authenticated using (auth.uid() = user_id);

-- Không có policy INSERT/UPDATE: tạo & thu hồi key chỉ qua RPC bên dưới.
-- Quyền theo cột: client không bao giờ đọc được key_hash / rate-limit.
revoke all on public.api_keys from anon, authenticated;
grant select (id, user_id, name, key_prefix, scopes, is_active, last_used_at, expires_at, revoked_at, created_at)
    on public.api_keys to authenticated;
grant delete on public.api_keys to authenticated;

-- ---------------------------------------------------------------------
-- 2. BẢNG ai_advisor_logs (AI bên ngoài ghi phân tích / lời khuyên)
-- ---------------------------------------------------------------------
create table if not exists public.ai_advisor_logs (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references auth.users(id) on delete cascade,
    api_key_id  uuid references public.api_keys(id) on delete set null,
    source      text,                               -- tên API key tại thời điểm ghi
    category    text not null default 'general'
                check (category in ('general', 'tasks', 'finance', 'habits', 'schedule', 'health', 'career')),
    severity    text not null default 'info'
                check (severity in ('info', 'suggestion', 'warning', 'critical')),
    title       text not null check (char_length(title) between 1 and 200),
    content     text not null check (char_length(content) between 1 and 20000),
    data        jsonb,
    is_read     boolean not null default false,
    created_at  timestamptz not null default now()
);

create index if not exists ai_advisor_logs_user_idx on public.ai_advisor_logs (user_id, created_at desc);

alter table public.ai_advisor_logs enable row level security;

drop policy if exists "ai_advisor_logs_select_own" on public.ai_advisor_logs;
create policy "ai_advisor_logs_select_own" on public.ai_advisor_logs
    for select to authenticated using (auth.uid() = user_id);

drop policy if exists "ai_advisor_logs_update_own" on public.ai_advisor_logs;
create policy "ai_advisor_logs_update_own" on public.ai_advisor_logs
    for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "ai_advisor_logs_delete_own" on public.ai_advisor_logs;
create policy "ai_advisor_logs_delete_own" on public.ai_advisor_logs
    for delete to authenticated using (auth.uid() = user_id);

revoke all on public.ai_advisor_logs from anon, authenticated;
grant select, delete on public.ai_advisor_logs to authenticated;
grant update (is_read) on public.ai_advisor_logs to authenticated;

-- Index hỗ trợ truy vấn của API (an toàn nếu đã tồn tại)
create index if not exists todos_user_status_sort_idx on public.todos (user_id, status, sort_order);
create index if not exists todos_user_deadline_idx on public.todos (user_id, deadline) where status <> 'done';
create index if not exists transactions_user_date_idx on public.transactions (user_id, date);

-- ---------------------------------------------------------------------
-- 3. HÀM NỘI BỘ (không cấp quyền EXECUTE cho client)
-- ---------------------------------------------------------------------

-- Danh sách scope hợp lệ
create or replace function public._api_allowed_scopes()
returns text[] language sql immutable set search_path = '' as $$
    select array['read:all', 'context:read', 'tasks:read', 'tasks:write', 'finance:read', 'finance:write', 'insights:read', 'insights:write'];
$$;

-- Định dạng tiền kiểu Việt Nam: 1.250.000đ (giúp AI đọc đúng, không phải tự format)
create or replace function public._api_vnd(p numeric)
returns text language sql immutable set search_path = '' as $$
    select case when p is null then null
                else case when p < 0 then '-' else '' end
                     || replace(to_char(round(abs(p)), 'FM999,999,999,999,990'), ',', '.') || 'đ' end;
$$;

-- Giao dịch "Điều chỉnh số dư" không tính vào thu/chi (giống app)
create or replace function public._api_is_real_tx(p_category text)
returns boolean language sql immutable set search_path = '' as $$
    select coalesce(p_category, '') <> 'Điều chỉnh số dư';
$$;

-- Kiểm tra scope: read:all bao gồm mọi scope *:read; tasks:write bao gồm tasks:read
create or replace function public._api_has_scope(p_scopes text[], p_needed text)
returns boolean language sql immutable set search_path = '' as $$
    select p_needed is null
        or p_needed = any(p_scopes)
        or (p_needed like '%:read' and 'read:all' = any(p_scopes))
        or (p_needed = 'tasks:read' and 'tasks:write' = any(p_scopes))
        or (p_needed = 'finance:read' and 'finance:write' = any(p_scopes))
        or (p_needed = 'insights:read' and 'insights:write' = any(p_scopes));
$$;

-- Xác thực key + scope + hạn dùng + rate limit (120 request/phút/key)
create or replace function public._api_auth(p_key text, p_scope text)
returns public.api_keys
language plpgsql security definer set search_path = '' as $$
declare
    k public.api_keys;
begin
    if p_key is null or p_key !~ '^sl_live_[0-9a-f]{48}$' then
        raise exception 'Invalid API key format' using errcode = 'PT401', detail = 'invalid_api_key';
    end if;

    select * into k
    from public.api_keys
    where key_hash = encode(extensions.digest(p_key, 'sha256'), 'hex')
    for update;

    if not found or not k.is_active then
        raise exception 'API key is invalid or has been revoked' using errcode = 'PT401', detail = 'invalid_api_key';
    end if;

    if k.expires_at is not null and k.expires_at <= now() then
        raise exception 'API key has expired' using errcode = 'PT401', detail = 'expired_api_key';
    end if;

    if not public._api_has_scope(k.scopes, p_scope) then
        raise exception 'API key is missing required scope: %', p_scope
            using errcode = 'PT403', detail = 'insufficient_scope', hint = p_scope;
    end if;

    if k.rl_window_start is null or now() - k.rl_window_start >= interval '1 minute' then
        k.rl_window_start := now();
        k.rl_count := 1;
    elsif k.rl_count >= 120 then
        raise exception 'Rate limit exceeded (120 requests/minute)' using errcode = 'PT429', detail = 'rate_limited';
    else
        k.rl_count := k.rl_count + 1;
    end if;

    update public.api_keys
    set last_used_at = now(), rl_window_start = k.rl_window_start, rl_count = k.rl_count
    where id = k.id;

    return k;
end;
$$;

-- Kiểm tra timezone hợp lệ
create or replace function public._api_tz(p_tz text)
returns text language plpgsql stable set search_path = '' as $$
begin
    if p_tz is null or p_tz = '' then
        return 'Asia/Ho_Chi_Minh';
    end if;
    if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_tz) then
        raise exception 'Unknown timezone: %', p_tz using errcode = 'PT400', detail = 'invalid_timezone';
    end if;
    return p_tz;
end;
$$;

-- Ánh xạ độ ưu tiên: nhãn UI (urgent/focus/chill/temp) <-> giá trị DB (high/medium/low/temp)
create or replace function public._api_priority_to_db(p text)
returns text language plpgsql immutable set search_path = '' as $$
begin
    return case lower(coalesce(p, 'focus'))
        when 'urgent' then 'high'   when 'high' then 'high'
        when 'focus' then 'medium'  when 'medium' then 'medium'
        when 'chill' then 'low'     when 'low' then 'low'
        when 'temp' then 'temp'
        else null
    end;
end;
$$;

create or replace function public._api_priority_label(p text)
returns text language sql immutable set search_path = '' as $$
    select case p when 'high' then 'urgent' when 'medium' then 'focus' when 'low' then 'chill' when 'temp' then 'temp' else 'focus' end;
$$;

-- JSON đầy đủ của 1 task
create or replace function public._api_task_json(t public.todos)
returns jsonb language sql stable set search_path = '' as $$
    select jsonb_build_object(
        'id', t.id,
        'title', t.content,
        'description', t.description,
        'status', t.status,
        'priority', public._api_priority_label(t.priority),
        'deadline', t.deadline,
        'is_overdue', (t.deadline is not null and t.deadline < now() and coalesce(t.status, 'todo') <> 'done'),
        'scheduled_date', t.scheduled_date,
        'scheduled_time', t.scheduled_time,
        'sort_order', t.sort_order,
        'time_spent_minutes', round(coalesce(t.time_spent, 0) / 60.0),
        'subtasks', coalesce(t.subtasks, '[]'::jsonb),
        'attach_link', t.attach_link,
        'created_at', t.created_at,
        'completed_at', t.completed_at
    );
$$;

-- JSON rút gọn (tiết kiệm token) cho context
create or replace function public._api_task_brief(t public.todos)
returns jsonb language sql stable set search_path = '' as $$
    select jsonb_strip_nulls(jsonb_build_object(
        'id', t.id,
        'title', t.content,
        'status', t.status,
        'priority', public._api_priority_label(t.priority),
        'deadline', t.deadline,
        'subtasks_done', case when jsonb_typeof(t.subtasks) = 'array' and jsonb_array_length(t.subtasks) > 0
            then (select count(*) from jsonb_array_elements(t.subtasks) e where (e->>'is_completed')::boolean)
                 || '/' || jsonb_array_length(t.subtasks) end
    ));
$$;

-- Chuẩn hóa subtasks: chấp nhận ["a","b"] hoặc [{"title":"a","is_completed":false}]
create or replace function public._api_normalize_subtasks(p jsonb)
returns jsonb language plpgsql stable set search_path = '' as $$
declare
    res jsonb := '[]'::jsonb;
    e jsonb;
begin
    if p is null or jsonb_typeof(p) = 'null' then
        return '[]'::jsonb;
    end if;
    if jsonb_typeof(p) <> 'array' then
        raise exception 'subtasks must be an array' using errcode = 'PT400', detail = 'invalid_subtasks';
    end if;
    if jsonb_array_length(p) > 50 then
        raise exception 'Too many subtasks (max 50)' using errcode = 'PT400', detail = 'invalid_subtasks';
    end if;
    for e in select * from jsonb_array_elements(p) loop
        if jsonb_typeof(e) = 'string' then
            res := res || jsonb_build_array(jsonb_build_object('id', gen_random_uuid(), 'title', left(e #>> '{}', 300), 'is_completed', false));
        elsif jsonb_typeof(e) = 'object' and coalesce(e->>'title', '') <> '' then
            res := res || jsonb_build_array(jsonb_build_object(
                'id', coalesce(e->>'id', gen_random_uuid()::text),
                'title', left(e->>'title', 300),
                'is_completed', coalesce((e->>'is_completed')::boolean, false)));
        else
            raise exception 'Each subtask must be a string or an object with "title"' using errcode = 'PT400', detail = 'invalid_subtasks';
        end if;
    end loop;
    return res;
end;
$$;

-- Ngày đến hạn kế tiếp của giao dịch định kỳ.
-- Nếu tháng này chưa áp dụng → trả về ngày của tháng này (có thể đã qua = quá hạn).
create or replace function public._api_recurring_next_due(p_day int, p_last_applied text, p_today date)
returns date language plpgsql immutable set search_path = '' as $$
declare
    m_start date := date_trunc('month', p_today)::date;
    n_start date := (date_trunc('month', p_today) + interval '1 month')::date;
    m_days int := extract(day from (m_start + interval '1 month - 1 day'))::int;
    n_days int := extract(day from (n_start + interval '1 month - 1 day'))::int;
begin
    if coalesce(p_last_applied, '') <> to_char(p_today, 'YYYY-MM') then
        return m_start + (least(p_day, m_days) - 1);
    end if;
    return n_start + (least(p_day, n_days) - 1);
end;
$$;

-- Chuỗi streak hiện tại của 1 thói quen (số ngày liên tiếp có log completed, kết thúc hôm nay hoặc hôm qua)
create or replace function public._api_habit_streak(p_habit_id uuid, p_today date)
returns int language sql stable set search_path = '' as $$
    with d as (
        select distinct log_date
        from public.habit_logs
        where habit_id = p_habit_id and completed and log_date <= p_today
    ), g as (
        select log_date, log_date - (row_number() over (order by log_date))::int as grp from d
    ), last_grp as (
        select grp, max(log_date) as last_day from g group by grp order by max(log_date) desc limit 1
    )
    select coalesce((
        select count(*)::int from g, last_grp
        where g.grp = last_grp.grp and last_grp.last_day >= p_today - 1
    ), 0);
$$;

-- ---------------------------------------------------------------------
-- 4. QUẢN LÝ KEY (gọi từ giao diện SmartLife, user đã đăng nhập)
-- ---------------------------------------------------------------------
create or replace function public.create_api_key(p_name text, p_scopes text[], p_expires_in_days int default 90)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
    uid uuid := auth.uid();
    v_name text := btrim(coalesce(p_name, ''));
    v_key text;
    v_row public.api_keys;
begin
    if uid is null then
        raise exception 'Not authenticated' using errcode = 'PT401';
    end if;
    if char_length(v_name) < 1 or char_length(v_name) > 80 then
        raise exception 'Name must be 1-80 characters' using errcode = 'PT400';
    end if;
    if p_scopes is null or cardinality(p_scopes) = 0 then
        raise exception 'At least one scope is required' using errcode = 'PT400';
    end if;
    if exists (select 1 from unnest(p_scopes) s where s <> all(public._api_allowed_scopes())) then
        raise exception 'Unknown scope in %', p_scopes using errcode = 'PT400';
    end if;
    if p_expires_in_days is not null and (p_expires_in_days < 1 or p_expires_in_days > 365) then
        raise exception 'expires_in_days must be between 1 and 365, or null' using errcode = 'PT400';
    end if;
    if (select count(*) from public.api_keys
        where user_id = uid and is_active and (expires_at is null or expires_at > now())) >= 10 then
        raise exception 'Maximum 10 active API keys. Revoke an old key first.' using errcode = 'PT409';
    end if;

    v_key := 'sl_live_' || encode(extensions.gen_random_bytes(24), 'hex');

    insert into public.api_keys (user_id, name, key_prefix, key_hash, scopes, expires_at)
    values (
        uid, v_name, left(v_key, 14),
        encode(extensions.digest(v_key, 'sha256'), 'hex'),
        (select array_agg(distinct s order by s) from unnest(p_scopes) s),
        case when p_expires_in_days is null then null else now() + make_interval(days => p_expires_in_days) end
    )
    returning * into v_row;

    -- Key gốc chỉ được trả về DUY NHẤT ở đây, không lưu ở đâu cả.
    return jsonb_build_object(
        'id', v_row.id, 'name', v_row.name, 'key', v_key, 'key_prefix', v_row.key_prefix,
        'scopes', v_row.scopes, 'expires_at', v_row.expires_at, 'created_at', v_row.created_at);
end;
$$;

create or replace function public.revoke_api_key(p_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
    update public.api_keys
    set is_active = false, revoked_at = now()
    where id = p_id and user_id = auth.uid();
    if not found then
        raise exception 'API key not found' using errcode = 'PT404';
    end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. API v1 — gọi từ Vercel Function bằng anon key + key người dùng
-- ---------------------------------------------------------------------

-- GET /api/v1/me — kiểm tra key
create or replace function public.api_v1_whoami(p_key text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
    k public.api_keys := public._api_auth(p_key, null);
begin
    return jsonb_build_object(
        'key', jsonb_build_object('id', k.id, 'name', k.name, 'prefix', k.key_prefix, 'scopes', k.scopes, 'expires_at', k.expires_at),
        'user', (select jsonb_build_object('name', p.full_name, 'currency', coalesce(p.currency, 'VND'))
                 from public.profiles p where p.id = k.user_id));
end;
$$;

-- GET /api/v1/ai/context — bức tranh toàn cảnh, tối ưu token
create or replace function public.api_v1_context(p_key text, p_tz text default 'Asia/Ho_Chi_Minh')
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
    k public.api_keys := public._api_auth(p_key, 'context:read');
    uid uuid := k.user_id;
    v_tz text := public._api_tz(p_tz);
    v_now timestamptz := now();
    v_today date := (now() at time zone v_tz)::date;
    v_dow int := extract(dow from v_today)::int;            -- 0 = Chủ nhật (khớp bảng timetable)
    v_month text := to_char(v_today, 'YYYY-MM');
    v_m_start date := date_trunc('month', v_today)::date;
    v_m_end date := (date_trunc('month', v_today) + interval '1 month - 1 day')::date;
    v_days_in_month int := extract(day from v_m_end)::int;
    v_day int := extract(day from v_today)::int;
    v_expense numeric; v_income numeric; v_budget numeric; v_balance numeric; v_projected numeric;
    v_upcoming jsonb; v_upcoming_expense numeric;
    v_user jsonb; v_tasks jsonb; v_finance jsonb; v_productivity jsonb;
begin
    -- USER SUMMARY ------------------------------------------------------
    select jsonb_strip_nulls(jsonb_build_object(
        'name', p.full_name, 'age', p.age, 'job', p.job, 'workplace', p.workplace,
        'major', p.major, 'university', p.university,
        'career_objective', p.career_objective, 'life_motto', p.life_motto,
        'mbti', p.personality_mbti, 'disc', p.personality_disc, 'hobbies', to_jsonb(p.hobbies),
        'monthly_salary', p.monthly_salary, 'currency', coalesce(p.currency, 'VND')))
    into v_user
    from public.profiles p where p.id = uid;

    v_user := coalesce(v_user, '{}'::jsonb) || jsonb_build_object(
        'life_goals', (select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('title', g.title, 'target_year', g.target_year)) order by g.sort_order), '[]')
                       from (select * from public.life_goals where user_id = uid and not coalesce(is_achieved, false)
                             order by sort_order nulls last limit 5) g),
        'career_goals', (select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('title', g.title, 'status', g.status, 'progress', g.progress, 'deadline', g.deadline)) order by g.deadline nulls last), '[]')
                         from (select * from public.career_goals where user_id = uid and coalesce(progress, 0) < 100
                               order by deadline nulls last limit 5) g));

    -- TASKS SNAPSHOT ----------------------------------------------------
    v_tasks := jsonb_build_object(
        'counts', (select jsonb_build_object(
                'backlog', count(*) filter (where status = 'backlog'),
                'todo',    count(*) filter (where status = 'todo'),
                'doing',   count(*) filter (where status = 'doing'),
                'done',    count(*) filter (where status = 'done'),
                'overdue', count(*) filter (where status <> 'done' and deadline < v_now),
                'completed_last_7d', count(*) filter (where status = 'done' and completed_at >= v_now - interval '7 days'))
            from public.todos where user_id = uid),
        'overdue', (select coalesce(jsonb_agg(public._api_task_brief(s.tr) order by (s.tr).deadline), '[]')
            from (select tr from public.todos tr where tr.user_id = uid and tr.status <> 'done' and tr.deadline < v_now
                  order by tr.deadline limit 15) s),
        'due_next_48h', (select coalesce(jsonb_agg(public._api_task_brief(s.tr) order by (s.tr).deadline), '[]')
            from (select tr from public.todos tr where tr.user_id = uid and tr.status <> 'done'
                  and tr.deadline >= v_now and tr.deadline < v_now + interval '48 hours'
                  order by tr.deadline limit 10) s),
        -- urgent trước, rồi focus; trong cùng mức: doing trước todo, theo thứ tự Kanban
        'top_priority', (select coalesce(jsonb_agg(public._api_task_brief(s.tr) order by s.rk), '[]')
            from (select tr, row_number() over (order by case tr.priority when 'high' then 0 else 1 end,
                                                         case tr.status when 'doing' then 0 else 1 end,
                                                         tr.sort_order nulls last, tr.created_at) rk
                  from public.todos tr where tr.user_id = uid and tr.status in ('todo', 'doing')
                  and tr.priority in ('high', 'medium') and (tr.deadline is null or tr.deadline >= v_now)
                  order by rk limit 15) s),
        'today_timetable', (select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                'title', e.title, 'start', to_char(e.start_time, 'HH24:MI'), 'end', to_char(e.end_time, 'HH24:MI'), 'location', e.location))
                order by e.start_time), '[]')
            from public.timetable e where e.user_id = uid and e.day_of_week = v_dow),
        'today_events', (select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                'title', c.title, 'time', to_char(c.time, 'HH24:MI'), 'type', c.type, 'location', c.location))
                order by c.time nulls first), '[]')
            from public.calendar_events c where c.user_id = uid and c.date = v_today));

    -- FINANCE SNAPSHOT --------------------------------------------------
    select coalesce(sum(amount) filter (where type = 'expense'), 0),
           coalesce(sum(amount) filter (where type = 'income'), 0)
    into v_expense, v_income
    from public.transactions
    where user_id = uid and date between v_m_start and v_m_end and public._api_is_real_tx(category);

    select sum(amount) into v_budget from public.budgets where user_id = uid and month = v_month;
    select coalesce(sum(balance), 0) into v_balance from public.wallets where user_id = uid and coalesce(include_in_total, true);
    v_projected := round(v_expense / greatest(v_day, 1) * v_days_in_month);

    select coalesce(jsonb_agg(x order by x->>'due_date'), '[]'),
           coalesce(sum((x->>'amount')::numeric) filter (where x->>'type' = 'expense'), 0)
    into v_upcoming, v_upcoming_expense
    from (
        select jsonb_build_object('title', r.title, 'amount', r.amount, 'type', r.type, 'category', r.category,
                                  'due_date', d.due, 'is_overdue', d.due < v_today, 'auto_apply', coalesce(r.auto_apply, false)) x
        from public.recurring_transactions r
        cross join lateral (select public._api_recurring_next_due(r.day_of_month, r.last_applied_month, v_today) due) d
        where r.user_id = uid and r.status = 'active' and d.due <= v_today + 7
    ) s;

    v_finance := jsonb_build_object(
        -- Câu tóm tắt có sẵn để AI trích dẫn thẳng, tránh tính/đọc nhầm số
        'summary', format('Tháng %s (đến ngày %s/%s): ĐÃ CHI %s, đã thu %s%s. Tổng số dư các ví: %s. Dự báo nếu giữ nhịp chi hiện tại: khoảng %s cả tháng.',
            to_char(v_today, 'MM/YYYY'), v_day, v_days_in_month,
            public._api_vnd(v_expense), public._api_vnd(v_income),
            case when coalesce(v_budget, 0) > 0
                 then format(', ngân sách %s (đã dùng %s%%)', public._api_vnd(v_budget), round(v_expense * 100 / v_budget, 1)) else '' end,
            public._api_vnd(v_balance), public._api_vnd(v_projected)),
        'month', v_month,
        'total_balance', v_balance,
        'wallets', (select coalesce(jsonb_agg(jsonb_build_object('name', w.name, 'type', w.type, 'balance', w.balance) order by w.balance desc), '[]')
                    from public.wallets w where w.user_id = uid),
        'income_so_far_this_month', v_income,
        'expense_so_far_this_month', v_expense,
        'month_budget', v_budget,
        'budget_used_pct', case when coalesce(v_budget, 0) > 0 then round(v_expense * 100 / v_budget, 1) end,
        'day_of_month', v_day,
        'days_in_month', v_days_in_month,
        'forecast_full_month_expense', v_projected,
        'categories_at_risk', (select coalesce(jsonb_agg(jsonb_build_object('category', b.category, 'budget', b.amount, 'spent', s.spent,
                                                                           'used_pct', round(s.spent * 100 / b.amount, 1)) order by s.spent / b.amount desc), '[]')
            from public.budgets b
            cross join lateral (select coalesce(sum(t.amount), 0) spent from public.transactions t
                                where t.user_id = uid and t.type = 'expense' and t.category = b.category
                                and t.date between v_m_start and v_m_end) s
            where b.user_id = uid and b.month = v_month and b.amount > 0 and s.spent >= b.amount * 0.8),
        'upcoming_recurring_7d', v_upcoming,
        'upcoming_recurring_expense_7d', v_upcoming_expense,
        'debts', (select jsonb_build_object(
                'i_owe', coalesce(sum(remaining_amount) filter (where type = 'borrow'), 0),
                'owed_to_me', coalesce(sum(remaining_amount) filter (where type = 'lend'), 0),
                'due_next_7d', coalesce(jsonb_agg(jsonb_build_object('partner', partner_name, 'type', type, 'remaining', remaining_amount, 'due_date', due_date))
                                        filter (where due_date is not null and due_date <= v_today + 7), '[]'))
            from public.debts where user_id = uid and status <> 'paid'),
        'savings_goals', (select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                'title', g.title, 'target', g.target_amount, 'current', g.current_amount, 'deadline', g.deadline,
                'monthly_target', g.monthly_target,
                'pct', case when coalesce(g.target_amount, 0) > 0 then round(coalesce(g.current_amount, 0) * 100 / g.target_amount, 1) end))), '[]')
            from (select * from public.goals where user_id = uid and type = 'FINANCIAL'
                  and coalesce(current_amount, 0) < coalesce(target_amount, 0)
                  order by is_priority desc nulls last, deadline nulls last limit 5) g),
        'risk_flags', to_jsonb(array_remove(array[
            case when coalesce(v_budget, 0) > 0 and v_expense > v_budget then 'budget_exceeded' end,
            case when coalesce(v_budget, 0) > 0 and v_expense <= v_budget and v_projected > v_budget then 'projected_overspend' end,
            case when v_upcoming_expense > 0 and v_balance < v_upcoming_expense then 'balance_below_upcoming_bills' end,
            case when exists (select 1 from jsonb_array_elements(v_upcoming) u where (u->>'is_overdue')::boolean) then 'overdue_recurring_bill' end
        ], null)));

    -- PRODUCTIVITY SNAPSHOT --------------------------------------------
    v_productivity := jsonb_build_object(
        'stars', (select jsonb_build_object('balance', s.current_balance, 'level', s.current_level, 'total_earned', s.total_earned)
                  from public.user_star_stats s where s.user_id = uid),
        'habits', (select coalesce(jsonb_agg(jsonb_build_object(
                'title', h.title, 'frequency', h.frequency,
                'streak_days', public._api_habit_streak(h.id, v_today),
                'done_today', exists (select 1 from public.habit_logs l where l.habit_id = h.id and l.log_date = v_today and l.completed),
                'done_last_7d', (select count(distinct l.log_date) from public.habit_logs l
                                 where l.habit_id = h.id and l.completed and l.log_date > v_today - 7 and l.log_date <= v_today))
                order by h.created_at), '[]')
            from (select * from public.habits where user_id = uid and coalesce(is_active, true) order by created_at limit 20) h),
        'focus_minutes_last_7d', (select round(coalesce(sum(time_spent), 0) / 60.0) from public.todos
                                  where user_id = uid and status = 'done' and completed_at >= v_now - interval '7 days'),
        'focus_minutes_in_progress', (select round(coalesce(sum(time_spent), 0) / 60.0) from public.todos
                                      where user_id = uid and status = 'doing'),
        'journal_last_7d', (select jsonb_build_object('entries', count(*), 'avg_mood', round(avg(mood), 1), 'last_entry', max(entry_date))
                            from public.journal_entries where user_id = uid and entry_date > v_today - 7),
        'unread_ai_insights', (select count(*) from public.ai_advisor_logs where user_id = uid and not is_read));

    return jsonb_build_object(
        'generated_at', v_now,
        'timezone', v_tz,
        'today', v_today,
        'weekday', v_dow,
        'user', v_user,
        'tasks', v_tasks,
        'finance', v_finance,
        'productivity', v_productivity);
end;
$$;

-- GET /api/v1/tasks
create or replace function public.api_v1_list_tasks(
    p_key text,
    p_status text[] default null,
    p_priority text[] default null,
    p_due_from timestamptz default null,
    p_due_to timestamptz default null,
    p_overdue boolean default null,
    p_search text default null,
    p_limit int default 50,
    p_offset int default 0
)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
    k public.api_keys := public._api_auth(p_key, 'tasks:read');
    v_prio text[];
    v_total int;
    v_items jsonb;
begin
    if p_priority is not null then
        select array_agg(public._api_priority_to_db(x)) into v_prio from unnest(p_priority) x;
        if array_position(v_prio, null) is not null then
            raise exception 'Invalid priority. Use urgent|focus|chill|temp' using errcode = 'PT400', detail = 'invalid_priority';
        end if;
    end if;
    if p_status is not null and exists (select 1 from unnest(p_status) s where s not in ('backlog', 'todo', 'doing', 'done')) then
        raise exception 'Invalid status. Use backlog|todo|doing|done' using errcode = 'PT400', detail = 'invalid_status';
    end if;
    p_limit := least(greatest(coalesce(p_limit, 50), 1), 200);
    p_offset := greatest(coalesce(p_offset, 0), 0);

    with f as (
        select t as tr, case t.status when 'doing' then 0 when 'todo' then 1 when 'backlog' then 2 else 3 end as so
        from public.todos t
        where t.user_id = k.user_id
          -- mặc định bỏ qua task đã xong, trừ khi lọc rõ status
          and (case when p_status is null then coalesce(t.status, 'todo') <> 'done' else t.status = any(p_status) end)
          and (v_prio is null or t.priority = any(v_prio))
          and (p_due_from is null or t.deadline >= p_due_from)
          and (p_due_to is null or t.deadline < p_due_to)
          and (p_overdue is null or (p_overdue = (t.deadline is not null and t.deadline < now() and coalesce(t.status, 'todo') <> 'done')))
          and (p_search is null or t.content ilike '%' || p_search || '%' or t.description ilike '%' || p_search || '%')
    )
    select (select count(*) from f),
           (select coalesce(jsonb_agg(public._api_task_json(p.tr) order by p.so, (p.tr).sort_order nulls last, (p.tr).created_at), '[]')
            from (select * from f order by so, (tr).sort_order nulls last, (tr).created_at
                  limit p_limit offset p_offset) p)
    into v_total, v_items;

    return jsonb_build_object('total', v_total, 'limit', p_limit, 'offset', p_offset, 'items', v_items);
end;
$$;

-- GET /api/v1/tasks/:id
create or replace function public.api_v1_get_task(p_key text, p_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
    k public.api_keys := public._api_auth(p_key, 'tasks:read');
    t public.todos;
begin
    select * into t from public.todos where id = p_id and user_id = k.user_id;
    if not found then
        raise exception 'Task not found' using errcode = 'PT404', detail = 'not_found';
    end if;
    return public._api_task_json(t);
end;
$$;

-- POST /api/v1/tasks
create or replace function public.api_v1_create_task(p_key text, p_task jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
    k public.api_keys := public._api_auth(p_key, 'tasks:write');
    v_title text := btrim(coalesce(p_task->>'title', ''));
    v_status text := coalesce(p_task->>'status', 'backlog');   -- AI gợi ý → mặc định vào Backlog
    v_prio text := public._api_priority_to_db(p_task->>'priority');
    v_min int;
    t public.todos;
begin
    if char_length(v_title) < 1 or char_length(v_title) > 500 then
        raise exception 'title is required (max 500 chars)' using errcode = 'PT400', detail = 'invalid_title';
    end if;
    if v_status not in ('backlog', 'todo', 'doing', 'done') then
        raise exception 'Invalid status. Use backlog|todo|doing|done' using errcode = 'PT400', detail = 'invalid_status';
    end if;
    if v_prio is null then
        raise exception 'Invalid priority. Use urgent|focus|chill|temp' using errcode = 'PT400', detail = 'invalid_priority';
    end if;
    if (select count(*) from public.todos where user_id = k.user_id and created_at > now() - interval '1 hour') >= 200 then
        raise exception 'Too many tasks created in the last hour' using errcode = 'PT429', detail = 'rate_limited';
    end if;

    -- Task mới nằm trên cùng (giống hành vi của app)
    select coalesce(min(sort_order), 0) - 1 into v_min from public.todos where user_id = k.user_id;

    insert into public.todos (user_id, content, description, status, is_completed, completed_at, priority,
                              deadline, scheduled_date, scheduled_time, subtasks, attach_link, sort_order, time_spent)
    values (
        k.user_id, v_title, nullif(p_task->>'description', ''), v_status, v_status = 'done',
        case when v_status = 'done' then now() end, v_prio,
        (p_task->>'deadline')::timestamptz, (p_task->>'scheduled_date')::date, (p_task->>'scheduled_time')::time,
        public._api_normalize_subtasks(p_task->'subtasks'), nullif(p_task->>'attach_link', ''), v_min, 0)
    returning * into t;

    return public._api_task_json(t);
end;
$$;

-- PATCH /api/v1/tasks/:id — chỉ cập nhật các trường được gửi lên
create or replace function public.api_v1_update_task(p_key text, p_id uuid, p_patch jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
    k public.api_keys := public._api_auth(p_key, 'tasks:write');
    t public.todos;
    v_prio text;
begin
    if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
        raise exception 'Body must be a JSON object' using errcode = 'PT400', detail = 'invalid_body';
    end if;
    if exists (select 1 from jsonb_object_keys(p_patch) key
               where key not in ('title', 'description', 'status', 'priority', 'deadline', 'scheduled_date',
                                 'scheduled_time', 'subtasks', 'attach_link', 'sort_order')) then
        raise exception 'Unsupported field. Allowed: title, description, status, priority, deadline, scheduled_date, scheduled_time, subtasks, attach_link, sort_order'
            using errcode = 'PT400', detail = 'invalid_field';
    end if;

    select * into t from public.todos where id = p_id and user_id = k.user_id for update;
    if not found then
        raise exception 'Task not found' using errcode = 'PT404', detail = 'not_found';
    end if;

    if p_patch ? 'title' then
        if char_length(btrim(coalesce(p_patch->>'title', ''))) not between 1 and 500 then
            raise exception 'title must be 1-500 chars' using errcode = 'PT400', detail = 'invalid_title';
        end if;
        t.content := btrim(p_patch->>'title');
    end if;
    if p_patch ? 'description' then t.description := p_patch->>'description'; end if;
    if p_patch ? 'priority' then
        v_prio := public._api_priority_to_db(p_patch->>'priority');
        if v_prio is null then
            raise exception 'Invalid priority. Use urgent|focus|chill|temp' using errcode = 'PT400', detail = 'invalid_priority';
        end if;
        t.priority := v_prio;
    end if;
    if p_patch ? 'status' then
        if coalesce(p_patch->>'status', '') not in ('backlog', 'todo', 'doing', 'done') then
            raise exception 'Invalid status. Use backlog|todo|doing|done' using errcode = 'PT400', detail = 'invalid_status';
        end if;
        if p_patch->>'status' = 'done' and coalesce(t.status, '') <> 'done' then
            t.completed_at := now();
        elsif p_patch->>'status' <> 'done' then
            t.completed_at := null;
        end if;
        t.status := p_patch->>'status';
        t.is_completed := t.status = 'done';
    end if;
    if p_patch ? 'deadline' then t.deadline := (p_patch->>'deadline')::timestamptz; end if;
    if p_patch ? 'scheduled_date' then t.scheduled_date := (p_patch->>'scheduled_date')::date; end if;
    if p_patch ? 'scheduled_time' then t.scheduled_time := (p_patch->>'scheduled_time')::time; end if;
    if p_patch ? 'subtasks' then t.subtasks := public._api_normalize_subtasks(p_patch->'subtasks'); end if;
    if p_patch ? 'attach_link' then t.attach_link := nullif(p_patch->>'attach_link', ''); end if;
    if p_patch ? 'sort_order' then t.sort_order := (p_patch->>'sort_order')::int; end if;

    update public.todos set
        content = t.content, description = t.description, priority = t.priority, status = t.status,
        is_completed = t.is_completed, completed_at = t.completed_at, deadline = t.deadline,
        scheduled_date = t.scheduled_date, scheduled_time = t.scheduled_time, subtasks = t.subtasks,
        attach_link = t.attach_link, sort_order = t.sort_order
    where id = t.id;

    return public._api_task_json(t);
end;
$$;

-- POST /api/v1/tasks/reorder
-- p_ids: danh sách task theo thứ tự mới (đầu tiên = trên cùng).
-- p_status (tùy chọn): đồng thời chuyển các task này sang cột đó.
-- Các task khác cùng cột (không có trong danh sách) giữ thứ tự cũ, xếp phía sau.
create or replace function public.api_v1_reorder_tasks(p_key text, p_ids uuid[], p_status text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
    k public.api_keys := public._api_auth(p_key, 'tasks:write');
    n int := coalesce(cardinality(p_ids), 0);
    v_found int;
    v_missing uuid[];
    v_cols text[];
begin
    if n = 0 or n > 500 then
        raise exception 'ids must contain 1-500 task ids' using errcode = 'PT400', detail = 'invalid_ids';
    end if;
    if (select count(distinct x) from unnest(p_ids) x) <> n then
        raise exception 'ids must not contain duplicates' using errcode = 'PT400', detail = 'duplicate_ids';
    end if;
    if p_status is not null and p_status not in ('backlog', 'todo', 'doing', 'done') then
        raise exception 'Invalid status. Use backlog|todo|doing|done' using errcode = 'PT400', detail = 'invalid_status';
    end if;

    select array_agg(x) into v_missing
    from unnest(p_ids) x
    where not exists (select 1 from public.todos t where t.id = x and t.user_id = k.user_id);
    if v_missing is not null then
        raise exception 'Unknown task ids: %', v_missing using errcode = 'PT400', detail = 'unknown_ids';
    end if;

    -- Các cột bị ảnh hưởng
    select array_agg(distinct coalesce(p_status, t.status)) into v_cols
    from public.todos t where t.user_id = k.user_id and t.id = any(p_ids);

    -- 1) Task trong danh sách: sort_order = vị trí (0..n-1), có thể đổi cột
    update public.todos t set
        sort_order = u.pos,
        status = coalesce(p_status, t.status),
        is_completed = coalesce(p_status, t.status) = 'done',
        completed_at = case
            when coalesce(p_status, t.status) = 'done' then coalesce(t.completed_at, now())
            else null end
    from (select x as id, (ord - 1)::int as pos from unnest(p_ids) with ordinality u(x, ord)) u
    where t.id = u.id and t.user_id = k.user_id;
    get diagnostics v_found = row_count;

    -- 2) Task còn lại trong các cột đó: đẩy xuống sau, giữ thứ tự tương đối
    update public.todos t set sort_order = r.pos
    from (select id, (n - 1 + row_number() over (partition by status order by sort_order nulls last, created_at))::int pos
          from public.todos
          where user_id = k.user_id and status = any(v_cols) and not (id = any(p_ids))) r
    where t.id = r.id;

    return jsonb_build_object('updated', v_found, 'columns', to_jsonb(v_cols), 'order', to_jsonb(p_ids));
end;
$$;

-- GET /api/v1/finance/overview
create or replace function public.api_v1_finance_overview(p_key text, p_month text default null, p_tz text default 'Asia/Ho_Chi_Minh')
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
    k public.api_keys := public._api_auth(p_key, 'finance:read');
    uid uuid := k.user_id;
    v_tz text := public._api_tz(p_tz);
    v_today date := (now() at time zone v_tz)::date;
    v_month text;
    v_m_start date; v_m_end date; v_prev_start date;
    v_is_current boolean;
    v_days_in_month int; v_days_elapsed int;
    v_income numeric; v_expense numeric; v_prev_expense numeric; v_budget numeric; v_balance numeric;
    v_recurring jsonb; v_rec_in numeric; v_rec_out numeric;
begin
    v_month := coalesce(nullif(p_month, ''), to_char(v_today, 'YYYY-MM'));
    if v_month !~ '^\d{4}-(0[1-9]|1[0-2])$' then
        raise exception 'month must be YYYY-MM' using errcode = 'PT400', detail = 'invalid_month';
    end if;
    v_m_start := to_date(v_month || '-01', 'YYYY-MM-DD');
    v_m_end := (v_m_start + interval '1 month - 1 day')::date;
    v_prev_start := (v_m_start - interval '1 month')::date;
    v_is_current := v_month = to_char(v_today, 'YYYY-MM');
    v_days_in_month := extract(day from v_m_end)::int;
    v_days_elapsed := case when v_is_current then extract(day from v_today)::int
                           when v_m_end < v_today then v_days_in_month else 0 end;

    select coalesce(sum(amount) filter (where type = 'income'), 0), coalesce(sum(amount) filter (where type = 'expense'), 0)
    into v_income, v_expense
    from public.transactions where user_id = uid and date between v_m_start and v_m_end and public._api_is_real_tx(category);

    select coalesce(sum(amount), 0) into v_prev_expense
    from public.transactions where user_id = uid and type = 'expense' and date >= v_prev_start and date < v_m_start and public._api_is_real_tx(category);

    select sum(amount) into v_budget from public.budgets where user_id = uid and month = v_month;
    select coalesce(sum(balance), 0) into v_balance from public.wallets where user_id = uid and coalesce(include_in_total, true);

    -- Giao dịch định kỳ còn lại đến cuối tháng hiện tại (chỉ tính cho tháng hiện tại)
    select coalesce(jsonb_agg(x order by x->>'next_due'), '[]'),
           coalesce(sum((x->>'amount')::numeric) filter (where x->>'type' = 'income' and (x->>'next_due')::date <= v_m_end), 0),
           coalesce(sum((x->>'amount')::numeric) filter (where x->>'type' = 'expense' and (x->>'next_due')::date <= v_m_end), 0)
    into v_recurring, v_rec_in, v_rec_out
    from (
        select jsonb_build_object('title', r.title, 'amount', r.amount, 'type', r.type, 'category', r.category,
                                  'day_of_month', r.day_of_month, 'next_due', d.due, 'is_overdue', d.due < v_today,
                                  'auto_apply', coalesce(r.auto_apply, false)) x
        from public.recurring_transactions r
        cross join lateral (select public._api_recurring_next_due(r.day_of_month, r.last_applied_month, v_today) due) d
        where r.user_id = uid and r.status = 'active'
    ) s;

    return jsonb_build_object(
        'summary', format('Tháng %s: ĐÃ CHI %s, đã thu %s, chênh lệch %s%s. Tháng trước chi %s.',
            to_char(v_m_start, 'MM/YYYY'), public._api_vnd(v_expense), public._api_vnd(v_income), public._api_vnd(v_income - v_expense),
            case when coalesce(v_budget, 0) > 0
                 then format(', ngân sách %s (đã dùng %s%%, còn %s)', public._api_vnd(v_budget), round(v_expense * 100 / v_budget, 1), public._api_vnd(v_budget - v_expense)) else '' end,
            public._api_vnd(v_prev_expense)),
        'month', v_month,
        'currency', (select coalesce(currency, 'VND') from public.profiles where id = uid),
        'totals', jsonb_build_object(
            'income', v_income, 'expense', v_expense, 'net', v_income - v_expense,
            'budget', v_budget,
            'budget_remaining', case when v_budget is not null then v_budget - v_expense end,
            'budget_used_pct', case when coalesce(v_budget, 0) > 0 then round(v_expense * 100 / v_budget, 1) end,
            'prev_month_expense', v_prev_expense,
            'expense_change_pct', case when v_prev_expense > 0 then round((v_expense - v_prev_expense) * 100 / v_prev_expense, 1) end,
            'avg_daily_expense', case when v_days_elapsed > 0 then round(v_expense / v_days_elapsed) end,
            'projected_month_expense', case when v_is_current and v_days_elapsed > 0 then round(v_expense / v_days_elapsed * v_days_in_month) end,
            'safe_daily_spend', case when v_is_current and coalesce(v_budget, 0) > 0
                then round(greatest(v_budget - v_expense, 0) / greatest(v_days_in_month - v_days_elapsed + 1, 1)) end),
        'expense_by_category', (
            select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                'category', c.category, 'spent', c.spent, 'tx_count', c.cnt, 'budget', c.budget,
                'remaining', case when c.budget is not null then c.budget - c.spent end,
                'used_pct', case when coalesce(c.budget, 0) > 0 then round(c.spent * 100 / c.budget, 1) end,
                'status', case when c.budget is null then 'no_budget'
                               when c.spent > c.budget then 'over'
                               when c.spent >= c.budget * 0.8 then 'warning' else 'ok' end))
                order by c.spent desc), '[]')
            from (
                select coalesce(s.category, b.category) category, coalesce(s.spent, 0) spent, coalesce(s.cnt, 0) cnt, b.amount budget
                from (select category, sum(amount) spent, count(*) cnt from public.transactions
                      where user_id = uid and type = 'expense' and date between v_m_start and v_m_end and public._api_is_real_tx(category) group by category) s
                full join (select category, sum(amount) amount from public.budgets where user_id = uid and month = v_month group by category) b
                    on b.category = s.category
            ) c),
        'income_by_category', (
            select coalesce(jsonb_agg(jsonb_build_object('category', category, 'amount', amt) order by amt desc), '[]')
            from (select category, sum(amount) amt from public.transactions
                  where user_id = uid and type = 'income' and date between v_m_start and v_m_end and public._api_is_real_tx(category) group by category) i),
        'top_expenses', (
            select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('date', t.date, 'amount', t.amount, 'category', t.category, 'description', t.description))
                   order by t.amount desc), '[]')
            from (select * from public.transactions where user_id = uid and type = 'expense'
                  and date between v_m_start and v_m_end and public._api_is_real_tx(category) order by amount desc limit 5) t),
        'weekly_expense', (
            select coalesce(jsonb_agg(jsonb_build_object('week_start', w, 'expense', amt) order by w), '[]')
            from (select date_trunc('week', date)::date w, sum(amount) amt from public.transactions
                  where user_id = uid and type = 'expense' and date between v_m_start and v_m_end and public._api_is_real_tx(category) group by 1) x),
        'cash_flow', jsonb_build_object(
            'total_balance', v_balance,
            'recurring', v_recurring,
            'remaining_recurring_income_this_month', case when v_is_current then v_rec_in end,
            'remaining_recurring_expense_this_month', case when v_is_current then v_rec_out end,
            'projected_balance_end_of_month', case when v_is_current then v_balance + v_rec_in - v_rec_out end),
        'wallets', (select coalesce(jsonb_agg(jsonb_build_object('name', name, 'type', type, 'balance', balance, 'in_total', coalesce(include_in_total, true)) order by balance desc), '[]')
                    from public.wallets where user_id = uid),
        'debts', (select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('partner', partner_name, 'type', type, 'amount', amount,
                          'remaining', remaining_amount, 'due_date', due_date, 'status', status)) order by due_date nulls last), '[]')
                  from public.debts where user_id = uid and status <> 'paid'));
end;
$$;

-- POST /api/v1/ai/insights
create or replace function public.api_v1_create_insight(p_key text, p_insight jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
    k public.api_keys := public._api_auth(p_key, 'insights:write');
    v_id uuid; v_created timestamptz;
begin
    if p_insight is null or jsonb_typeof(p_insight) <> 'object' then
        raise exception 'Body must be a JSON object' using errcode = 'PT400', detail = 'invalid_body';
    end if;
    if char_length(btrim(coalesce(p_insight->>'title', ''))) not between 1 and 200 then
        raise exception 'title is required (max 200 chars)' using errcode = 'PT400', detail = 'invalid_title';
    end if;
    if char_length(coalesce(p_insight->>'content', '')) not between 1 and 20000 then
        raise exception 'content is required (max 20000 chars)' using errcode = 'PT400', detail = 'invalid_content';
    end if;
    if coalesce(p_insight->>'category', 'general') not in ('general', 'tasks', 'finance', 'habits', 'schedule', 'health', 'career') then
        raise exception 'Invalid category' using errcode = 'PT400', detail = 'invalid_category';
    end if;
    if coalesce(p_insight->>'severity', 'info') not in ('info', 'suggestion', 'warning', 'critical') then
        raise exception 'Invalid severity. Use info|suggestion|warning|critical' using errcode = 'PT400', detail = 'invalid_severity';
    end if;
    if p_insight ? 'data' and octet_length((p_insight->'data')::text) > 50000 then
        raise exception 'data is too large (max 50KB)' using errcode = 'PT400', detail = 'data_too_large';
    end if;
    if (select count(*) from public.ai_advisor_logs where user_id = k.user_id and created_at > now() - interval '1 day') >= 200 then
        raise exception 'Too many insights in the last 24h' using errcode = 'PT429', detail = 'rate_limited';
    end if;

    insert into public.ai_advisor_logs (user_id, api_key_id, source, category, severity, title, content, data)
    values (k.user_id, k.id, k.name, coalesce(p_insight->>'category', 'general'), coalesce(p_insight->>'severity', 'info'),
            btrim(p_insight->>'title'), p_insight->>'content', p_insight->'data')
    returning id, created_at into v_id, v_created;

    return jsonb_build_object('id', v_id, 'created_at', v_created);
end;
$$;

-- GET /api/v1/ai/insights — để AI đọc lại các lời khuyên cũ, tránh lặp
create or replace function public.api_v1_list_insights(p_key text, p_limit int default 20, p_category text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
    k public.api_keys := public._api_auth(p_key, 'insights:read');
begin
    return (select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                'id', l.id, 'category', l.category, 'severity', l.severity, 'title', l.title,
                'content', l.content, 'is_read', l.is_read, 'source', l.source, 'created_at', l.created_at))
                order by l.created_at desc), '[]')
            from (select * from public.ai_advisor_logs
                  where user_id = k.user_id and (p_category is null or category = p_category)
                  order by created_at desc limit least(greatest(coalesce(p_limit, 20), 1), 100)) l);
end;
$$;

-- ---------------------------------------------------------------------
-- 5b. GIAO DỊCH (thêm / xem / xóa) — hành vi giống app: cập nhật số dư ví
-- ---------------------------------------------------------------------

-- GET /api/v1/finance/options — ví + danh mục hay dùng (để AI chọn đúng khi thêm giao dịch)
create or replace function public.api_v1_finance_options(p_key text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
    k public.api_keys := public._api_auth(p_key, 'finance:read');
begin
    return jsonb_build_object(
        'wallets', (select coalesce(jsonb_agg(jsonb_build_object('id', w.id, 'name', w.name, 'type', w.type, 'balance', w.balance) order by w.created_at), '[]')
                    from public.wallets w where w.user_id = k.user_id),
        'expense_categories', (select coalesce(jsonb_agg(c.category order by c.n desc), '[]') from (
                select category, count(*) n from public.transactions
                where user_id = k.user_id and type = 'expense' and public._api_is_real_tx(category) and category is not null
                  and date > current_date - 365
                group by category) c),
        'income_categories', (select coalesce(jsonb_agg(c.category order by c.n desc), '[]') from (
                select category, count(*) n from public.transactions
                where user_id = k.user_id and type = 'income' and public._api_is_real_tx(category) and category is not null
                  and date > current_date - 365
                group by category) c),
        'currency', (select coalesce(currency, 'VND') from public.profiles where id = k.user_id));
end;
$$;

-- GET /api/v1/finance/transactions — danh sách + TỔNG đã tính sẵn (AI không phải tự cộng)
create or replace function public.api_v1_list_transactions(
    p_key text,
    p_from date default null,
    p_to date default null,
    p_type text default null,
    p_category text default null,
    p_search text default null,
    p_limit int default 30,
    p_tz text default 'Asia/Ho_Chi_Minh'
)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
    k public.api_keys := public._api_auth(p_key, 'finance:read');
    v_today date := (now() at time zone public._api_tz(p_tz))::date;
    v_from date := coalesce(p_from, date_trunc('month', v_today)::date);
    v_to date := coalesce(p_to, v_today);
    v_res jsonb;
begin
    if p_type is not null and p_type not in ('income', 'expense') then
        raise exception 'type must be income or expense' using errcode = 'PT400', detail = 'invalid_type';
    end if;
    if v_to < v_from then
        raise exception 'to must be >= from' using errcode = 'PT400', detail = 'invalid_range';
    end if;
    p_limit := least(greatest(coalesce(p_limit, 30), 1), 200);

    with f as (
        select t.*, w.name as wallet_name
        from public.transactions t
        left join public.wallets w on w.id = t.wallet_id
        where t.user_id = k.user_id
          and t.date between v_from and v_to
          and (p_type is null or t.type = p_type)
          and (p_category is null or t.category ilike '%' || p_category || '%')
          and (p_search is null or t.description ilike '%' || p_search || '%' or t.category ilike '%' || p_search || '%')
    )
    select jsonb_build_object(
        'from', v_from, 'to', v_to,
        'summary', format('Từ %s đến %s: chi %s, thu %s (%s giao dịch, không tính "Điều chỉnh số dư").',
            to_char(v_from, 'DD/MM/YYYY'), to_char(v_to, 'DD/MM/YYYY'),
            public._api_vnd(coalesce(sum(amount) filter (where type = 'expense' and public._api_is_real_tx(category)), 0)),
            public._api_vnd(coalesce(sum(amount) filter (where type = 'income' and public._api_is_real_tx(category)), 0)),
            count(*) filter (where public._api_is_real_tx(category))),
        'total_expense', coalesce(sum(amount) filter (where type = 'expense' and public._api_is_real_tx(category)), 0),
        'total_income', coalesce(sum(amount) filter (where type = 'income' and public._api_is_real_tx(category)), 0),
        'count', count(*),
        'items', (select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                    'id', x.id, 'date', x.date, 'type', x.type, 'amount', x.amount, 'category', x.category,
                    'description', nullif(x.description, ''), 'wallet', x.wallet_name,
                    'is_balance_adjustment', case when not public._api_is_real_tx(x.category) then true end))
                    order by x.date desc, x.created_at desc), '[]')
                  from (select * from f order by date desc, created_at desc limit p_limit) x))
    into v_res
    from f;

    return v_res;
end;
$$;

-- POST /api/v1/finance/transactions
create or replace function public.api_v1_create_transaction(p_key text, p_tx jsonb, p_tz text default 'Asia/Ho_Chi_Minh')
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
    k public.api_keys := public._api_auth(p_key, 'finance:write');
    v_type text := lower(coalesce(p_tx->>'type', 'expense'));
    v_amount numeric;
    v_category text := btrim(coalesce(p_tx->>'category', ''));
    v_date date;
    v_wallet public.wallets;
    v_wallet_count int;
    v_tx public.transactions;
begin
    if p_tx is null or jsonb_typeof(p_tx) <> 'object' then
        raise exception 'Body must be a JSON object' using errcode = 'PT400', detail = 'invalid_body';
    end if;
    if v_type not in ('income', 'expense') then
        raise exception 'type must be income or expense' using errcode = 'PT400', detail = 'invalid_type';
    end if;
    begin
        v_amount := (p_tx->>'amount')::numeric;
    exception when others then
        v_amount := null;
    end;
    if v_amount is null or v_amount <= 0 or v_amount > 100000000000 then
        raise exception 'amount must be a positive number (VND, no separators), e.g. 45000' using errcode = 'PT400', detail = 'invalid_amount';
    end if;
    if char_length(v_category) < 1 or char_length(v_category) > 100 then
        raise exception 'category is required (use get_finance_options to see existing categories)' using errcode = 'PT400', detail = 'invalid_category';
    end if;
    if v_category = 'Điều chỉnh số dư' then
        raise exception 'Balance adjustments must be done in the app' using errcode = 'PT400', detail = 'invalid_category';
    end if;
    v_date := coalesce((p_tx->>'date')::date, (now() at time zone public._api_tz(p_tz))::date);
    if v_date > (now() at time zone public._api_tz(p_tz))::date + 366 then
        raise exception 'date is too far in the future' using errcode = 'PT400', detail = 'invalid_date';
    end if;
    if (select count(*) from public.transactions where user_id = k.user_id and created_at > now() - interval '1 hour') >= 100 then
        raise exception 'Too many transactions created in the last hour' using errcode = 'PT429', detail = 'rate_limited';
    end if;

    -- Chọn ví: theo id, theo tên, hoặc tự chọn nếu người dùng chỉ có 1 ví
    if coalesce(p_tx->>'wallet_id', '') <> '' then
        select * into v_wallet from public.wallets where id = (p_tx->>'wallet_id')::uuid and user_id = k.user_id for update;
        if not found then
            raise exception 'Wallet not found' using errcode = 'PT400', detail = 'invalid_wallet';
        end if;
    elsif coalesce(p_tx->>'wallet', '') <> '' then
        select * into v_wallet from public.wallets
        where user_id = k.user_id and lower(name) = lower(btrim(p_tx->>'wallet')) for update;
        if not found then
            raise exception 'Wallet "%" not found. Available: %', p_tx->>'wallet',
                (select string_agg(name, ', ') from public.wallets where user_id = k.user_id)
                using errcode = 'PT400', detail = 'invalid_wallet';
        end if;
    else
        select count(*) into v_wallet_count from public.wallets where user_id = k.user_id;
        if v_wallet_count = 1 then
            select * into v_wallet from public.wallets where user_id = k.user_id for update;
        elsif v_wallet_count > 1 then
            raise exception 'User has several wallets, ask which one: %',
                (select string_agg(name, ', ') from public.wallets where user_id = k.user_id)
                using errcode = 'PT400', detail = 'wallet_required';
        end if;
    end if;

    insert into public.transactions (user_id, amount, type, category, description, date, wallet_id)
    values (k.user_id, v_amount, v_type, v_category, coalesce(nullif(btrim(p_tx->>'description'), ''), ''), v_date, v_wallet.id)
    returning * into v_tx;

    if v_wallet.id is not null then
        update public.wallets
        set balance = coalesce(balance, 0) + case when v_type = 'income' then v_amount else -v_amount end
        where id = v_wallet.id
        returning * into v_wallet;
    end if;

    return jsonb_build_object(
        'id', v_tx.id, 'date', v_tx.date, 'type', v_tx.type, 'amount', v_tx.amount,
        'category', v_tx.category, 'description', v_tx.description,
        'wallet', v_wallet.name, 'wallet_balance_after', v_wallet.balance,
        'summary', format('Đã thêm %s %s (%s) ngày %s%s.',
            case when v_type = 'expense' then 'khoản chi' else 'khoản thu' end,
            public._api_vnd(v_amount), v_category, to_char(v_tx.date, 'DD/MM/YYYY'),
            case when v_wallet.id is not null then format(', ví %s còn %s', v_wallet.name, public._api_vnd(v_wallet.balance)) else '' end));
end;
$$;

-- DELETE /api/v1/finance/transactions/:id — hoàn tác số dư ví giống app
create or replace function public.api_v1_delete_transaction(p_key text, p_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
    k public.api_keys := public._api_auth(p_key, 'finance:write');
    v_tx public.transactions;
    v_wallet public.wallets;
begin
    select * into v_tx from public.transactions where id = p_id and user_id = k.user_id for update;
    if not found then
        raise exception 'Transaction not found' using errcode = 'PT404', detail = 'not_found';
    end if;
    if v_tx.debt_id is not null then
        raise exception 'This transaction belongs to a debt record; delete it in the app' using errcode = 'PT409', detail = 'linked_to_debt';
    end if;

    if v_tx.wallet_id is not null then
        update public.wallets
        set balance = coalesce(balance, 0) + case when v_tx.type = 'income' then -v_tx.amount else v_tx.amount end
        where id = v_tx.wallet_id and user_id = k.user_id
        returning * into v_wallet;
    end if;

    delete from public.transactions where id = v_tx.id;

    return jsonb_build_object(
        'deleted', v_tx.id,
        'summary', format('Đã xóa %s %s (%s) ngày %s%s.',
            case when v_tx.type = 'expense' then 'khoản chi' else 'khoản thu' end,
            public._api_vnd(v_tx.amount), v_tx.category, to_char(v_tx.date, 'DD/MM/YYYY'),
            case when v_wallet.id is not null then format(', ví %s còn %s', v_wallet.name, public._api_vnd(v_wallet.balance)) else '' end));
end;
$$;

-- ---------------------------------------------------------------------
-- 6. PHÂN QUYỀN EXECUTE
-- ---------------------------------------------------------------------
-- Hàm nội bộ: không ai gọi trực tiếp được qua REST
revoke execute on function public._api_allowed_scopes() from public, anon, authenticated;
revoke execute on function public._api_has_scope(text[], text) from public, anon, authenticated;
revoke execute on function public._api_auth(text, text) from public, anon, authenticated;
revoke execute on function public._api_tz(text) from public, anon, authenticated;
revoke execute on function public._api_priority_to_db(text) from public, anon, authenticated;
revoke execute on function public._api_priority_label(text) from public, anon, authenticated;
revoke execute on function public._api_task_json(public.todos) from public, anon, authenticated;
revoke execute on function public._api_task_brief(public.todos) from public, anon, authenticated;
revoke execute on function public._api_normalize_subtasks(jsonb) from public, anon, authenticated;
revoke execute on function public._api_recurring_next_due(int, text, date) from public, anon, authenticated;
revoke execute on function public._api_habit_streak(uuid, date) from public, anon, authenticated;

-- Quản lý key: chỉ user đã đăng nhập
revoke execute on function public.create_api_key(text, text[], int) from public, anon;
revoke execute on function public.revoke_api_key(uuid) from public, anon;
grant execute on function public.create_api_key(text, text[], int) to authenticated;
grant execute on function public.revoke_api_key(uuid) to authenticated;

-- API v1: Vercel gọi bằng anon key; bảo vệ bằng chính API key bên trong hàm
revoke execute on function public.api_v1_whoami(text) from public;
revoke execute on function public.api_v1_context(text, text) from public;
revoke execute on function public.api_v1_list_tasks(text, text[], text[], timestamptz, timestamptz, boolean, text, int, int) from public;
revoke execute on function public.api_v1_get_task(text, uuid) from public;
revoke execute on function public.api_v1_create_task(text, jsonb) from public;
revoke execute on function public.api_v1_update_task(text, uuid, jsonb) from public;
revoke execute on function public.api_v1_reorder_tasks(text, uuid[], text) from public;
revoke execute on function public.api_v1_finance_overview(text, text, text) from public;
revoke execute on function public.api_v1_create_insight(text, jsonb) from public;
revoke execute on function public.api_v1_list_insights(text, int, text) from public;

grant execute on function public.api_v1_whoami(text) to anon, authenticated;
grant execute on function public.api_v1_context(text, text) to anon, authenticated;
grant execute on function public.api_v1_list_tasks(text, text[], text[], timestamptz, timestamptz, boolean, text, int, int) to anon, authenticated;
grant execute on function public.api_v1_get_task(text, uuid) to anon, authenticated;
grant execute on function public.api_v1_create_task(text, jsonb) to anon, authenticated;
grant execute on function public.api_v1_update_task(text, uuid, jsonb) to anon, authenticated;
grant execute on function public.api_v1_reorder_tasks(text, uuid[], text) to anon, authenticated;
grant execute on function public.api_v1_finance_overview(text, text, text) to anon, authenticated;
grant execute on function public.api_v1_create_insight(text, jsonb) to anon, authenticated;
grant execute on function public.api_v1_list_insights(text, int, text) to anon, authenticated;

-- Bổ sung (giao dịch)
revoke execute on function public._api_vnd(numeric) from public, anon, authenticated;
revoke execute on function public._api_is_real_tx(text) from public, anon, authenticated;
revoke execute on function public.api_v1_finance_options(text) from public;
revoke execute on function public.api_v1_list_transactions(text, date, date, text, text, text, int, text) from public;
revoke execute on function public.api_v1_create_transaction(text, jsonb, text) from public;
revoke execute on function public.api_v1_delete_transaction(text, uuid) from public;
grant execute on function public.api_v1_finance_options(text) to anon, authenticated;
grant execute on function public.api_v1_list_transactions(text, date, date, text, text, text, int, text) to anon, authenticated;
grant execute on function public.api_v1_create_transaction(text, jsonb, text) to anon, authenticated;
grant execute on function public.api_v1_delete_transaction(text, uuid) to anon, authenticated;
