-- ==============================================================================
-- SmartLife Sticky Notes
-- Ghi chú dán đa nền tảng (Web · Mobile · Windows) + lịch sử phiên bản + Realtime
-- Chạy file này 1 lần trong Supabase SQL Editor. An toàn khi chạy lại.
-- ==============================================================================

-- 1. Bảng ghi chú ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sticky_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT 'yellow',          -- yellow | green | pink | purple | blue | gray | charcoal
  labels TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,                         -- xoá mềm (thùng rác)
  sort_order INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  last_device TEXT,                               -- web | mobile | desktop
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sticky_notes_user_updated
  ON public.sticky_notes(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_sticky_notes_user_state
  ON public.sticky_notes(user_id, is_archived, deleted_at);
CREATE INDEX IF NOT EXISTS idx_sticky_notes_labels
  ON public.sticky_notes USING GIN(labels);

-- 2. Bảng lịch sử phiên bản ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sticky_note_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id UUID REFERENCES public.sticky_notes(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT 'yellow',
  version INTEGER NOT NULL,
  device TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sticky_note_versions_note
  ON public.sticky_note_versions(note_id, created_at DESC);

-- 3. Trigger: tăng version, cập nhật updated_at, chụp snapshot ------------------
-- Snapshot nội dung CŨ khi title/content thay đổi, tối đa 1 bản / 5 phút / note
-- (client tự lưu sau mỗi lần ngừng gõ nên không thể lưu mọi lần).
CREATE OR REPLACE FUNCTION public.sticky_notes_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Không cho đổi chủ sở hữu
  NEW.user_id := OLD.user_id;
  NEW.updated_at := now();

  IF NEW.title IS DISTINCT FROM OLD.title OR NEW.content IS DISTINCT FROM OLD.content THEN
    NEW.version := OLD.version + 1;

    IF (OLD.title <> '' OR OLD.content <> '') AND NOT EXISTS (
      SELECT 1 FROM public.sticky_note_versions v
      WHERE v.note_id = OLD.id
        AND v.created_at > now() - INTERVAL '5 minutes'
    ) THEN
      INSERT INTO public.sticky_note_versions (note_id, user_id, title, content, color, version, device)
      VALUES (OLD.id, OLD.user_id, OLD.title, OLD.content, OLD.color, OLD.version, OLD.last_device);
    END IF;
  ELSE
    NEW.version := OLD.version;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sticky_notes_before_update ON public.sticky_notes;
CREATE TRIGGER trg_sticky_notes_before_update
  BEFORE UPDATE ON public.sticky_notes
  FOR EACH ROW EXECUTE FUNCTION public.sticky_notes_before_update();

-- Giữ tối đa 50 phiên bản gần nhất cho mỗi note
CREATE OR REPLACE FUNCTION public.sticky_note_versions_trim()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.sticky_note_versions
  WHERE note_id = NEW.note_id
    AND id NOT IN (
      SELECT id FROM public.sticky_note_versions
      WHERE note_id = NEW.note_id
      ORDER BY created_at DESC
      LIMIT 50
    );
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sticky_note_versions_trim ON public.sticky_note_versions;
CREATE TRIGGER trg_sticky_note_versions_trim
  AFTER INSERT ON public.sticky_note_versions
  FOR EACH ROW EXECUTE FUNCTION public.sticky_note_versions_trim();

-- 4. Row Level Security --------------------------------------------------------
ALTER TABLE public.sticky_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sticky_note_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sticky_notes_select_own" ON public.sticky_notes;
DROP POLICY IF EXISTS "sticky_notes_insert_own" ON public.sticky_notes;
DROP POLICY IF EXISTS "sticky_notes_update_own" ON public.sticky_notes;
DROP POLICY IF EXISTS "sticky_notes_delete_own" ON public.sticky_notes;

CREATE POLICY "sticky_notes_select_own" ON public.sticky_notes
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "sticky_notes_insert_own" ON public.sticky_notes
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sticky_notes_update_own" ON public.sticky_notes
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sticky_notes_delete_own" ON public.sticky_notes
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "sticky_note_versions_select_own" ON public.sticky_note_versions;
DROP POLICY IF EXISTS "sticky_note_versions_insert_own" ON public.sticky_note_versions;
DROP POLICY IF EXISTS "sticky_note_versions_delete_own" ON public.sticky_note_versions;

CREATE POLICY "sticky_note_versions_select_own" ON public.sticky_note_versions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "sticky_note_versions_insert_own" ON public.sticky_note_versions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sticky_note_versions_delete_own" ON public.sticky_note_versions
  FOR DELETE USING (auth.uid() = user_id);

-- 5. Realtime --------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'sticky_notes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sticky_notes;
  END IF;
END $$;
