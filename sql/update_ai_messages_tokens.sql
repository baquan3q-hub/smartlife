-- File: sql/update_ai_messages_tokens.sql
-- Bổ sung cột tokens_used cho bảng ai_messages để lưu trữ lượng token tiêu hao của mỗi tin nhắn AI.

ALTER TABLE ai_messages ADD COLUMN IF NOT EXISTS tokens_used INTEGER DEFAULT NULL;

COMMENT ON COLUMN ai_messages.tokens_used IS 'Số lượng token tiêu hao của tin nhắn do AI phản hồi';
