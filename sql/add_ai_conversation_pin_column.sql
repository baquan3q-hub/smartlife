-- sql/add_ai_conversation_pin_column.sql
-- Thêm cột is_pinned vào bảng ai_conversations để cho phép ghim cuộc hội thoại lên đầu

ALTER TABLE ai_conversations 
ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;

-- Bổ sung index để tối ưu hóa truy vấn sắp xếp theo ghim
CREATE INDEX IF NOT EXISTS idx_ai_conversations_is_pinned ON ai_conversations(is_pinned DESC, updated_at DESC);

COMMENT ON COLUMN ai_conversations.is_pinned IS 'Trạng thái ghim cuộc trò chuyện lên đầu danh sách';
