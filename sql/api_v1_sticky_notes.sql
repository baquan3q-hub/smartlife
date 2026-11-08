-- ==============================================================================
-- SmartLife API v1 — Sticky Notes cho AI bên ngoài (bot Telegram, MCP, REST sau này)
-- Yêu cầu: đã chạy sql/api_v1_external_ai.sql và sql/sticky_notes_schema.sql.
-- Chạy file này 1 lần trong Supabase SQL Editor. An toàn khi chạy lại.
--
-- Scope mới:
--   sticky:read   đọc / tìm ghi chú   (read:all KHÔNG bao gồm — phải cấp riêng vì ghi chú thường riêng tư)
--   sticky:write  tạo / sửa / lưu trữ / bỏ vào thùng rác (bao gồm cả sticky:read)
--
-- Các hàm là SECURITY DEFINER nên bỏ qua RLS → MỌI truy vấn đều phải lọc user_id = k.user_id.
-- Sửa nội dung đi qua trigger sticky_notes_before_update: tăng version + chụp lịch sử,
-- và Realtime sẽ đẩy thay đổi xuống app/web/Windows ngay.
-- ==============================================================================

-- 1. Scope ---------------------------------------------------------------------
create or replace function public._api_allowed_scopes()
returns text[] language sql immutable set search_path = '' as $$
    select array['read:all', 'context:read', 'tasks:read', 'tasks:write', 'finance:read', 'finance:write',
                 'insights:read', 'insights:write', 'sticky:read', 'sticky:write'];
$$;

create or replace function public._api_has_scope(p_scopes text[], p_needed text)
returns boolean language sql immutable set search_path = '' as $$
    select p_needed is null
        or p_needed = any(p_scopes)
        -- Ghi chú dán thường chứa nội dung riêng tư → read:all KHÔNG tự bao gồm sticky:read,
        -- để các key cũ không bị mở rộng quyền ngầm. Phải cấp sticky:read / sticky:write riêng.
        or (p_needed like '%:read' and p_needed <> 'sticky:read' and 'read:all' = any(p_scopes))
        or (p_needed = 'tasks:read' and 'tasks:write' = any(p_scopes))
        or (p_needed = 'finance:read' and 'finance:write' = any(p_scopes))
        or (p_needed = 'insights:read' and 'insights:write' = any(p_scopes))
        or (p_needed = 'sticky:read' and 'sticky:write' = any(p_scopes));
$$;

-- 2. JSON một ghi chú ------------------------------------------------------------
-- p_full = false: chỉ trả đoạn trích (danh sách) · true: trả toàn bộ nội dung Markdown
create or replace function public._api_sticky_json(n public.sticky_notes, p_full boolean default false)
returns jsonb language sql immutable set search_path = '' as $$
    select jsonb_strip_nulls(jsonb_build_object(
        'id', n.id,
        'title', n.title,
        'color', n.color,
        'labels', to_jsonb(n.labels),
        'is_pinned', n.is_pinned,
        'is_archived', n.is_archived,
        'in_trash', n.deleted_at is not null,
        'content_length', char_length(n.content),
        'version', n.version,
        'created_at', n.created_at,
        'updated_at', n.updated_at,
        'last_device', n.last_device
    ) || case
        when p_full then jsonb_build_object('content', n.content)
        else jsonb_build_object('snippet', left(regexp_replace(n.content, '\s+', ' ', 'g'), 200))
    end);
$$;

-- 3. Danh sách / tìm kiếm ------------------------------------------------------
-- p_state: active (mặc định) | archived | trash | all
create or replace function public.api_v1_list_sticky_notes(
    p_key text,
    p_search text default null,
    p_label text default null,
    p_state text default 'active',
    p_limit int default 20
)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
    k public.api_keys := public._api_auth(p_key, 'sticky:read');
    v_state text := coalesce(nullif(btrim(p_state), ''), 'active');
    v_search text := nullif(btrim(coalesce(p_search, '')), '');
    v_label text := nullif(btrim(coalesce(p_label, '')), '');
    v_total int;
    v_items jsonb := '[]'::jsonb;
    n public.sticky_notes;
