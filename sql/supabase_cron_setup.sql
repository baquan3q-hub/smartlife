-- ====================================================================
-- SUPABASE DATABASE SETUP: CRON TRIGGER FOR VERCEL EMAIL SCANNER
-- SmartLife App v2.2
-- Date: 2026-06-26
-- Purpose: Bypasses Vercel Hobby cron limitations by scheduling
--          the scanner from Supabase DB side (runs every 5 minutes).
-- ====================================================================

-- 1. Enable required extensions (pg_cron and pg_net)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Unschedule old trigger (if exists) to avoid duplicate crons (handled safely)
DO $$
BEGIN
    PERFORM cron.unschedule('smartlife-vercel-cron-trigger');
EXCEPTION
    WHEN OTHERS THEN
        NULL; -- Ignore error if job does not exist
END $$;

-- 3. Create a cron trigger to ping Vercel Serverless Function every 5 minutes
SELECT cron.schedule(
    'smartlife-vercel-cron-trigger',
    '*/5 * * * *',
    $$
    SELECT net.http_post(
        url := 'https://www.smartlife.courses/api/cron-check-emails',
        headers := '{"Authorization": "Bearer SmartLifeSecureToken2026!@#", "Content-Type": "application/json"}'::jsonb
    );
    $$
);

-- ====================================================================
-- HOW TO VERIFY ON SUPABASE:
-- ====================================================================
-- Run this query to inspect the status of recent HTTP trigger requests:
-- SELECT * FROM net.http_responses ORDER BY created_at DESC LIMIT 10;
--
-- A response status of 200 means the Vercel function was successfully invoked!
-- ====================================================================
