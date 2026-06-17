-- File: sql/create_user_ai_boost.sql
-- Bảng lưu trữ thông tin các gói AI Boost Packs (mua thêm token) người dùng đã kích hoạt

CREATE TABLE IF NOT EXISTS user_ai_boost (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    pack_type TEXT NOT NULL, -- 'boost_s', 'boost_m', 'boost_l'
    tokens_total BIGINT NOT NULL, -- Tổng số token của gói (ví dụ: 500.000, 1.000.000, 3.000.000)
    tokens_used BIGINT DEFAULT 0, -- Số token đã tiêu dùng từ gói này
    purchased_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL, -- Thời hạn sử dụng (30, 60, hoặc 90 ngày kể từ ngày mua)
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'exhausted', 'expired'))
);

-- Index để tìm kiếm nhanh các gói boost đang active
CREATE INDEX IF NOT EXISTS idx_user_ai_boost_active ON user_ai_boost(user_id, status);

-- Thêm mô tả cho bảng và cột
COMMENT ON TABLE user_ai_boost IS 'Quản lý thông tin và thời hạn các gói AI Boost Packs mua thêm của người dùng';
COMMENT ON COLUMN user_ai_boost.pack_type IS 'Loại gói boost đã mua (boost_s, boost_m, boost_l)';
COMMENT ON COLUMN user_ai_boost.tokens_total IS 'Số lượng token bổ sung có sẵn trong gói';
COMMENT ON COLUMN user_ai_boost.tokens_used IS 'Số lượng token đã được sử dụng từ gói này';
COMMENT ON COLUMN user_ai_boost.status IS 'Trạng thái hoạt động của gói (active: còn hạn/còn token, exhausted: hết token, expired: hết hạn)';
