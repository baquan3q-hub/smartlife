-- File: sql/update_api_logs_tracking.sql
-- Bổ sung các cột cho bảng api_logs để theo dõi chi tiết số lượng token sử dụng và chi phí AI thực tế.

ALTER TABLE api_logs ADD COLUMN IF NOT EXISTS prompt_tokens INTEGER DEFAULT 0;
ALTER TABLE api_logs ADD COLUMN IF NOT EXISTS candidates_tokens INTEGER DEFAULT 0;
ALTER TABLE api_logs ADD COLUMN IF NOT EXISTS thoughts_tokens INTEGER DEFAULT 0;
ALTER TABLE api_logs ADD COLUMN IF NOT EXISTS estimated_cost_vnd DECIMAL(10,4) DEFAULT 0.0000;
ALTER TABLE api_logs ADD COLUMN IF NOT EXISTS model TEXT DEFAULT 'gemini-2.5-flash';

-- Add comments for documentation
COMMENT ON COLUMN api_logs.prompt_tokens IS 'Số lượng input tokens';
COMMENT ON COLUMN api_logs.candidates_tokens IS 'Số lượng output tokens';
COMMENT ON COLUMN api_logs.thoughts_tokens IS 'Số lượng reasoning/thoughts tokens (nếu có)';
COMMENT ON COLUMN api_logs.estimated_cost_vnd IS 'Chi phí ước tính quy đổi sang VND';
COMMENT ON COLUMN api_logs.model IS 'Tên mô hình AI được sử dụng';
