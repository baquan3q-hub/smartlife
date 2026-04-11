-- ================================================================
-- GPA Calculator — Database Schema
-- Quy chế ĐHQGHN 2022
-- Chạy trên Supabase SQL Editor
-- ================================================================

-- ────────────────────────────────────────
-- 1. Bảng gpa_semesters (Học kỳ)
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gpa_semesters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                    -- "Học kỳ 1", "Học kỳ 2", "Học hè"
  academic_year TEXT NOT NULL,           -- "2024-2025"
  semester_type TEXT NOT NULL DEFAULT 'HK1'  -- "HK1" | "HK2" | "HocHe"
    CHECK (semester_type IN ('HK1', 'HK2', 'HocHe')),
  year_of_study INTEGER NOT NULL DEFAULT 1
    CHECK (year_of_study >= 1 AND year_of_study <= 6),
  is_current BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index cho query performance
CREATE INDEX IF NOT EXISTS idx_gpa_semesters_user_id ON gpa_semesters(user_id);
CREATE INDEX IF NOT EXISTS idx_gpa_semesters_academic_year ON gpa_semesters(academic_year);

-- ────────────────────────────────────────
-- 2. Bảng gpa_courses (Môn học)
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gpa_courses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  semester_id UUID NOT NULL REFERENCES gpa_semesters(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                    -- Tên môn học
  credits INTEGER NOT NULL DEFAULT 3
    CHECK (credits >= 1 AND credits <= 10),
  template TEXT NOT NULL DEFAULT 'A'     -- Template điểm: "A" | "B" | "C"
    CHECK (template IN ('A', 'B', 'C')),
  
  -- Điểm thành phần (nullable — chưa nhập = NULL)
  score_cc1 REAL CHECK (score_cc1 IS NULL OR (score_cc1 >= 0 AND score_cc1 <= 10)),
  score_cc2 REAL CHECK (score_cc2 IS NULL OR (score_cc2 >= 0 AND score_cc2 <= 10)),
  score_cc3 REAL CHECK (score_cc3 IS NULL OR (score_cc3 >= 0 AND score_cc3 <= 10)),
  score_final REAL CHECK (score_final IS NULL OR (score_final >= 0 AND score_final <= 10)),
  
  -- Flags
  exclude_from_gpa BOOLEAN DEFAULT false,  -- Không tính GPA (GDTC, GDQP-AN...)
  is_conditional BOOLEAN DEFAULT false,    -- Học phần điều kiện
  retake_of UUID REFERENCES gpa_courses(id) ON DELETE SET NULL,  -- Môn học lại
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes cho performance
CREATE INDEX IF NOT EXISTS idx_gpa_courses_user_id ON gpa_courses(user_id);
CREATE INDEX IF NOT EXISTS idx_gpa_courses_semester_id ON gpa_courses(semester_id);

-- ────────────────────────────────────────
-- 3. Row Level Security (RLS)
-- ────────────────────────────────────────

-- Enable RLS
ALTER TABLE gpa_semesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE gpa_courses ENABLE ROW LEVEL SECURITY;

-- Policies cho gpa_semesters: Mỗi user chỉ quản lý dữ liệu của mình
CREATE POLICY "Users can view own semesters"
  ON gpa_semesters FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own semesters"
  ON gpa_semesters FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own semesters"
  ON gpa_semesters FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own semesters"
  ON gpa_semesters FOR DELETE
  USING (auth.uid() = user_id);

-- Policies cho gpa_courses: Mỗi user chỉ quản lý dữ liệu của mình
CREATE POLICY "Users can view own courses"
  ON gpa_courses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own courses"
  ON gpa_courses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own courses"
  ON gpa_courses FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own courses"
  ON gpa_courses FOR DELETE
  USING (auth.uid() = user_id);

-- ────────────────────────────────────────
-- 4. Trigger tự cập nhật updated_at
-- ────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger cho gpa_semesters
DROP TRIGGER IF EXISTS trigger_update_gpa_semesters_updated_at ON gpa_semesters;
CREATE TRIGGER trigger_update_gpa_semesters_updated_at
  BEFORE UPDATE ON gpa_semesters
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger cho gpa_courses
DROP TRIGGER IF EXISTS trigger_update_gpa_courses_updated_at ON gpa_courses;
CREATE TRIGGER trigger_update_gpa_courses_updated_at
  BEFORE UPDATE ON gpa_courses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ════════════════════════════════════════
-- ✅ HOÀN TẤT
-- Chạy file này trong Supabase SQL Editor
-- Tables: gpa_semesters, gpa_courses
-- RLS: Enabled với policies per-user
-- Indexes: user_id, semester_id, academic_year
-- ════════════════════════════════════════
