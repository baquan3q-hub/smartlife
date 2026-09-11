-- ====================================================================
-- SUPABASE DATABASE SCHEMA MIGRATION: RECURRING TRANSACTIONS SYSTEM
-- SmartLife App
-- Date: 2026-09-12
-- ====================================================================

-- 1. Bổ sung cột pinned_categories vào bảng profiles (nếu chưa có)
ALTER TABLE IF EXISTS public.profiles 
ADD COLUMN IF NOT EXISTS pinned_categories JSONB DEFAULT '[]'::jsonb;

-- 2. Tạo bảng recurring_transactions
CREATE TABLE IF NOT EXISTS public.recurring_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  amount NUMERIC(15, 2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category TEXT NOT NULL,
  wallet_id UUID REFERENCES public.wallets(id) ON DELETE SET NULL,
  day_of_month INTEGER NOT NULL DEFAULT 1 CHECK (day_of_month >= 1 AND day_of_month <= 31),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
  description TEXT,
  auto_apply BOOLEAN DEFAULT true NOT NULL,
  last_applied_month TEXT, -- e.g. '2026-09'
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Kích hoạt Row Level Security (RLS) cho recurring_transactions
ALTER TABLE public.recurring_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own recurring transactions" ON public.recurring_transactions;
CREATE POLICY "Users can manage their own recurring transactions" ON public.recurring_transactions 
  FOR ALL USING (auth.uid() = user_id);

-- 4. Index cho quick lookup theo user
CREATE INDEX IF NOT EXISTS idx_recurring_transactions_user ON public.recurring_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_transactions_status ON public.recurring_transactions(user_id, status);
