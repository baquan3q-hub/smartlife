-- ====================================================================
-- SUPABASE DATABASE SCHEMA MIGRATION: WALLET & DEBT MANAGEMENT SYSTEM
-- SmartLife App
-- Date: 2026-06-11
-- ====================================================================

-- 1. Tạo bảng wallets
CREATE TABLE IF NOT EXISTS public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('cash', 'bank', 'credit', 'e-wallet', 'savings', 'fund')), -- Thêm loại 'fund' cho Quỹ mục đích
  balance NUMERIC(15, 2) DEFAULT 0.00 NOT NULL,
  initial_balance NUMERIC(15, 2) DEFAULT 0.00 NOT NULL, -- Số tiền/hạn mức ban đầu
  color TEXT DEFAULT '#6366F1' NOT NULL,
  icon TEXT DEFAULT 'Wallet' NOT NULL,
  include_in_total BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Kích hoạt Row Level Security (RLS) cho wallets
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own wallets" ON public.wallets;
CREATE POLICY "Users can manage their own wallets" ON public.wallets 
  FOR ALL USING (auth.uid() = user_id);

-- Index cho quick lookup theo user
CREATE INDEX IF NOT EXISTS idx_wallets_user ON public.wallets(user_id);

-- 2. Tạo bảng debts
CREATE TABLE IF NOT EXISTS public.debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('lend', 'borrow')), -- lend: cho vay (con nợ), borrow: đi vay (chủ nợ)
  amount NUMERIC(15, 2) NOT NULL,
  remaining_amount NUMERIC(15, 2) NOT NULL,
  date_lent DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid')),
  wallet_id UUID REFERENCES public.wallets(id) ON DELETE SET NULL, -- Ví liên kết lúc giải ngân
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Kích hoạt Row Level Security (RLS) cho debts
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own debts" ON public.debts;
CREATE POLICY "Users can manage their own debts" ON public.debts 
  FOR ALL USING (auth.uid() = user_id);

-- Index cho quick lookup
CREATE INDEX IF NOT EXISTS idx_debts_user ON public.debts(user_id);

-- 3. Tạo bảng debt_repayments
CREATE TABLE IF NOT EXISTS public.debt_repayments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_id UUID NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
  amount NUMERIC(15, 2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  wallet_id UUID REFERENCES public.wallets(id) ON DELETE SET NULL, -- Ví nhận tiền/trả tiền
  note TEXT,
  transaction_id UUID, -- Liên kết giao dịch chính để xóa đồng bộ (không đặt khóa ngoại cứng để tránh xung đột id tạm client)
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Kích hoạt Row Level Security (RLS) cho debt_repayments
ALTER TABLE public.debt_repayments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own debt payments" ON public.debt_repayments;
CREATE POLICY "Users can manage their own debt payments" ON public.debt_repayments 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.debts d 
      WHERE d.id = public.debt_repayments.debt_id 
      AND d.user_id = auth.uid()
    )
  );

-- Index cho quick lookup
CREATE INDEX IF NOT EXISTS idx_debt_repayments_debt ON public.debt_repayments(debt_id);

-- 4. Bổ sung cột vào bảng transactions hiện tại để liên kết
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS wallet_id UUID REFERENCES public.wallets(id) ON DELETE SET NULL;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS debt_id UUID REFERENCES public.debts(id) ON DELETE SET NULL;
