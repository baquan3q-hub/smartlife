-- =============================================
-- COUNTDOWN + COUNT-UP + HABIT TRACKER — Database Schema
-- SmartLifeApp — Habit & Event Tracking Module
-- =============================================

-- 1. Bảng Countdown Items (Đếm ngược đến sự kiện)
CREATE TABLE countdown_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    target_date DATE NOT NULL,
    is_recurring BOOLEAN DEFAULT false,
    color_theme TEXT DEFAULT 'blue',
    icon TEXT DEFAULT '📅',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Bảng Count-Up Items (Đếm tiến từ mốc quá khứ)
CREATE TABLE countup_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    start_date DATE NOT NULL,
    color_theme TEXT DEFAULT 'emerald',
    icon TEXT DEFAULT '🚀',
    milestones JSONB DEFAULT '[7, 30, 100, 365, 1000]',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Bảng Habits (Thói quen)
CREATE TABLE habits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    icon TEXT DEFAULT '✅',
    color_theme TEXT DEFAULT 'violet',
    frequency TEXT DEFAULT 'daily',  -- 'daily' | 'custom'
    active_days JSONB DEFAULT '["mon","tue","wed","thu","fri","sat","sun"]',
    start_date DATE DEFAULT CURRENT_DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Bảng Habit Logs (Nhật ký check-in)
CREATE TABLE habit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    log_date DATE NOT NULL,
    completed BOOLEAN DEFAULT false,
    note TEXT,
    logged_at TIMESTAMPTZ DEFAULT now(),
    -- Mỗi habit chỉ có 1 log per ngày
    UNIQUE(habit_id, log_date)
);

-- 5. Indexes
CREATE INDEX idx_countdown_items_user ON countdown_items(user_id);
CREATE INDEX idx_countdown_items_target ON countdown_items(user_id, target_date);
CREATE INDEX idx_countup_items_user ON countup_items(user_id);
CREATE INDEX idx_habits_user ON habits(user_id);
CREATE INDEX idx_habits_active ON habits(user_id, is_active);
CREATE INDEX idx_habit_logs_habit ON habit_logs(habit_id);
CREATE INDEX idx_habit_logs_date ON habit_logs(habit_id, log_date);

-- 6. RLS (Row Level Security)
ALTER TABLE countdown_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE countup_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_logs ENABLE ROW LEVEL SECURITY;

-- Countdown policies
CREATE POLICY "Users can view their own countdowns"
    ON countdown_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own countdowns"
    ON countdown_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own countdowns"
    ON countdown_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own countdowns"
    ON countdown_items FOR DELETE USING (auth.uid() = user_id);

-- Count-Up policies
CREATE POLICY "Users can view their own countups"
    ON countup_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own countups"
    ON countup_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own countups"
    ON countup_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own countups"
    ON countup_items FOR DELETE USING (auth.uid() = user_id);

-- Habit policies
CREATE POLICY "Users can view their own habits"
    ON habits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own habits"
    ON habits FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own habits"
    ON habits FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own habits"
    ON habits FOR DELETE USING (auth.uid() = user_id);

-- Habit Log policies (qua habit ownership)
CREATE POLICY "Users can view logs of their own habits"
    ON habit_logs FOR SELECT
    USING (EXISTS (SELECT 1 FROM habits WHERE habits.id = habit_logs.habit_id AND habits.user_id = auth.uid()));
CREATE POLICY "Users can create logs for their own habits"
    ON habit_logs FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM habits WHERE habits.id = habit_logs.habit_id AND habits.user_id = auth.uid()));
CREATE POLICY "Users can update logs of their own habits"
    ON habit_logs FOR UPDATE
    USING (EXISTS (SELECT 1 FROM habits WHERE habits.id = habit_logs.habit_id AND habits.user_id = auth.uid()));
CREATE POLICY "Users can delete logs of their own habits"
    ON habit_logs FOR DELETE
    USING (EXISTS (SELECT 1 FROM habits WHERE habits.id = habit_logs.habit_id AND habits.user_id = auth.uid()));
