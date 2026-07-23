-- Thêm cột attach_link vào bảng todos để đính kèm đường dẫn cho công việc Kanban
ALTER TABLE todos ADD COLUMN IF NOT EXISTS attach_link TEXT;

-- Tạo index hỗ trợ tìm kiếm nhanh các task có đính kèm link
CREATE INDEX IF NOT EXISTS idx_todos_attach_link ON todos(user_id) WHERE attach_link IS NOT NULL;
