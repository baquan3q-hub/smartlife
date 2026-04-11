-- ============================================
-- SmartLife Pro Subscription — SQL Schema
-- Chạy toàn bộ trong Supabase SQL Editor
-- ============================================

-- 1. Thêm cột subscription vào profiles
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS pro_expiry_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ;

-- 2. Tạo bảng subscription_orders
CREATE TABLE IF NOT EXISTS subscription_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  plan_type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',
  transfer_content TEXT NOT NULL,
  invoice_expires_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  confirmed_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE subscription_orders ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies cho subscription_orders

-- Users có thể tạo đơn hàng của mình
DROP POLICY IF EXISTS "Users insert own orders" ON subscription_orders;
CREATE POLICY "Users insert own orders" ON subscription_orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users có thể xem đơn hàng của mình
DROP POLICY IF EXISTS "Users select own orders" ON subscription_orders;
CREATE POLICY "Users select own orders" ON subscription_orders
  FOR SELECT USING (auth.uid() = user_id);

-- Admin xem tất cả đơn hàng
DROP POLICY IF EXISTS "Admin select all orders" ON subscription_orders;
CREATE POLICY "Admin select all orders" ON subscription_orders
  FOR SELECT USING (auth.email() = 'baquan3q@gmail.com');

-- Admin cập nhật đơn hàng (xác nhận)
DROP POLICY IF EXISTS "Admin update all orders" ON subscription_orders;
CREATE POLICY "Admin update all orders" ON subscription_orders
  FOR UPDATE USING (auth.email() = 'baquan3q@gmail.com');

-- 5. RLS cho profiles (đảm bảo user cập nhật được plan của mình)
DROP POLICY IF EXISTS "Users update own profile plan" ON profiles;
CREATE POLICY "Users update own profile plan" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- 6. Bật Realtime cho subscription_orders
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE subscription_orders;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 7. Set trial cho tất cả user hiện tại — tính từ ngày tạo tài khoản
UPDATE profiles p
SET plan = 'trial', trial_started_at = u.created_at
FROM auth.users u
WHERE p.id = u.id
  AND (p.plan IS NULL OR p.plan = '' OR p.plan = 'free')
  AND p.trial_started_at IS NULL;

-- 8. CẬP NHẬT HÀM: Lấy dữ liệu user cho Admin (Đã bao gồm thông tin gói Subscription)
-- Postgres bắt buộc DROP trước khi sửa Return Type (Thêm cột)
DROP FUNCTION IF EXISTS get_admin_users();

CREATE OR REPLACE FUNCTION get_admin_users()
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  last_active_at TIMESTAMPTZ,
  profile_updated_at TIMESTAMPTZ,
  user_created_at TIMESTAMPTZ,
  user_updated_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ,
  plan TEXT,
  pro_expiry_date TIMESTAMPTZ,
  trial_started_at TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Chỉ Admin mới được thực thi hàm này (Nhập email cấu hình Admin của bạn)
  IF auth.email() != 'baquan3q@gmail.com' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  RETURN QUERY
  SELECT
    p.id,
    u.email::TEXT,
    p.full_name,
    p.avatar_url,
    p.last_active_at,
    p.updated_at as profile_updated_at,
    u.created_at as user_created_at,
    u.updated_at as user_updated_at,
    u.last_sign_in_at,
    p.plan,
    p.pro_expiry_date,
    p.trial_started_at
  FROM profiles p
  LEFT JOIN auth.users u ON p.id = u.id
  ORDER BY u.created_at DESC;
END;
$$;

