-- ====================================================================
-- SUPABASE DATABASE SCHEMA MIGRATION: CAREER INTELLIGENCE SYSTEM
-- SmartLife App v2
-- Date: 2026-06-07
-- ====================================================================

-- 1. Bổ sung cột 'major' (Ngành học) vào bảng profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS major TEXT;

-- 2. Tạo bảng lưu trữ kết quả phân tích nghề nghiệp bằng AI (Cache 7 ngày)
CREATE TABLE IF NOT EXISTS career_analysis_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  results JSONB NOT NULL,
  input_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Index cho quick lookup theo user
CREATE INDEX IF NOT EXISTS idx_career_analysis_user ON career_analysis_cache(user_id);

-- 3. Tạo bảng lưu trữ thông tin CV Builder
CREATE TABLE IF NOT EXISTS cv_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  personal_info JSONB DEFAULT '{}',
  objective TEXT DEFAULT '',
  education JSONB DEFAULT '[]',
  experience JSONB DEFAULT '[]',
  projects JSONB DEFAULT '[]',
  skills JSONB DEFAULT '[]',
  certificates JSONB DEFAULT '[]',
  activities JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

-- Đảm bảo mỗi user chỉ có duy nhất 1 CV
CREATE UNIQUE INDEX IF NOT EXISTS idx_cv_data_user ON cv_data(user_id);

-- 4. Kích hoạt Row Level Security (RLS) để bảo mật thông tin CV của từng user
ALTER TABLE cv_data ENABLE ROW LEVEL SECURITY;

-- Tạo policy cho phép người dùng CRUD trên CV chính họ
CREATE POLICY "Users can manage their own CV" ON cv_data
  FOR ALL USING (auth.uid() = user_id);
