-- ====================================================================
-- SUPABASE DATABASE SCHEMA MIGRATION: EMAIL DEADLINE NOTIFICATIONS
-- SmartLife App v2
-- Date: 2026-06-22
-- ====================================================================

-- 1. Bổ sung cấu hình email notifications cho profiles (JSONB)
-- Chứa: { "enabled": false, "todo_deadline": true, "timetable_deadline": true, "calendar_deadline": true, "hours_before": 1 }
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS 
    email_notifications JSONB DEFAULT '{"enabled": false, "todo_deadline": true, "timetable_deadline": true, "calendar_deadline": true, "hours_before": 1}'::jsonb;

-- 2. Bổ sung các cột chọn email cho từng bảng dữ liệu
-- Bảng Todos
ALTER TABLE todos ADD COLUMN IF NOT EXISTS email_notify BOOLEAN DEFAULT false;
ALTER TABLE todos ADD COLUMN IF NOT EXISTS email_notify_before_minutes INTEGER DEFAULT 60;

-- Bảng Calendar Events (Sự kiện lịch cá nhân)
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS email_notify BOOLEAN DEFAULT false;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS email_notify_before_minutes INTEGER DEFAULT 60;

-- Bảng Timetable (Thời khóa biểu cố định)
ALTER TABLE timetable ADD COLUMN IF NOT EXISTS email_notify BOOLEAN DEFAULT false;
ALTER TABLE timetable ADD COLUMN IF NOT EXISTS email_notify_before_minutes INTEGER DEFAULT 60;

-- 3. Tạo bảng lưu trữ logs để chống gửi trùng email
CREATE TABLE IF NOT EXISTS email_notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL,           -- 'todo' | 'timetable' | 'calendar_event'
    source_id TEXT NOT NULL,             -- ID của bản ghi gốc
    notification_type TEXT NOT NULL,     -- 'deadline' hoặc 'timetable_YYYY-MM-DD'
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    email_to TEXT NOT NULL,
    status TEXT DEFAULT 'pending',       -- 'pending' | 'sent' | 'failed'
    UNIQUE(user_id, source_type, source_id, notification_type)
);

-- Kích hoạt Row Level Security (RLS) cho logs
ALTER TABLE email_notification_logs ENABLE ROW LEVEL SECURITY;

-- Tạo policy cho phép người dùng xem log của chính mình
DROP POLICY IF EXISTS "Users can view their own email logs" ON email_notification_logs;
CREATE POLICY "Users can view their own email logs" ON email_notification_logs
    FOR SELECT USING (auth.uid() = user_id);

-- Tạo policy cho phép người dùng thêm log mới (bắt buộc cho client-side)
DROP POLICY IF EXISTS "Users can insert their own email logs" ON email_notification_logs;
CREATE POLICY "Users can insert their own email logs" ON email_notification_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Tạo policy cho phép cập nhật (dự phòng, thực tế Edge Function chạy bằng service_role bypass RLS)
DROP POLICY IF EXISTS "Users can update their own email logs" ON email_notification_logs;
CREATE POLICY "Users can update their own email logs" ON email_notification_logs
    FOR UPDATE USING (auth.uid() = user_id);

-- Index tối ưu hóa tìm kiếm nhanh
CREATE INDEX IF NOT EXISTS idx_email_noti_logs_lookup ON email_notification_logs(user_id, source_type, source_id);

