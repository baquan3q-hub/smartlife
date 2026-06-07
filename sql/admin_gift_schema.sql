-- ============================================
-- SmartLife Admin Gift & Notifications — SQL Schema
-- Chạy toàn bộ trong Supabase SQL Editor
-- ============================================

-- 1. Bảng log admin gift actions
CREATE TABLE IF NOT EXISTS admin_gift_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID NOT NULL, -- auth.uid() của admin
  admin_email TEXT NOT NULL, -- Email admin để tiện truy vết
  target_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  action_type TEXT NOT NULL, -- 'extend_pro', 'gift_trial', 'gift_pro', 'upgrade_lifetime', 'downgrade_free'
  days_granted INTEGER CHECK (days_granted IS NULL OR days_granted <= 365),
  old_plan TEXT,
  new_plan TEXT,
  old_expiry TIMESTAMPTZ,
  new_expiry TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Bảng in-app notifications cho users
CREATE TABLE IF NOT EXISTS user_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL, -- 'gift_pro', 'extend_pro', 'system', 'promo'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE admin_gift_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies cho admin_gift_logs
-- Admin mới xem và cập nhật được
DROP POLICY IF EXISTS "Admin select all gift logs" ON admin_gift_logs;
CREATE POLICY "Admin select all gift logs" ON admin_gift_logs
  FOR SELECT USING (auth.email() = 'baquan3q@gmail.com');

DROP POLICY IF EXISTS "Admin insert gift logs" ON admin_gift_logs;
CREATE POLICY "Admin insert gift logs" ON admin_gift_logs
  FOR INSERT WITH CHECK (auth.email() = 'baquan3q@gmail.com');

-- 4. RLS Policies cho user_notifications
-- Users xem được thông báo của chính mình
DROP POLICY IF EXISTS "Users select own notifications" ON user_notifications;
CREATE POLICY "Users select own notifications" ON user_notifications
  FOR SELECT USING (auth.uid() = user_id);

-- Users cập nhật thông báo của chính mình (đọc/chưa đọc)
DROP POLICY IF EXISTS "Users update own notifications" ON user_notifications;
CREATE POLICY "Users update own notifications" ON user_notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Admin tạo được thông báo cho bất kỳ user nào
DROP POLICY IF EXISTS "Admin insert notifications" ON user_notifications;
CREATE POLICY "Admin insert notifications" ON user_notifications
  FOR INSERT WITH CHECK (auth.email() = 'baquan3q@gmail.com');

-- 5. Bật Realtime cho user_notifications
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE user_notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 6. Hàm xoá vĩnh viễn user dành cho Admin
CREATE OR REPLACE FUNCTION delete_user_by_admin(target_user_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
BEGIN
  -- Chỉ Admin mới được thực hiện
  IF auth.email() != 'baquan3q@gmail.com' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Xoá ở profiles trước
  DELETE FROM public.profiles WHERE id = target_user_id;

  -- Xoá trong auth.users
  DELETE FROM auth.users WHERE id = target_user_id;
  
  RETURN TRUE;
END;
$$;

