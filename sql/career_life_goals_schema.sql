-- file: sql/career_life_goals_schema.sql
-- Schema cho tính năng Mục tiêu Nghề nghiệp (Career Goals) & Mục tiêu 5 năm (Life Goals)

-- 1. Bảng career_positions: Lưu trữ các vị trí nghề nghiệp mục tiêu của người dùng
CREATE TABLE IF NOT EXISTS career_positions (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title         VARCHAR(200) NOT NULL,                            -- Ví dụ: "IT Business Analyst", "Data Analyst"
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Index tối ưu tìm kiếm theo user_id
CREATE INDEX IF NOT EXISTS idx_career_positions_user ON career_positions(user_id);

-- 2. Bảng career_goals: Lưu trữ các mục tiêu/kỹ năng chi tiết cho mỗi vị trí
CREATE TABLE IF NOT EXISTS career_goals (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  position_id     UUID REFERENCES career_positions(id) ON DELETE CASCADE NOT NULL,
  title           VARCHAR(300) NOT NULL,                          -- Tên kỹ năng, công cụ, dự án...
  description     TEXT,                                           -- Mô tả chi tiết
  link            VARCHAR(500),                                   -- Link đính kèm
  category        VARCHAR(50) NOT NULL CHECK (category IN ('technical', 'domain', 'soft', 'project', 'tool', 'certificate')),
  priority        VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  status          VARCHAR(30) DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'overdue')),
  start_date      DATE,                                           -- Ngày bắt đầu
  deadline        DATE,                                           -- Ngày hết hạn dự kiến
  progress        INT DEFAULT 0 CHECK (progress BETWEEN 0 AND 100), -- Tiến độ hoàn thành (0 - 100)
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Index tối ưu tìm kiếm
CREATE INDEX IF NOT EXISTS idx_career_goals_user ON career_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_career_goals_position ON career_goals(position_id);
CREATE INDEX IF NOT EXISTS idx_career_goals_category ON career_goals(user_id, category);

-- 3. Bảng life_goals: Lưu trữ các mục tiêu dài hạn 5 năm của người dùng
CREATE TABLE IF NOT EXISTS life_goals (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  icon          VARCHAR(50) NOT NULL,                             -- Icon emoji hoặc tên icon
  title         VARCHAR(300) NOT NULL,                            -- Tên mục tiêu (Ví dụ: "Có xe", "Cưới vợ")
  target_year   INT NOT NULL,                                     -- Năm dự kiến (Ví dụ: 2028, 2030)
  is_achieved   BOOLEAN DEFAULT false,                            -- Trạng thái đạt được
  sort_order    INT DEFAULT 0,                                    -- Thứ tự sắp xếp drag-and-drop
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Index tối ưu tìm kiếm
CREATE INDEX IF NOT EXISTS idx_life_goals_user ON life_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_life_goals_order ON life_goals(user_id, sort_order ASC);

-- 4. Bật Row Level Security (RLS) bảo vệ dữ liệu riêng tư
ALTER TABLE career_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE life_goals ENABLE ROW LEVEL SECURITY;

-- 5. Tạo các RLS Policy cho career_positions
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'career_positions' AND policyname = 'Users can CRUD own career positions'
    ) THEN
        CREATE POLICY "Users can CRUD own career positions"
          ON career_positions FOR ALL
          USING (auth.uid() = user_id)
          WITH CHECK (auth.uid() = user_id);
    END IF;
END
$$;

-- 6. Tạo các RLS Policy cho career_goals
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'career_goals' AND policyname = 'Users can CRUD own career goals'
    ) THEN
        CREATE POLICY "Users can CRUD own career goals"
          ON career_goals FOR ALL
          USING (auth.uid() = user_id)
          WITH CHECK (auth.uid() = user_id);
    END IF;
END
$$;

-- 7. Tạo các RLS Policy cho life_goals
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'life_goals' AND policyname = 'Users can CRUD own life goals'
    ) THEN
        CREATE POLICY "Users can CRUD own life goals"
          ON life_goals FOR ALL
          USING (auth.uid() = user_id)
          WITH CHECK (auth.uid() = user_id);
    END IF;
END
$$;
