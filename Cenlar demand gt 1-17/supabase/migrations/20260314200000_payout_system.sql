-- Migration: Payout System
-- Phase 09 Plan 01 — Trainer Payout System
-- Creates payout_transactions table and adds payout_transaction_id FK to payments

-- ============================================================
-- 1. payout_transactions table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payout_transactions (
  id                uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id        uuid         NOT NULL REFERENCES public.trainer_profiles(id) ON DELETE RESTRICT,
  amount            numeric(10,2) NOT NULL CHECK (amount > 0),
  stripe_transfer_id text,       -- filled after Stripe call succeeds
  status            text         NOT NULL DEFAULT 'pending'
                                   CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  initiated_by      text         NOT NULL
                                   CHECK (initiated_by IN ('trainer', 'auto')),
  created_at        timestamptz  NOT NULL DEFAULT now(),
  updated_at        timestamptz  NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. Add payout_transaction_id FK column to payments
-- ============================================================
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS payout_transaction_id uuid
    REFERENCES public.payout_transactions(id) ON DELETE SET NULL;

-- ============================================================
-- 3. Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_payout_transactions_trainer
  ON public.payout_transactions(trainer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payments_payout_transaction
  ON public.payments(payout_transaction_id);

-- ============================================================
-- 4. RLS policies on payout_transactions
-- ============================================================
ALTER TABLE public.payout_transactions ENABLE ROW LEVEL SECURITY;

-- Trainers can read their own payout records
CREATE POLICY "Trainers can view own payout transactions"
  ON public.payout_transactions
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.trainer_profiles WHERE id = trainer_id
    )
  );

-- Service role (Edge Functions) handles INSERT/UPDATE — no policy needed for service role
-- But we add an explicit policy so authenticated admins can also manage records if needed
CREATE POLICY "Service role can insert payout transactions"
  ON public.payout_transactions
  FOR INSERT
  WITH CHECK (
    -- Only allow via service role (auth.role() = 'service_role') or admin users
    auth.role() = 'service_role'
  );

CREATE POLICY "Service role can update payout transactions"
  ON public.payout_transactions
  FOR UPDATE
  USING (
    auth.role() = 'service_role'
  );
