-- File: sql/create_user_ai_quota.sql
-- Bảng theo dõi quota và lượng sử dụng AI hàng ngày/hàng tháng của mỗi người dùng

CREATE TABLE IF NOT EXISTS user_ai_quota (
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    requests_today INTEGER DEFAULT 0,
    tokens_today BIGINT DEFAULT 0,
    month_key TEXT NOT NULL, -- Định dạng: 'YYYY-MM' (Ví dụ: '2026-06')
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, date)
);

-- Index để tối ưu truy vấn theo tháng và theo ngày
CREATE INDEX IF NOT EXISTS idx_user_ai_quota_month ON user_ai_quota(user_id, month_key);

-- Thêm mô tả cho bảng và cột
COMMENT ON TABLE user_ai_quota IS 'Theo dõi lượng request và token AI đã sử dụng của mỗi user theo ngày và tháng';
COMMENT ON COLUMN user_ai_quota.user_id IS 'Khóa ngoại liên kết tới bảng profiles';
COMMENT ON COLUMN user_ai_quota.date IS 'Ngày ghi nhận dữ liệu';
COMMENT ON COLUMN user_ai_quota.requests_today IS 'Số lượng yêu cầu (chat/insight) gửi trong ngày';
COMMENT ON COLUMN user_ai_quota.tokens_today IS 'Tổng số token (input + output) tiêu thụ trong ngày';
COMMENT ON COLUMN user_ai_quota.month_key IS 'Khóa tháng để tính giới hạn tháng (định dạng YYYY-MM)';
