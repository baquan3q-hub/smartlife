-- file: sql/add_documents_columns.sql
-- Thêm các trường lưu trữ QR và tài liệu cá nhân vào bảng profiles

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS qr_code_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS student_card_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS citizen_card_url TEXT;

COMMENT ON COLUMN profiles.qr_code_url IS 'Ảnh mã QR cá nhân (QR thanh toán hoặc mã số SV)';
COMMENT ON COLUMN profiles.student_card_url IS 'Ảnh thẻ sinh viên dùng để xem nhanh';
COMMENT ON COLUMN profiles.citizen_card_url IS 'Ảnh căn cước công dân (CCCD)';
