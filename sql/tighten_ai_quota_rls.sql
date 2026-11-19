-- File: sql/tighten_ai_quota_rls.sql
-- KHOÁ quyền tự sửa hạn mức AI của người dùng.
--
-- Vấn đề: sql/fix_ai_quota_boost_rls.sql cho phép người dùng INSERT/UPDATE dòng user_ai_quota
-- và UPDATE user_ai_boost của chính họ. Ai mở console trình duyệt cũng có thể đặt
-- requests_today = 0 hoặc tokens_used = 0 để dùng AI không giới hạn.
--
-- Từ bản này, /api/gemini và /api/search ghi quota bằng SUPABASE_SERVICE_ROLE_KEY (bỏ qua RLS).
-- ⚠️ CHỈ chạy file này SAU KHI đã kiểm tra SUPABASE_SERVICE_ROLE_KEY có trong
--    Vercel → Settings → Environment Variables (Production) và đã deploy bản mới.
--    Chạy trước khi có key → server không ghi được quota (AI vẫn chạy nhưng không đếm lượt).

DROP POLICY IF EXISTS "Users insert own quota" ON user_ai_quota;
DROP POLICY IF EXISTS "Users update own quota" ON user_ai_quota;
DROP POLICY IF EXISTS "Users update own boost" ON user_ai_boost;

-- Người dùng vẫn XEM được quota/boost của mình (thanh hạn mức trong app)
-- qua các policy "Users select own quota" / "Users select own boost" đã có.
