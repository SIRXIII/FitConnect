-- Phase 41: Track which admin initiated a payout action
ALTER TABLE public.payout_transactions
  ADD COLUMN IF NOT EXISTS initiated_by_admin_id uuid REFERENCES public.profiles(id);
