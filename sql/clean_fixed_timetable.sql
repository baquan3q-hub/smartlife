-- ====================================================================
-- SCRIPT: KIỂM TRA VÀ XÓA LỊCH TRÌNH CỐ ĐỊNH CŨ (TIMETABLE)
-- Dự án: SmartLife App
-- Lưu ý: Lịch trình Google Calendar và các dữ liệu khác được giữ nguyên 100%
-- ====================================================================

-- --------------------------------------------------------------------
-- BƯỚC 1: KIỂM TRA DANH SÁCH LỊCH TRÌNH CỐ ĐỊNH HIỆN CÓ
-- --------------------------------------------------------------------
SELECT 
    t.id AS timetable_id,
    p.email AS user_email,
    p.full_name,
    t.title AS tieu_de,
    CASE t.day_of_week
        WHEN 0 THEN 'Chủ Nhật'
        WHEN 1 THEN 'Thứ Hai'
        WHEN 2 THEN 'Thứ Ba'
        WHEN 3 THEN 'Thứ Tư'
        WHEN 4 THEN 'Thứ Năm'
        WHEN 5 THEN 'Thứ Sáu'
        WHEN 6 THEN 'Thứ Bảy'
        ELSE 'Không xác định'
    END AS thu_trong_tuan,
    t.start_time AS gio_bat_dau,
    t.end_time AS gio_ket_thuc,
    t.location AS dia_diem,
    t.created_at AS ngay_tao
FROM public.timetable t
LEFT JOIN public.profiles p ON t.user_id = p.id
ORDER BY t.created_at DESC;


-- --------------------------------------------------------------------
-- BƯỚC 2: XÓA CÁC LỊCH TRÌNH CỐ ĐỊNH CŨ (TIMETABLE)
-- Lựa chọn A: Xóa toàn bộ lịch trình cố định của tất cả người dùng
-- Lựa chọn B: Chỉ xóa lịch trình cố định của tài khoản quản trị (baquan3q@gmail.com)
-- --------------------------------------------------------------------

-- [LỰA CHỌN A - KHUYẾN NGHỊ]: Xóa toàn bộ lịch trình cố định trên hệ thống
DELETE FROM public.timetable;

-- Dọn dẹp các log thông báo email liên quan đến lịch trình cố định đã xóa (nếu có)
DELETE FROM public.email_notification_logs 
WHERE source_type = 'timetable';

-- [LỰA CHỌN B]: Nếu chỉ muốn xóa cho riêng tài khoản baquan3q@gmail.com, hãy bỏ comment phần dưới:
/*
DELETE FROM public.timetable
WHERE user_id IN (
    SELECT id FROM auth.users WHERE email = 'baquan3q@gmail.com'
);

DELETE FROM public.email_notification_logs
WHERE source_type = 'timetable'
  AND user_id IN (
    SELECT id FROM auth.users WHERE email = 'baquan3q@gmail.com'
);
*/


-- --------------------------------------------------------------------
-- BƯỚC 3: KIỂM TRA LẠI SAU KHI XÓA
-- --------------------------------------------------------------------
-- Số lượng lịch trình cố định còn lại (sẽ là 0):
SELECT count(*) AS remaining_timetable_count FROM public.timetable;

-- Kiểm tra xác nhận bảng Google Calendar/Sự kiện cá nhân vẫn nguyên vẹn:
SELECT count(*) AS google_calendar_events_count FROM public.calendar_events;
