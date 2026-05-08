-- =====================================================
-- StarBrain Reward System — Phase 2: Rewards Tables
-- SmartLife Web App
-- Date: 2026-05-08
-- =====================================================

-- 1. Rewards — Phần thưởng (template + custom)
CREATE TABLE IF NOT EXISTS rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  cost INT NOT NULL CHECK (cost > 0),
  category TEXT NOT NULL CHECK (category IN ('TIME', 'FOOD', 'ENTERTAINMENT', 'SELF_CARE', 'BIG_GOAL')),
  emoji TEXT NOT NULL DEFAULT '🎁',
  is_template BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Reward Redemptions — Lịch sử đổi thưởng
CREATE TABLE IF NOT EXISTS reward_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
  stars_spent INT NOT NULL,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. RLS Policies
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own rewards"
  ON rewards FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users manage own redemptions"
  ON reward_redemptions FOR ALL
  USING (auth.uid() = user_id);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_rewards_user ON rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_user ON reward_redemptions(user_id, redeemed_at DESC);