begin
    if v_state not in ('active', 'archived', 'trash', 'all') then
        raise exception 'Invalid state. Use active|archived|trash|all' using errcode = 'PT400', detail = 'invalid_state';
    end if;

    select count(*) into v_total
    from public.sticky_notes c
    where c.user_id = k.user_id
      and (case v_state
            when 'active' then c.deleted_at is null and not c.is_archived
            when 'archived' then c.deleted_at is null and c.is_archived
            when 'trash' then c.deleted_at is not null
            else true end)
      and (v_label is null or v_label = any(c.labels))
      and (v_search is null or strpos(lower(c.title || ' ' || c.content), lower(v_search)) > 0);

    -- Vòng lặp (không dùng subquery) để mỗi dòng giữ đúng kiểu public.sticky_notes khi gọi _api_sticky_json
    for n in
        select * from public.sticky_notes s
        where s.user_id = k.user_id
          and (case v_state
                when 'active' then s.deleted_at is null and not s.is_archived
                when 'archived' then s.deleted_at is null and s.is_archived
                when 'trash' then s.deleted_at is not null
                else true end)
          and (v_label is null or v_label = any(s.labels))
          and (v_search is null or strpos(lower(s.title || ' ' || s.content), lower(v_search)) > 0)
        order by s.is_pinned desc, s.updated_at desc
        limit least(greatest(coalesce(p_limit, 20), 1), 100)
    loop
        v_items := v_items || jsonb_build_array(public._api_sticky_json(n));
    end loop;

    return jsonb_build_object(
        'total', v_total,
        'returned', jsonb_array_length(v_items),
        'notes', v_items,
        'summary', format('%s ghi chú khớp, trả về %s (mới sửa gần nhất trước, ghim lên đầu).', v_total, jsonb_array_length(v_items)));
end;
$$;

