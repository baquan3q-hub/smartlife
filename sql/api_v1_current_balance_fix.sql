-- Chạy file này trong Supabase SQL Editor để bot Telegram đọc đúng "Số dư khả dụng" (khớp app)
-- và biết biến động / điều chỉnh số dư 30 ngày gần nhất. Nội dung đã gộp vào api_v1_external_ai.sql.

create or replace function public._api_vnd_signed(p numeric)
returns text language sql immutable set search_path = '' as $$
    select case when p > 0 then '+' else '' end || public._api_vnd(p);
$$;

create or replace function public._api_balance_snapshot(p_uid uuid, p_today date, p_days int default 30)
returns jsonb language plpgsql stable set search_path = '' as $$
declare
    v_days int := least(greatest(coalesce(p_days, 30), 1), 365);
    v_from date := p_today - (v_days - 1);
    v_current numeric; v_before numeric; v_income numeric; v_expense numeric;
    v_adj_net numeric; v_adj_count int; v_wallets_total numeric; v_wallets_text text;
begin
    select coalesce(sum(case t.type when 'income' then t.amount when 'expense' then -t.amount else 0 end), 0),
           coalesce(sum(case t.type when 'income' then t.amount when 'expense' then -t.amount else 0 end) filter (where t.date < v_from), 0),
           coalesce(sum(t.amount) filter (where t.type = 'income' and t.date >= v_from and public._api_is_real_tx(t.category)), 0),
           coalesce(sum(t.amount) filter (where t.type = 'expense' and t.date >= v_from and public._api_is_real_tx(t.category)), 0),
           coalesce(sum(case t.type when 'income' then t.amount else -t.amount end) filter (where t.date >= v_from and not public._api_is_real_tx(t.category)), 0),
           count(*) filter (where t.date >= v_from and not public._api_is_real_tx(t.category))
    into v_current, v_before, v_income, v_expense, v_adj_net, v_adj_count
    from public.transactions t where t.user_id = p_uid;

    select coalesce(sum(w.balance) filter (where coalesce(w.include_in_total, true)), 0),
           string_agg(format('%s %s', w.name, public._api_vnd(w.balance)), ', ' order by w.balance desc)
    into v_wallets_total, v_wallets_text
    from public.wallets w where w.user_id = p_uid;

    return jsonb_build_object(
        'summary', format(
            'SỐ DƯ KHẢ DỤNG HIỆN TẠI (khớp ô "Số dư khả dụng" trong app): %s. '
            '%s ngày qua (%s–%s): thu %s, chi %s, điều chỉnh số dư %s lần (ròng %s); số dư %s ngày trước là %s, thay đổi %s. '
            'Tiền trong ví: %s — đây là số dư riêng từng ví, KHÔNG phải số dư khả dụng.',
            public._api_vnd(v_current),
            v_days, to_char(v_from, 'DD/MM'), to_char(p_today, 'DD/MM/YYYY'),
            public._api_vnd(v_income), public._api_vnd(v_expense), v_adj_count, public._api_vnd_signed(v_adj_net),
            v_days, public._api_vnd(v_before), public._api_vnd_signed(v_current - v_before),
            coalesce(v_wallets_text, 'chưa có ví')),
        'current_balance', v_current,
        'wallets_total', v_wallets_total,
        'wallets', (select coalesce(jsonb_agg(jsonb_build_object('name', w.name, 'type', w.type, 'balance', w.balance,
                                                                 'in_total', coalesce(w.include_in_total, true)) order by w.balance desc), '[]')
                    from public.wallets w where w.user_id = p_uid),
        'last_n_days', jsonb_build_object(
            'days', v_days, 'from', v_from, 'to', p_today,
            'balance_at_start', v_before,
            'balance_change', v_current - v_before,
            'income', v_income,
            'expense', v_expense,
            'adjustment_count', v_adj_count,
            'adjustment_net', v_adj_net,
            -- Các lần người dùng bấm "Điều chỉnh số dư" trong app
            'balance_adjustments', (select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                    'date', a.date,
                    'change', case when a.type = 'income' then a.amount else -a.amount end,
                    'change_text', public._api_vnd_signed(case when a.type = 'income' then a.amount else -a.amount end),
                    'note', nullif(a.description, '')))
                    order by a.date desc, a.created_at desc), '[]')
                from (select * from public.transactions where user_id = p_uid and date >= v_from
                      and not public._api_is_real_tx(category) order by date desc, created_at desc limit 20) a),
            -- Giao dịch được nhập/cập nhật gần nhất (theo thời điểm tạo)
            'latest_entries', (select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                    'id', r.id, 'date', r.date, 'type', r.type, 'amount', r.amount, 'category', r.category,
                    'description', nullif(r.description, ''),
                    'is_balance_adjustment', case when not public._api_is_real_tx(r.category) then true end))
                    order by r.created_at desc), '[]')
                from (select * from public.transactions where user_id = p_uid
                      and (date >= v_from or created_at >= p_today - v_days)
                      order by created_at desc limit 10) r)));
