-- Backfill payout constraints that existed only on the live project.
--
-- 20260801000000_admin_release_payment.sql deliberately skipped these because
-- they were already present on the live database (they had been applied out of
-- band). That left the tracked migration chain incomplete: a database built
-- from these files alone would reject the admin Release path and would have no
-- protection against concurrent payouts. Every statement below is idempotent,
-- so this is a no-op against the live project and corrective everywhere else.

-- 1. Admin attribution column, referenced by create-payout and by the Payout
--    History panel in the admin dashboard.
ALTER TABLE public.payout_transactions
  ADD COLUMN IF NOT EXISTS initiated_by_admin_id uuid REFERENCES public.profiles(id);

-- 2. Allow initiated_by = 'admin'. Without this the admin Release button fails
--    the CHECK constraint on insert.
ALTER TABLE public.payout_transactions
  DROP CONSTRAINT IF EXISTS payout_transactions_initiated_by_check;
ALTER TABLE public.payout_transactions
  ADD CONSTRAINT payout_transactions_initiated_by_check
  CHECK (initiated_by IN ('trainer', 'auto', 'referral', 'admin'));

-- 3. One active payout per trainer. This is the database-level guarantee that
--    two concurrent Release requests cannot both create a payout and pay the
--    same completed sessions twice. The edge functions catch the resulting
--    23505 and return a friendly 409.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_payout_active_per_trainer
  ON public.payout_transactions (trainer_id)
  WHERE status IN ('pending', 'processing');

NOTIFY pgrst, 'reload schema';