-- 4. Tạo SQL Function để quét các sự kiện sắp đến deadline
CREATE OR REPLACE FUNCTION check_deadline_notifications()
RETURNS TABLE (
    log_id UUID,
    user_id UUID,
    email_to TEXT,
    source_type TEXT,
    source_id TEXT,
    title TEXT,
    deadline TIMESTAMPTZ,
    minutes_left INTEGER
) AS $$
BEGIN
    -- [A] Quét Todos sắp đến hạn
    -- Điều kiện: Chưa hoàn thành, bật email_notify, deadline trong khoảng (now() tới now() + email_notify_before_minutes)
    -- Chưa ghi nhận gửi trước đó trong email_notification_logs
    RETURN QUERY
    INSERT INTO email_notification_logs (user_id, source_type, source_id, notification_type, email_to, status)
    SELECT 
        t.user_id,
        'todo'::text,
        t.id::text,
        'deadline'::text,
        p.email,
        'pending'::text
    FROM todos t
    JOIN profiles p ON p.id = t.user_id
    WHERE t.is_completed = false
      AND t.deadline IS NOT NULL
      -- Kiểm tra global toggle hoặc local toggle
      AND (
          (t.email_notify = true) OR 
          ((p.email_notifications->>'enabled')::boolean = true AND (p.email_notifications->>'todo_deadline')::boolean = true)
      )
      AND t.deadline > now()
      AND t.deadline <= now() + (COALESCE(t.email_notify_before_minutes, 60) || ' minutes')::interval
      AND NOT EXISTS (
          SELECT 1 FROM email_notification_logs enl 
          WHERE enl.source_id = t.id::text
            AND enl.source_type = 'todo'
            AND enl.notification_type = 'deadline'
      )
    RETURNING 
        id, 
        user_id, 
        email_to, 
        source_type, 
        source_id,
        (SELECT content FROM todos WHERE id::text = source_id) AS title,
        (SELECT deadline FROM todos WHERE id::text = source_id) AS deadline,
        (SELECT EXTRACT(EPOCH FROM (deadline - now()))/60 FROM todos WHERE id::text = source_id)::integer AS minutes_left;

    -- [B] Quét Calendar Events sắp diễn ra
    RETURN QUERY
    INSERT INTO email_notification_logs (user_id, source_type, source_id, notification_type, email_to, status)
    SELECT 
        ce.user_id,
        'calendar_event'::text,
        ce.id::text,
        'deadline'::text,
        p.email,
        'pending'::text
    FROM calendar_events ce
    JOIN profiles p ON p.id = ce.user_id
    WHERE ce.date IS NOT NULL
      AND (
          (ce.email_notify = true) OR 
          ((p.email_notifications->>'enabled')::boolean = true AND (p.email_notifications->>'calendar_deadline')::boolean = true)
      )
      -- Kết hợp date và time thành timestamptz
      AND (ce.date::text || COALESCE(' ' || ce.time::text, ' 00:00:00'))::timestamptz > now()
      AND (ce.date::text || COALESCE(' ' || ce.time::text, ' 00:00:00'))::timestamptz <= now() + (COALESCE(ce.email_notify_before_minutes, 60) || ' minutes')::interval
      AND NOT EXISTS (
          SELECT 1 FROM email_notification_logs enl 
          WHERE enl.source_id = ce.id::text
            AND enl.source_type = 'calendar_event'
            AND enl.notification_type = 'deadline'
      )
    RETURNING 
        id, 
        user_id, 
        email_to, 
        source_type, 
        source_id,
        (SELECT title FROM calendar_events WHERE id::text = source_id) AS title,
        (SELECT (date::text || COALESCE(' ' || time::text, ' 00:00:00'))::timestamptz FROM calendar_events WHERE id::text = source_id) AS deadline,
        (SELECT EXTRACT(EPOCH FROM ((date::text || COALESCE(' ' || time::text, ' 00:00:00'))::timestamptz - now()))/60 FROM calendar_events WHERE id::text = source_id)::integer AS minutes_left;

    -- [C] Quét Lịch biểu cố định (Timetable) lặp lại
    RETURN QUERY
    INSERT INTO email_notification_logs (user_id, source_type, source_id, notification_type, email_to, status)
    SELECT 
        tt.user_id,
        'timetable'::text,
        tt.id::text,
        ('timetable_' || to_char(now(), 'YYYY-MM-DD'))::text, -- Chỉ gửi 1 lần mỗi ngày cụ thể
        p.email,
        'pending'::text
    FROM timetable tt
    JOIN profiles p ON p.id = tt.user_id
    WHERE tt.day_of_week = EXTRACT(dow FROM now())::integer
      AND (
          (tt.email_notify = true) OR 
          ((p.email_notifications->>'enabled')::boolean = true AND (p.email_notifications->>'timetable_deadline')::boolean = true)
      )
      -- So sánh giờ phút bắt đầu
      AND (to_char(now(), 'YYYY-MM-DD') || ' ' || tt.start_time)::timestamptz > now()
      AND (to_char(now(), 'YYYY-MM-DD') || ' ' || tt.start_time)::timestamptz <= now() + (COALESCE(tt.email_notify_before_minutes, 60) || ' minutes')::interval
      AND NOT EXISTS (
          SELECT 1 FROM email_notification_logs enl 
          WHERE enl.source_id = tt.id::text
            AND enl.source_type = 'timetable'
            AND enl.notification_type = ('timetable_' || to_char(now(), 'YYYY-MM-DD'))::text
      )
    RETURNING 
        id, 
        user_id, 
        email_to, 
        source_type, 
        source_id,
        (SELECT title FROM timetable WHERE id::text = source_id) AS title,
        (SELECT (to_char(now(), 'YYYY-MM-DD') || ' ' || start_time)::timestamptz FROM timetable WHERE id::text = source_id) AS deadline,
        (SELECT EXTRACT(EPOCH FROM ((to_char(now(), 'YYYY-MM-DD') || ' ' || start_time)::timestamptz - now()))/60 FROM timetable WHERE id::text = source_id)::integer AS minutes_left;
END;
$$ LANGUAGE plpgsql;

-- 5. Hướng dẫn thiết lập tự động hóa qua pg_cron trên Supabase
-- Để chạy background cron job gửi email mỗi 15 phút, người dùng cần chạy các lệnh sau trong Supabase SQL Editor:
-- 
-- step 5a. Bật extension pg_cron nếu chưa bật (Có thể cần quyền superuser hoặc bật qua UI Database -> Extensions)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
--
-- step 5b. Thiết lập lịch gọi quét deadline tự động
-- SELECT cron.schedule(
--     'smartlife-deadline-scanner',
--     '*/15 * * * *',  -- Chạy mỗi 15 phút
--     $$ SELECT check_deadline_notifications(); $$
-- );
--
-- step 5c. Hủy lịch nếu cần
-- SELECT cron.unschedule('smartlife-deadline-scanner');
