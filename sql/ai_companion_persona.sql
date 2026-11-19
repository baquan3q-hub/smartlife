-- File: sql/ai_companion_persona.sql
-- Chế độ "Bạn đồng hành": hồ sơ nhân vật AI do người dùng tự đặt (tên, giới tính, quan hệ, xưng hô, tính cách…).
-- Chạy được nhiều lần (IF NOT EXISTS). Chạy trong Supabase → SQL Editor trước khi deploy giao diện Bạn đồng hành.
-- Chưa chạy thì app vẫn hoạt động: hồ sơ tạm lưu trong localStorage của trình duyệt.

CREATE TABLE IF NOT EXISTS ai_companions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Toàn bộ hồ sơ (CompanionProfile trong src/services/ai/companion/types.ts), đã được làm sạch phía client
  profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Thời điểm người dùng tự xác nhận đủ 18 tuổi (bắt buộc cho kiểu quan hệ "Người thương")
  adult_confirmed_at TIMESTAMPTZ DEFAULT NULL,
  -- Ngày (giờ VN) đã gửi lời chào chủ động gần nhất — mỗi ngày tối đa 1 lần
  last_greeted_on DATE DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE ai_companions IS 'Hồ sơ nhân vật "Bạn đồng hành" của từng người dùng (1 hàng / người)';

ALTER TABLE ai_companions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_companions_owner_select" ON ai_companions;
CREATE POLICY "ai_companions_owner_select" ON ai_companions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "ai_companions_owner_insert" ON ai_companions;
CREATE POLICY "ai_companions_owner_insert" ON ai_companions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "ai_companions_owner_update" ON ai_companions;
CREATE POLICY "ai_companions_owner_update" ON ai_companions
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "ai_companions_owner_delete" ON ai_companions;
CREATE POLICY "ai_companions_owner_delete" ON ai_companions
  FOR DELETE USING (auth.uid() = user_id);

-- Chế độ mới cho cuộc trò chuyện
COMMENT ON COLUMN ai_conversations.expert_mode IS 'general | planner | psychology | finance | study | relationship | companion';
