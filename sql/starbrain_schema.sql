-- =====================================================
-- StarBrain Reward System — Phase 1: Core Tables
-- SmartLife Web App
-- Date: 2026-05-08
-- =====================================================

-- 1. Star Transactions — Lưu lịch sử nhận/tiêu sao
CREATE TABLE IF NOT EXISTS star_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_id UUID REFERENCES habits(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('EARN', 'REDEEM')),
  amount INT NOT NULL,
  source TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. User Star Stats — Cache số sao & level
CREATE TABLE IF NOT EXISTS user_star_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_earned INT NOT NULL DEFAULT 0,
  current_balance INT NOT NULL DEFAULT 0,
  current_level INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. RLS Policies
ALTER TABLE star_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_star_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own star_transactions"
  ON star_transactions FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users manage own star_stats"
  ON user_star_stats FOR ALL
  USING (auth.uid() = user_id);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_star_tx_user_date
  ON star_transactions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_star_tx_habit_source
  ON star_transactions(habit_id, source, created_at DESC);
