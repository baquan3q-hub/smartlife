-- File: sql/ai_companion_upgrade.sql
-- Nâng cấp AI Cố vấn thành "AI đồng hành" (giai đoạn 0).
-- Chỉ THÊM cột/index (nullable, có IF NOT EXISTS) → chạy lại nhiều lần vẫn an toàn, code cũ không bị ảnh hưởng.
-- Chạy trong Supabase → SQL Editor TRƯỚC khi deploy giao diện chat mới (giai đoạn 1).

-- 1. Tin nhắn: siêu dữ liệu + xoá mềm
--    meta: { mode, tier, model, thoughts, steps[], sources[], clarification, feedback, stopped }
--    deleted_at: xoá mềm khi "Quay lại đây" / Xoá tin — lịch sử gửi cho AI bỏ qua các tin này
ALTER TABLE ai_messages ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT NULL;
ALTER TABLE ai_messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN ai_messages.meta IS 'Chế độ, tầng tốc độ, model, suy nghĩ, các bước tìm dữ liệu, nguồn trích dẫn, câu hỏi làm rõ, phản hồi 👍/👎';
COMMENT ON COLUMN ai_messages.deleted_at IS 'Xoá mềm (revert/xoá tin); NULL = còn hiệu lực';

CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_live
  ON ai_messages(conversation_id, created_at)
  WHERE deleted_at IS NULL;

-- 2. Cuộc trò chuyện: chế độ chuyên gia + tóm tắt hội thoại dài
ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS expert_mode TEXT DEFAULT NULL;
ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS summary TEXT DEFAULT NULL;

COMMENT ON COLUMN ai_conversations.expert_mode IS 'general | planner | psychology | finance | study | relationship';
COMMENT ON COLUMN ai_conversations.summary IS 'Tóm tắt phần đầu hội thoại dài (gửi thay cho tin cũ để tiết kiệm token)';

-- 3. Bộ nhớ dài hạn: thời điểm cập nhật + cuộc trò chuyện sinh ra ký ức
ALTER TABLE ai_memory ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE ai_memory ADD COLUMN IF NOT EXISTS source_conversation_id UUID
  REFERENCES ai_conversations(id) ON DELETE SET NULL;

COMMENT ON COLUMN ai_memory.updated_at IS 'Lần cuối ký ức được tạo/sửa (dùng khi gộp ký ức trùng)';
COMMENT ON COLUMN ai_memory.source_conversation_id IS 'Cuộc trò chuyện đã sinh ra ký ức này';
