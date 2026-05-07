-- =============================================
-- SMARTLIFE APP — Habit Tracker Phase 3
-- Add Target Per Period (Weekly/Monthly targets)
-- =============================================

-- Thêm cột target_per_period để lưu số lần cần làm trong một khoảng thời gian (Tuần/Tháng)
ALTER TABLE habits 
ADD COLUMN IF NOT EXISTS target_per_period INTEGER DEFAULT 1;
