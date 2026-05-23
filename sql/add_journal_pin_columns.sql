-- file: sql/add_journal_pin_columns.sql
-- Thêm các trường bảo mật mã PIN vào bảng profiles cho tính năng khóa Nhật ký

-- 1. Thêm cột lưu mã PIN (được hash SHA-256) và số lần thử sai
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS journal_pin TEXT, 
  ADD COLUMN IF NOT EXISTS journal_pin_attempts INT DEFAULT 0;

-- 2. CẬP NHẬT HÀM get_admin_users():
-- Admin cần đọc được thông tin mã PIN (đã hash) và số lần thử sai để có thể thực hiện Reset.
-- Postgres bắt buộc DROP trước khi sửa Return Type (do cấu trúc bảng trả về thay đổi).
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
  trial_started_at TIMESTAMPTZ,
  journal_pin TEXT,
  journal_pin_attempts INT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Chỉ Admin mới được thực thi hàm này (Thay email admin của bạn nếu cần)
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
    p.trial_started_at,
    p.journal_pin,
    p.journal_pin_attempts
  FROM profiles p
  LEFT JOIN auth.users u ON p.id = u.id
  ORDER BY u.created_at DESC;
END;
$$;
