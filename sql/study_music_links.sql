-- =====================================================
-- Study Music Links — Lưu link nhạc YouTube cá nhân
-- cho không gian học tập (MusicSpace)
-- =====================================================

CREATE TABLE IF NOT EXISTS study_music_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Chill Study',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE study_music_links ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only manage their own links
CREATE POLICY "Users manage own music links"
  ON study_music_links FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Performance index
CREATE INDEX IF NOT EXISTS idx_study_music_user_category
  ON study_music_links(user_id, category);
