-- Thêm cột completed_at vào bảng todos để ghi nhận thời điểm hoàn thành task
ALTER TABLE todos ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Tạo index hỗ trợ tìm kiếm nhanh các task đã hoàn thành theo thời gian
CREATE INDEX IF NOT EXISTS idx_todos_completed_at ON todos(user_id, completed_at DESC);
