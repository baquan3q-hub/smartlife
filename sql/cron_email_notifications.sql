-- ====================================================================
-- SUPABASE DATABASE MIGRATION: CRON EMAIL NOTIFICATION IMPROVEMENTS
-- SmartLife App v2.1
-- Date: 2026-06-26
-- Purpose: Fix notification timing + add default_before_minutes support
-- ====================================================================

-- 1. Update profile email_notifications default to include default_before_minutes
ALTER TABLE profiles ALTER COLUMN email_notifications 
    SET DEFAULT '{"enabled": false, "todo_deadline": true, "timetable_deadline": true, "calendar_deadline": true, "hours_before": 1, "default_before_minutes": 60}'::jsonb;

-- 2. Backfill existing profiles: add default_before_minutes if missing
UPDATE profiles 
SET email_notifications = email_notifications || '{"default_before_minutes": 60}'::jsonb
WHERE email_notifications IS NOT NULL 
  AND email_notifications->>'default_before_minutes' IS NULL;

-- 3. Updated check_deadline_notifications() function
-- Now reads default_before_minutes from profile JSONB as fallback
-- Uses COALESCE chain: item.email_notify_before_minutes -> profile.default_before_minutes -> profile.hours_before*60 -> 60
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
      AND (
          (t.email_notify = true) OR 
          ((p.email_notifications->>'enabled')::boolean = true AND (p.email_notifications->>'todo_deadline')::boolean = true)
      )
      AND t.deadline > now()
      AND t.deadline <= now() + (
          COALESCE(
              t.email_notify_before_minutes,
              (p.email_notifications->>'default_before_minutes')::integer,
              (p.email_notifications->>'hours_before')::integer * 60,
              60
          ) || ' minutes'
      )::interval
      AND NOT EXISTS (
          SELECT 1 FROM email_notification_logs enl 
          WHERE enl.source_id = t.id::text
            AND enl.source_type = 'todo'
            AND enl.notification_type = 'deadline'
      )
    RETURNING 
        id, 
        email_notification_logs.user_id, 
        email_to, 
        email_notification_logs.source_type, 
        email_notification_logs.source_id,
        (SELECT content FROM todos WHERE id::text = email_notification_logs.source_id) AS title,
        (SELECT deadline FROM todos WHERE id::text = email_notification_logs.source_id) AS deadline,
        (SELECT EXTRACT(EPOCH FROM (deadline - now()))/60 FROM todos WHERE id::text = email_notification_logs.source_id)::integer AS minutes_left;

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
      AND (ce.date::text || COALESCE(' ' || ce.time::text, ' 00:00:00'))::timestamptz > now()
      AND (ce.date::text || COALESCE(' ' || ce.time::text, ' 00:00:00'))::timestamptz <= now() + (
          COALESCE(
              ce.email_notify_before_minutes,
              (p.email_notifications->>'default_before_minutes')::integer,
              (p.email_notifications->>'hours_before')::integer * 60,
              60
          ) || ' minutes'
      )::interval
      AND NOT EXISTS (
          SELECT 1 FROM email_notification_logs enl 
          WHERE enl.source_id = ce.id::text
            AND enl.source_type = 'calendar_event'
            AND enl.notification_type = 'deadline'
      )
    RETURNING 
        id, 
        email_notification_logs.user_id, 
        email_to, 
        email_notification_logs.source_type, 
        email_notification_logs.source_id,
        (SELECT title FROM calendar_events WHERE id::text = email_notification_logs.source_id) AS title,
        (SELECT (date::text || COALESCE(' ' || time::text, ' 00:00:00'))::timestamptz FROM calendar_events WHERE id::text = email_notification_logs.source_id) AS deadline,
        (SELECT EXTRACT(EPOCH FROM ((date::text || COALESCE(' ' || time::text, ' 00:00:00'))::timestamptz - now()))/60 FROM calendar_events WHERE id::text = email_notification_logs.source_id)::integer AS minutes_left;

    -- [C] Quét Lịch biểu cố định (Timetable)
    RETURN QUERY
    INSERT INTO email_notification_logs (user_id, source_type, source_id, notification_type, email_to, status)
    SELECT 
        tt.user_id,
        'timetable'::text,
        tt.id::text,
        ('timetable_' || to_char(now(), 'YYYY-MM-DD'))::text,
        p.email,
        'pending'::text
    FROM timetable tt
    JOIN profiles p ON p.id = tt.user_id
    WHERE tt.day_of_week = EXTRACT(dow FROM now())::integer
      AND (
          (tt.email_notify = true) OR 
          ((p.email_notifications->>'enabled')::boolean = true AND (p.email_notifications->>'timetable_deadline')::boolean = true)
      )
      AND (to_char(now(), 'YYYY-MM-DD') || ' ' || tt.start_time)::timestamptz > now()
      AND (to_char(now(), 'YYYY-MM-DD') || ' ' || tt.start_time)::timestamptz <= now() + (
          COALESCE(
              tt.email_notify_before_minutes,
              (p.email_notifications->>'default_before_minutes')::integer,
              (p.email_notifications->>'hours_before')::integer * 60,
              60
          ) || ' minutes'
      )::interval
      AND NOT EXISTS (
          SELECT 1 FROM email_notification_logs enl 
          WHERE enl.source_id = tt.id::text
            AND enl.source_type = 'timetable'
            AND enl.notification_type = ('timetable_' || to_char(now(), 'YYYY-MM-DD'))::text
      )
    RETURNING 
        id, 
        email_notification_logs.user_id, 
        email_to, 
        email_notification_logs.source_type, 
        email_notification_logs.source_id,
        (SELECT title FROM timetable WHERE id::text = email_notification_logs.source_id) AS title,
        (SELECT (to_char(now(), 'YYYY-MM-DD') || ' ' || start_time)::timestamptz FROM timetable WHERE id::text = email_notification_logs.source_id) AS deadline,
        (SELECT EXTRACT(EPOCH FROM ((to_char(now(), 'YYYY-MM-DD') || ' ' || start_time)::timestamptz - now()))/60 FROM timetable WHERE id::text = email_notification_logs.source_id)::integer AS minutes_left;
END;
$$ LANGUAGE plpgsql;

-- ====================================================================
-- 4. pg_cron Setup (Run manually in Supabase SQL Editor)
-- ====================================================================
-- 
-- Step 4a. Enable pg_cron extension (if not already enabled via Dashboard > Database > Extensions)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
--
-- Step 4b. Schedule the deadline scanner every 5 minutes (improved from 15 minutes)
-- SELECT cron.schedule(
--     'smartlife-deadline-scanner',
--     '*/5 * * * *',
--     $$ SELECT check_deadline_notifications(); $$
-- );
--
-- Step 4c. To unschedule:
-- SELECT cron.unschedule('smartlife-deadline-scanner');
--
-- NOTE: pg_cron only creates pending logs. Actual email sending is handled by
-- the Vercel Cron Job (api/cron-check-emails.js) which polls pending logs
-- and sends via Resend API.
-- ====================================================================
