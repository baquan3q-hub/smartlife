-- ========================================================
-- SỬA LỖI RLS CHO QUOTA VÀ BOOST TOKENS (CHẠY TRÊN SUPABASE)
-- ========================================================

-- 1. Cấu hình RLS cho bảng user_ai_quota (Ghi nhận lượt chat hàng ngày)
ALTER TABLE user_ai_quota ENABLE ROW LEVEL SECURITY;

-- Cho phép User xem quota của mình
DROP POLICY IF EXISTS "Users select own quota" ON user_ai_quota;
CREATE POLICY "Users select own quota" ON user_ai_quota
  FOR SELECT USING (auth.uid() = user_id);

-- Tách biệt chính sách INSERT và UPDATE để giải quyết lỗi Upsert RLS của Postgres
DROP POLICY IF EXISTS "Users insert/update own quota" ON user_ai_quota;
DROP POLICY IF EXISTS "Users insert own quota" ON user_ai_quota;
DROP POLICY IF EXISTS "Users update own quota" ON user_ai_quota;

CREATE POLICY "Users insert own quota" ON user_ai_quota
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own quota" ON user_ai_quota
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Quyền Admin
DROP POLICY IF EXISTS "Admin access all quota" ON user_ai_quota;
CREATE POLICY "Admin access all quota" ON user_ai_quota
  FOR ALL USING (auth.email() = 'baquan3q@gmail.com');


-- 2. Cấu hình RLS cho bảng user_ai_boost (Các gói mua thêm token)
ALTER TABLE user_ai_boost ENABLE ROW LEVEL SECURITY;

-- Cho phép User xem gói boost của mình
DROP POLICY IF EXISTS "Users select own boost" ON user_ai_boost;
CREATE POLICY "Users select own boost" ON user_ai_boost
  FOR SELECT USING (auth.uid() = user_id);

-- BẮT BUỘC: Cho phép User cập nhật gói boost của mình (để trừ token khi dùng vượt hạn mức ngày)
DROP POLICY IF EXISTS "Users update own boost" ON user_ai_boost;
CREATE POLICY "Users update own boost" ON user_ai_boost
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Quyền Admin
DROP POLICY IF EXISTS "Admin access all boost" ON user_ai_boost;
CREATE POLICY "Admin access all boost" ON user_ai_boost
  FOR ALL USING (auth.email() = 'baquan3q@gmail.com');