-- 4. Đọc đầy đủ một ghi chú (kể cả ghi chú trong thùng rác, để có thể khôi phục) --------
create or replace function public.api_v1_get_sticky_note(p_key text, p_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
    k public.api_keys := public._api_auth(p_key, 'sticky:read');
    n public.sticky_notes;
begin
    select * into n from public.sticky_notes where id = p_id and user_id = k.user_id;
    if not found then
        raise exception 'Sticky note not found' using errcode = 'PT404', detail = 'not_found';
    end if;
    return public._api_sticky_json(n, true);
end;
$$;

-- 5. Chuẩn hoá nhãn: bỏ rỗng/trùng, tối đa 10 nhãn, mỗi nhãn ≤ 30 ký tự --------------------
create or replace function public._api_sticky_labels(p_labels jsonb)
returns text[]
language plpgsql immutable set search_path = '' as $$
declare
    v_out text[];
begin
    if jsonb_typeof(p_labels) is distinct from 'array' then
        raise exception 'labels must be an array of strings' using errcode = 'PT400', detail = 'invalid_labels';
    end if;
    if exists (select 1 from jsonb_array_elements(p_labels) e where jsonb_typeof(e) <> 'string') then
        raise exception 'labels must be an array of strings' using errcode = 'PT400', detail = 'invalid_labels';
    end if;

    select coalesce(array_agg(l order by first_pos), array[]::text[])
    into v_out
    from (
        select btrim(e #>> '{}') as l, min(o) as first_pos
        from jsonb_array_elements(p_labels) with ordinality as t(e, o)
        where btrim(e #>> '{}') <> ''
        group by btrim(e #>> '{}')
    ) x;

    if cardinality(v_out) > 10 then
        raise exception 'At most 10 labels' using errcode = 'PT400', detail = 'too_many_labels';
    end if;
    if exists (select 1 from unnest(v_out) l where char_length(l) > 30) then
        raise exception 'Each label must be at most 30 characters' using errcode = 'PT400', detail = 'label_too_long';
    end if;
    return v_out;
end;
$$;

-- 6. Tạo ghi chú ---------------------------------------------------------------
create or replace function public.api_v1_create_sticky_note(p_key text, p_note jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
    k public.api_keys := public._api_auth(p_key, 'sticky:write');
    v_title text;
    v_content text;
    v_color text;
    v_pinned boolean := false;
    v_labels text[] := array[]::text[];
    n public.sticky_notes;
begin
    if p_note is null or jsonb_typeof(p_note) <> 'object' then
        raise exception 'Body must be a JSON object' using errcode = 'PT400', detail = 'invalid_body';
    end if;

    if jsonb_typeof(p_note->'title') not in ('string', 'null') or jsonb_typeof(p_note->'content') not in ('string', 'null')
       or jsonb_typeof(p_note->'color') not in ('string', 'null') then
        raise exception 'title, content and color must be strings' using errcode = 'PT400', detail = 'invalid_body';
    end if;

    v_title := btrim(coalesce(p_note->>'title', ''));
    v_content := coalesce(p_note->>'content', '');
    v_color := coalesce(p_note->>'color', 'yellow');

    if v_title = '' and btrim(v_content) = '' then
        raise exception 'Provide a title or content' using errcode = 'PT400', detail = 'empty_note';
    end if;
    if char_length(v_title) > 200 then
        raise exception 'title is too long (max 200 chars)' using errcode = 'PT400', detail = 'invalid_title';
    end if;
    if char_length(v_content) > 50000 then
        raise exception 'content is too long (max 50000 chars)' using errcode = 'PT400', detail = 'content_too_long';
    end if;
    if v_color not in ('yellow', 'green', 'pink', 'purple', 'blue', 'gray', 'charcoal') then
        raise exception 'Invalid color. Use yellow|green|pink|purple|blue|gray|charcoal' using errcode = 'PT400', detail = 'invalid_color';
    end if;
    if p_note ? 'labels' then
        v_labels := public._api_sticky_labels(p_note->'labels');
    end if;
    if p_note ? 'is_pinned' then
        if jsonb_typeof(p_note->'is_pinned') <> 'boolean' then
            raise exception 'is_pinned must be a boolean' using errcode = 'PT400', detail = 'invalid_body';
        end if;
        v_pinned := (p_note->>'is_pinned')::boolean;
    end if;

    if (select count(*) from public.sticky_notes where user_id = k.user_id and created_at > now() - interval '1 day') >= 200 then
        raise exception 'Too many notes created in the last 24h' using errcode = 'PT429', detail = 'rate_limited';
    end if;

    insert into public.sticky_notes (user_id, title, content, color, labels, is_pinned, last_device)
    values (k.user_id, v_title, v_content, v_color, v_labels, v_pinned, 'bot')
    returning * into n;

    return public._api_sticky_json(n) || jsonb_build_object(
        'summary', format('Đã tạo ghi chú "%s".', coalesce(nullif(n.title, ''), left(n.content, 40))));
end;
$$;

-- 7. Sửa ghi chú ---------------------------------------------------------------
-- Các trường (chỉ gửi trường cần đổi):
--   title, content (GHI ĐÈ toàn bộ), append (nối thêm vào cuối, nguyên tử), color, labels,
--   is_pinned, is_archived, in_trash (true = bỏ vào thùng rác 30 ngày, false = khôi phục),
--   expected_version (nếu lệch version hiện tại → 409, tránh ghi đè bản vừa được sửa ở thiết bị khác)
create or replace function public.api_v1_update_sticky_note(p_key text, p_id uuid, p_patch jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
    k public.api_keys := public._api_auth(p_key, 'sticky:write');
    n public.sticky_notes;
    v_key text;
    v_title text;
    v_content text;
    v_color text;
    v_labels text[];
    v_append text;
begin
    if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
        raise exception 'Body must be a JSON object' using errcode = 'PT400', detail = 'invalid_body';
    end if;
    for v_key in select jsonb_object_keys(p_patch) loop
        if v_key <> all (array['title', 'content', 'append', 'color', 'labels', 'is_pinned', 'is_archived', 'in_trash', 'expected_version']) then
            raise exception 'Unknown field: %', v_key using errcode = 'PT400', detail = 'unknown_field';
        end if;
    end loop;
    if p_patch ? 'content' and p_patch ? 'append' then
        raise exception 'Use either content (replace) or append, not both' using errcode = 'PT400', detail = 'invalid_body';
    end if;

    select * into n from public.sticky_notes where id = p_id and user_id = k.user_id for update;
    if not found then
        raise exception 'Sticky note not found' using errcode = 'PT404', detail = 'not_found';
    end if;

    if p_patch ? 'expected_version' then
        if jsonb_typeof(p_patch->'expected_version') <> 'number' then
            raise exception 'expected_version must be a number' using errcode = 'PT400', detail = 'invalid_body';
        end if;
        if (p_patch->>'expected_version')::numeric <> n.version then
            raise exception 'Note was changed elsewhere (current version %). Read it again before editing.', n.version
                using errcode = 'PT409', detail = 'version_conflict';
        end if;
    end if;

    v_title := n.title; v_content := n.content; v_color := n.color; v_labels := n.labels;

    if p_patch ? 'title' then
        if jsonb_typeof(p_patch->'title') <> 'string' then
            raise exception 'title must be a string' using errcode = 'PT400', detail = 'invalid_body';
        end if;
        v_title := btrim(p_patch->>'title');
        if char_length(v_title) > 200 then
            raise exception 'title is too long (max 200 chars)' using errcode = 'PT400', detail = 'invalid_title';
        end if;
    end if;

    if p_patch ? 'content' then
        if jsonb_typeof(p_patch->'content') <> 'string' then
            raise exception 'content must be a string' using errcode = 'PT400', detail = 'invalid_body';
        end if;
        v_content := p_patch->>'content';
    elsif p_patch ? 'append' then
        if jsonb_typeof(p_patch->'append') <> 'string' then
            raise exception 'append must be a string' using errcode = 'PT400', detail = 'invalid_body';
        end if;
        v_append := p_patch->>'append';
        if btrim(v_append) = '' then
            raise exception 'append is empty' using errcode = 'PT400', detail = 'empty_append';
        end if;
        -- Nối sau một dấu xuống dòng; muốn đoạn mới cách một dòng trống thì bắt đầu append bằng "\n"
        v_content := case when btrim(n.content) = '' then v_append
                          else regexp_replace(n.content, '\n+$', '') || E'\n' || v_append end;
    end if;
    if char_length(v_content) > 50000 then
        raise exception 'content would exceed 50000 chars' using errcode = 'PT400', detail = 'content_too_long';
    end if;

    if p_patch ? 'color' then
        v_color := p_patch->>'color';
        if jsonb_typeof(p_patch->'color') <> 'string' or v_color not in ('yellow', 'green', 'pink', 'purple', 'blue', 'gray', 'charcoal') then
            raise exception 'Invalid color. Use yellow|green|pink|purple|blue|gray|charcoal' using errcode = 'PT400', detail = 'invalid_color';
        end if;
    end if;
    if p_patch ? 'labels' then
        v_labels := public._api_sticky_labels(p_patch->'labels');
    end if;
    if exists (select 1 from jsonb_each(p_patch) e
               where e.key in ('is_pinned', 'is_archived', 'in_trash') and jsonb_typeof(e.value) <> 'boolean') then
        raise exception 'is_pinned, is_archived and in_trash must be booleans' using errcode = 'PT400', detail = 'invalid_body';
    end if;

    if v_title = '' and btrim(v_content) = '' and not coalesce((p_patch->>'in_trash')::boolean, false) then
        raise exception 'A note cannot be empty. Use in_trash to delete it' using errcode = 'PT400', detail = 'empty_note';
    end if;

    update public.sticky_notes s
    set title = v_title,
        content = v_content,
        color = v_color,
        labels = v_labels,
        is_pinned = coalesce((p_patch->>'is_pinned')::boolean, s.is_pinned),
        is_archived = coalesce((p_patch->>'is_archived')::boolean, s.is_archived),
        deleted_at = case when p_patch ? 'in_trash'
                          then (case when (p_patch->>'in_trash')::boolean then coalesce(s.deleted_at, now()) else null end)
                          else s.deleted_at end,
        last_device = 'bot'
    where s.id = n.id and s.user_id = k.user_id
    returning * into n;

    return public._api_sticky_json(n) || jsonb_build_object(
        'summary', format('Đã cập nhật ghi chú "%s" (v%s).', coalesce(nullif(n.title, ''), left(n.content, 40)), n.version));
end;
$$;

-- 8. Phân quyền EXECUTE -------------------------------------------------------------
revoke execute on function public._api_sticky_json(public.sticky_notes, boolean) from public, anon, authenticated;
revoke execute on function public._api_sticky_labels(jsonb) from public, anon, authenticated;
revoke execute on function public.api_v1_list_sticky_notes(text, text, text, text, int) from public;
revoke execute on function public.api_v1_get_sticky_note(text, uuid) from public;
revoke execute on function public.api_v1_create_sticky_note(text, jsonb) from public;
revoke execute on function public.api_v1_update_sticky_note(text, uuid, jsonb) from public;

grant execute on function public.api_v1_list_sticky_notes(text, text, text, text, int) to anon, authenticated;
grant execute on function public.api_v1_get_sticky_note(text, uuid) to anon, authenticated;
grant execute on function public.api_v1_create_sticky_note(text, jsonb) to anon, authenticated;
grant execute on function public.api_v1_update_sticky_note(text, uuid, jsonb) to anon, authenticated;
