-- Thêm cột status kiểu text với giá trị mặc định 'todo'
ALTER TABLE todos ADD COLUMN IF NOT EXISTS status text DEFAULT 'todo';

-- Tạo constraint check cho giá trị hợp lệ (xóa nếu đã tồn tại để tránh lỗi trùng lặp)
ALTER TABLE todos DROP CONSTRAINT IF EXISTS todos_status_check;
ALTER TABLE todos ADD CONSTRAINT todos_status_check 
  CHECK (status IN ('backlog', 'todo', 'doing', 'done'));

-- Migration dữ liệu cũ: task đã hoàn thành → 'done', còn lại → 'todo'
UPDATE todos SET status = 'done' WHERE is_completed = true AND status IS DISTINCT FROM 'done';
UPDATE todos SET status = 'todo' WHERE is_completed = false AND (status IS NULL OR status = 'todo');

-- Index cho filtering theo status
CREATE INDEX IF NOT EXISTS idx_todos_status ON todos(user_id, status);

-- Thêm cột description và subtasks
ALTER TABLE todos ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE todos ADD COLUMN IF NOT EXISTS subtasks jsonb DEFAULT '[]'::jsonb;
