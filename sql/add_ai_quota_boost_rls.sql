-- File: sql/add_ai_quota_boost_rls.sql
-- Kích hoạt RLS và thiết lập chính sách truy cập (Policies) cho bảng user_ai_quota và user_ai_boost
-- Chạy toàn bộ trong Supabase SQL Editor nếu gặp lỗi RLS khi xác nhận đơn hàng hoặc sử dụng AI.

-- 1. Thiết lập chính sách cho user_ai_quota
ALTER TABLE user_ai_quota ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users select own quota" ON user_ai_quota;
CREATE POLICY "Users select own quota" ON user_ai_quota
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert/update own quota" ON user_ai_quota;
CREATE POLICY "Users insert/update own quota" ON user_ai_quota
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin access all quota" ON user_ai_quota;
CREATE POLICY "Admin access all quota" ON user_ai_quota
  FOR ALL USING (auth.email() = 'baquan3q@gmail.com');

-- 2. Thiết lập chính sách cho user_ai_boost
ALTER TABLE user_ai_boost ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users select own boost" ON user_ai_boost;
CREATE POLICY "Users select own boost" ON user_ai_boost
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin access all boost" ON user_ai_boost;
CREATE POLICY "Admin access all boost" ON user_ai_boost
  FOR ALL USING (auth.email() = 'baquan3q@gmail.com');
