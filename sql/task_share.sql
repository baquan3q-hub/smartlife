-- ==============================================================================
-- SmartLife — Chia sẻ task bằng link công khai (chỉ xem)
-- Chạy file này 1 lần trong Supabase SQL Editor. An toàn khi chạy lại.
--
-- Thiết kế:
--   * Mỗi task có tối đa 1 link chia sẻ (task_shares, unique todo_id). Tắt chia sẻ = xoá dòng.
--   * Link "sống": người xem luôn thấy dữ liệu mới nhất của task.
--   * Người chưa đăng nhập đọc qua hàm get_shared_task(token) (security definer):
--     chỉ trả các trường nằm trong danh sách cho phép, tôn trọng các cờ show_*.
--     KHÔNG bao giờ trả user_id, id Google, cấu hình email nhắc việc...
--   * Token = 2 UUID v4 ghép lại (~244 bit ngẫu nhiên), không đoán được.
-- ==============================================================================

-- 1. Bảng chia sẻ ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.task_shares (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT NOT NULL UNIQUE
    DEFAULT (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  todo_id UUID NOT NULL UNIQUE REFERENCES public.todos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  show_description BOOLEAN NOT NULL DEFAULT TRUE,
  show_subtasks BOOLEAN NOT NULL DEFAULT TRUE,
  show_deadline BOOLEAN NOT NULL DEFAULT TRUE,
  show_links BOOLEAN NOT NULL DEFAULT TRUE,
  show_owner BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at TIMESTAMPTZ,                        -- NULL = không hết hạn
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_shares_user ON public.task_shares(user_id);

-- 2. RLS: chủ sở hữu quản lý link của mình ------------------------------------------
ALTER TABLE public.task_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "task_shares_select_own" ON public.task_shares;
DROP POLICY IF EXISTS "task_shares_insert_own" ON public.task_shares;
DROP POLICY IF EXISTS "task_shares_update_own" ON public.task_shares;
DROP POLICY IF EXISTS "task_shares_delete_own" ON public.task_shares;

CREATE POLICY "task_shares_select_own" ON public.task_shares
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Chỉ được chia sẻ task của chính mình
CREATE POLICY "task_shares_insert_own" ON public.task_shares
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.todos t WHERE t.id = todo_id AND t.user_id = auth.uid())
  );

CREATE POLICY "task_shares_update_own" ON public.task_shares
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "task_shares_delete_own" ON public.task_shares
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Không cho client tự đổi token / todo_id / số lượt xem (đổi token = tắt rồi bật lại)
REVOKE UPDATE ON public.task_shares FROM authenticated;
GRANT UPDATE (show_description, show_subtasks, show_deadline, show_links, show_owner, expires_at, updated_at)
  ON public.task_shares TO authenticated;
REVOKE ALL ON public.task_shares FROM anon;

-- 3. Hàm công khai cho người xem -------------------------------------------------------
-- Luôn trả jsonb: { ok: false, reason: 'not_found' | 'expired' }  hoặc  { ok: true, task: {...} }
CREATE OR REPLACE FUNCTION public.get_shared_task(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  s public.task_shares;
  t public.todos;
  v_owner TEXT;
BEGIN
  -- Chặn token rác sớm (không tốn query)
  IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  SELECT * INTO s FROM public.task_shares WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF s.expires_at IS NOT NULL AND s.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;

  SELECT * INTO t FROM public.todos WHERE id = s.todo_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  -- Đếm lượt xem (không tính chính chủ)
  IF auth.uid() IS DISTINCT FROM s.user_id THEN
    UPDATE public.task_shares SET view_count = view_count + 1 WHERE id = s.id;
  END IF;

  IF s.show_owner THEN
    SELECT NULLIF(btrim(full_name), '') INTO v_owner FROM public.profiles WHERE id = s.user_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'task', jsonb_strip_nulls(jsonb_build_object(
      'title', t.content,
      'status', COALESCE(t.status, CASE WHEN t.is_completed THEN 'done' ELSE 'todo' END),
      'priority', t.priority,
      'completed_at', t.completed_at,
      'description', CASE WHEN s.show_description THEN t.description END,
      'subtasks', CASE WHEN s.show_subtasks THEN COALESCE(t.subtasks, '[]'::jsonb) END,
      'deadline', CASE WHEN s.show_deadline THEN t.deadline END,
      'attach_link', CASE WHEN s.show_links THEN t.attach_link END,
      'owner_name', v_owner,
      'updated_at', s.updated_at,
      'expires_at', s.expires_at
    ))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_shared_task(TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.get_shared_task(TEXT) TO anon, authenticated;
