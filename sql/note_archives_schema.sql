-- ==============================================================================
-- Bảng lưu trữ bộ nhớ ghi chú cá nhân (Note Archive Hub)
-- Cho phép lưu trữ dài hạn, đa nhãn phân loại, ngày tháng và tìm kiếm toàn diện
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.note_archives (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL DEFAULT 'Ghi chú',
  content TEXT NOT NULL,
  labels TEXT[] DEFAULT ARRAY['Work']::TEXT[], -- 'Work', 'University', 'Reminder', 'Learning', 'ToDo-List', 'Ideas'
  note_date DATE DEFAULT CURRENT_DATE NOT NULL,
  is_pinned BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Đánh Index để tối ưu hóa truy vấn theo user, ngày tháng, nhãn và ghim
CREATE INDEX IF NOT EXISTS idx_note_archives_user_date ON public.note_archives(user_id, note_date DESC);
CREATE INDEX IF NOT EXISTS idx_note_archives_user_labels ON public.note_archives USING GIN(labels);
CREATE INDEX IF NOT EXISTS idx_note_archives_user_pinned ON public.note_archives(user_id, is_pinned);
CREATE INDEX IF NOT EXISTS idx_note_archives_created_at ON public.note_archives(user_id, created_at DESC);

-- Bật Row Level Security (RLS) để đảm bảo an toàn dữ liệu riêng tư 100%
ALTER TABLE public.note_archives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own note archives"
  ON public.note_archives FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own note archives"
  ON public.note_archives FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own note archives"
  ON public.note_archives FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own note archives"
  ON public.note_archives FOR DELETE
  USING (auth.uid() = user_id);