end;
$$;

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
    v_upcoming jsonb; v_upcoming_expense numeric; v_snapshot jsonb;
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
    v_snapshot := public._api_balance_snapshot(uid, v_today, 30);
    v_balance := (v_snapshot->>'current_balance')::numeric;
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
        'summary', format('Số dư khả dụng hiện tại: %s. Tháng %s (đến ngày %s/%s): ĐÃ CHI %s, đã thu %s%s. Dự báo nếu giữ nhịp chi hiện tại: khoảng %s cả tháng.',
            public._api_vnd(v_balance),
            to_char(v_today, 'MM/YYYY'), v_day, v_days_in_month,
            public._api_vnd(v_expense), public._api_vnd(v_income),
            case when coalesce(v_budget, 0) > 0
                 then format(', ngân sách %s (đã dùng %s%%)', public._api_vnd(v_budget), round(v_expense * 100 / v_budget, 1)) else '' end,
            public._api_vnd(v_projected)),
        'month', v_month,
        -- Số dư khả dụng (khớp app) + tiền từng ví + biến động / điều chỉnh 30 ngày gần nhất
        'balance', v_snapshot,
        'current_balance', v_balance,
        'wallets_total', v_snapshot->'wallets_total',
        'wallets', v_snapshot->'wallets',
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
    v_recurring jsonb; v_rec_in numeric; v_rec_out numeric; v_snapshot jsonb;
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
    v_snapshot := public._api_balance_snapshot(uid, v_today, 30);
    v_balance := (v_snapshot->>'current_balance')::numeric;

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
        'summary', format('Tháng %s: ĐÃ CHI %s, đã thu %s, chênh lệch %s%s. Tháng trước chi %s. Số dư khả dụng hiện tại: %s.',
            to_char(v_m_start, 'MM/YYYY'), public._api_vnd(v_expense), public._api_vnd(v_income), public._api_vnd(v_income - v_expense),
            case when coalesce(v_budget, 0) > 0
                 then format(', ngân sách %s (đã dùng %s%%, còn %s)', public._api_vnd(v_budget), round(v_expense * 100 / v_budget, 1), public._api_vnd(v_budget - v_expense)) else '' end,
            public._api_vnd(v_prev_expense), public._api_vnd(v_balance)),
        'balance', v_snapshot,
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
            'current_balance', v_balance,
            'recurring', v_recurring,
            'remaining_recurring_income_this_month', case when v_is_current then v_rec_in end,
            'remaining_recurring_expense_this_month', case when v_is_current then v_rec_out end,
            'projected_balance_end_of_month', case when v_is_current then v_balance + v_rec_in - v_rec_out end),
        'wallets', v_snapshot->'wallets',
        'debts', (select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('partner', partner_name, 'type', type, 'amount', amount,
                          'remaining', remaining_amount, 'due_date', due_date, 'status', status)) order by due_date nulls last), '[]')
                  from public.debts where user_id = uid and status <> 'paid'));
end;
$$;

create or replace function public.api_v1_balance(p_key text, p_days int default 30, p_tz text default 'Asia/Ho_Chi_Minh')
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
    k public.api_keys := public._api_auth(p_key, 'finance:read');
begin
    return public._api_balance_snapshot(k.user_id, (now() at time zone public._api_tz(p_tz))::date, p_days);
end;
$$;

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
    v_balance numeric;
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

    select coalesce(sum(case type when 'income' then amount when 'expense' then -amount else 0 end), 0)
    into v_balance from public.transactions where user_id = k.user_id;

    return jsonb_build_object(
        'id', v_tx.id, 'date', v_tx.date, 'type', v_tx.type, 'amount', v_tx.amount,
        'category', v_tx.category, 'description', v_tx.description,
        'wallet', v_wallet.name, 'wallet_balance_after', v_wallet.balance,
        'current_balance_after', v_balance,
        'summary', format('Đã thêm %s %s (%s) ngày %s. Số dư khả dụng còn %s%s.',
            case when v_type = 'expense' then 'khoản chi' else 'khoản thu' end,
            public._api_vnd(v_amount), v_category, to_char(v_tx.date, 'DD/MM/YYYY'),
            public._api_vnd(v_balance),
            case when v_wallet.id is not null then format(' (riêng ví %s: %s)', v_wallet.name, public._api_vnd(v_wallet.balance)) else '' end));
end;
$$;

create or replace function public.api_v1_delete_transaction(p_key text, p_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
    k public.api_keys := public._api_auth(p_key, 'finance:write');
    v_tx public.transactions;
    v_wallet public.wallets;
    v_balance numeric;
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

    select coalesce(sum(case type when 'income' then amount when 'expense' then -amount else 0 end), 0)
    into v_balance from public.transactions where user_id = k.user_id;

    return jsonb_build_object(
        'deleted', v_tx.id,
        'current_balance_after', v_balance,
        'summary', format('Đã xóa %s %s (%s) ngày %s. Số dư khả dụng còn %s%s.',
            case when v_tx.type = 'expense' then 'khoản chi' else 'khoản thu' end,
            public._api_vnd(v_tx.amount), v_tx.category, to_char(v_tx.date, 'DD/MM/YYYY'),
            public._api_vnd(v_balance),
            case when v_wallet.id is not null then format(' (riêng ví %s: %s)', v_wallet.name, public._api_vnd(v_wallet.balance)) else '' end));
end;
$$;

-- Bổ sung (số dư)
revoke execute on function public._api_vnd_signed(numeric) from public, anon, authenticated;
revoke execute on function public._api_balance_snapshot(uuid, date, int) from public, anon, authenticated;
revoke execute on function public.api_v1_balance(text, int, text) from public;
grant execute on function public.api_v1_balance(text, int, text) to anon, authenticated;
