-- file: sql/journal_schema.sql
-- Schema cho tính năng Nhật ký (Journal) & Mood Tracker của SmartLife

-- 1. Bảng journal_entries: Lưu nội dung nhật ký, cảm xúc, biết ơn theo từng ngày
CREATE TABLE IF NOT EXISTS journal_entries (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  entry_date    DATE NOT NULL,                    -- Ngày viết nhật ký (định dạng YYYY-MM-DD)
  content       TEXT NOT NULL DEFAULT '',          -- Nội dung chính (hỗ trợ định dạng Markdown)
  mood          SMALLINT CHECK (mood BETWEEN 1 AND 5),  -- 1=Rất tệ, 2=Tệ, 3=Bình thường, 4=Tốt, 5=Tuyệt vời
  gratitude     JSONB DEFAULT '[]',               -- Danh sách tối đa 3 điều biết ơn
  word_count    INT DEFAULT 0,                    -- Số lượng từ
  is_favorite   BOOLEAN DEFAULT false,            -- Đánh dấu bài viết yêu thích
  writing_prompt TEXT,                            -- Câu hỏi gợi ý đã dùng
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, entry_date)                     -- Một người dùng chỉ có 1 bài viết cho mỗi ngày
);

-- Index tối ưu tìm kiếm và sắp xếp theo ngày
CREATE INDEX IF NOT EXISTS idx_journal_user_date ON journal_entries(user_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_journal_mood ON journal_entries(user_id, mood) WHERE mood IS NOT NULL;

-- 2. Bảng journal_tags: Lưu trữ các tag băm liên kết với bài nhật ký
CREATE TABLE IF NOT EXISTS journal_tags (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  entry_id      UUID REFERENCES journal_entries(id) ON DELETE CASCADE NOT NULL,
  tag           TEXT NOT NULL,                    -- Tag dưới dạng chữ thường (Ví dụ: "hoctap", "love")
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Index tối ưu tìm kiếm theo tag
CREATE INDEX IF NOT EXISTS idx_journal_tags_user ON journal_tags(user_id, tag);
CREATE INDEX IF NOT EXISTS idx_journal_tags_entry ON journal_tags(entry_id);

-- 3. Bật Row Level Security (RLS) bảo vệ dữ liệu riêng tư
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_tags ENABLE ROW LEVEL SECURITY;

-- 4. Tạo các RLS Policy cho journal_entries
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'journal_entries' AND policyname = 'Users can CRUD own journal entries'
    ) THEN
        CREATE POLICY "Users can CRUD own journal entries"
          ON journal_entries FOR ALL
          USING (auth.uid() = user_id)
          WITH CHECK (auth.uid() = user_id);
    END IF;
END
$$;

-- 5. Tạo các RLS Policy cho journal_tags
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'journal_tags' AND policyname = 'Users can CRUD own journal tags'
    ) THEN
        CREATE POLICY "Users can CRUD own journal tags"
          ON journal_tags FOR ALL
          USING (auth.uid() = user_id)
          WITH CHECK (auth.uid() = user_id);
    END IF;
END
$$;
