-- Migration: Referral System
-- Phase 11 Plan 01 — Referral Program v1 Database Foundation
-- Creates referral_code column, referrals table, discount flags, updates
-- payout constraint, adds leaderboard RPC, and updates handle_new_user trigger.

-- ============================================================
-- Section 1 — Add referral_code to profiles
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE;

UPDATE public.profiles
SET referral_code = substring(replace(gen_random_uuid()::text, '-', ''), 1, 8)
WHERE referral_code IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN referral_code SET NOT NULL;

CREATE INDEX IF NOT EXISTS profiles_referral_code_idx ON public.profiles(referral_code);

-- ============================================================
-- Section 2 — Add referral discount columns to profiles
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_discount_pending boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS referral_discount_trainer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ============================================================
-- Section 3 — Update payout_transactions initiated_by constraint
-- ============================================================

ALTER TABLE public.payout_transactions
  DROP CONSTRAINT IF EXISTS payout_transactions_initiated_by_check;

ALTER TABLE public.payout_transactions
  ADD CONSTRAINT payout_transactions_initiated_by_check
    CHECK (initiated_by IN ('trainer', 'auto', 'referral'));

-- ============================================================
-- Section 4 — Create referrals table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.referrals (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_role   text        NOT NULL CHECK (referred_role IN ('trainer', 'client')),
  status          text        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'rewarded', 'expired')),
  reward_type     text        CHECK (reward_type IN ('payout_credit', 'booking_discount')),
  rewarded_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT referrals_no_self_referral CHECK (referrer_id <> referred_id),
  CONSTRAINT referrals_unique_pair UNIQUE (referrer_id, referred_id)
);

CREATE INDEX IF NOT EXISTS referrals_referrer_id_idx ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS referrals_referred_id_idx ON public.referrals(referred_id);
CREATE INDEX IF NOT EXISTS referrals_status_rewarded_at_idx ON public.referrals(status, rewarded_at);

-- ============================================================
-- Section 5 — RLS for referrals table
-- ============================================================

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Referrer or referred user can read their own rows
DROP POLICY IF EXISTS referrals_select_own ON public.referrals;
CREATE POLICY referrals_select_own
  ON public.referrals
  FOR SELECT
  USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

-- Authenticated user can insert if they are the referred_id (self-attribution)
-- and they are not the referrer (guards against self-referral at policy level too)
DROP POLICY IF EXISTS referrals_insert_referred ON public.referrals;
CREATE POLICY referrals_insert_referred
  ON public.referrals
  FOR INSERT
  WITH CHECK (auth.uid() = referred_id AND referrer_id <> auth.uid());

-- UPDATE/DELETE: service role only (default deny for authenticated users)

-- ============================================================
-- Section 6 — get_referral_leaderboard RPC
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_referral_leaderboard()
RETURNS TABLE (
  rank           bigint,
  full_name      text,
  avatar_url     text,
  referral_count bigint
)
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT
    ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC) AS rank,
    p.full_name,
    p.avatar_url,
    COUNT(*) AS referral_count
  FROM public.referrals r
  JOIN public.profiles p ON p.id = r.referrer_id
  WHERE r.status = 'rewarded'
    AND r.rewarded_at >= date_trunc('month', now())
  GROUP BY p.id, p.full_name, p.avatar_url
  ORDER BY referral_count DESC
  LIMIT 10;
$$;

GRANT EXECUTE ON FUNCTION public.get_referral_leaderboard() TO anon;
GRANT EXECUTE ON FUNCTION public.get_referral_leaderboard() TO authenticated;

-- ============================================================
-- Section 7 — Update handle_new_user trigger to include referral_code
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name, avatar_url, referral_code)
  VALUES (
    new.id,
    null,
    COALESCE(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    COALESCE(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture', null),
    substring(replace(gen_random_uuid()::text, '-', ''), 1, 8)
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$;
