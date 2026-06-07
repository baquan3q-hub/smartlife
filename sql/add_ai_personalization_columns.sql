-- file: sql/add_ai_personalization_columns.sql
-- Thêm các trường hỗ trợ cá nhân hóa AI Advisor vào bảng profiles

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS university VARCHAR(150),
ADD COLUMN IF NOT EXISTS career_objective VARCHAR(300),
ADD COLUMN IF NOT EXISTS personality_mbti VARCHAR(4),
ADD COLUMN IF NOT EXISTS personality_disc VARCHAR(2),
ADD COLUMN IF NOT EXISTS hobbies TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS life_motto TEXT;

-- Bổ sung comments giải thích ý nghĩa các cột
COMMENT ON COLUMN profiles.university IS 'Trường đại học/Cao đẳng người dùng đang theo học';
COMMENT ON COLUMN profiles.career_objective IS 'Mục tiêu nghề nghiệp tương lai';
COMMENT ON COLUMN profiles.personality_mbti IS 'Nhóm tính cách MBTI (INTJ, ENFP, INFJ...)';
COMMENT ON COLUMN profiles.personality_disc IS 'Nhóm tính cách DISC (D, I, S, C)';
COMMENT ON COLUMN profiles.hobbies IS 'Danh sách sở thích cá nhân';
COMMENT ON COLUMN profiles.life_motto IS 'Châm ngôn sống hoặc thông điệp cá nhân';
