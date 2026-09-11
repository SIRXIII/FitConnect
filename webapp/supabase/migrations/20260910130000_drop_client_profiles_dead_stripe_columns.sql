-- drop_client_profiles_dead_stripe_columns — follow-up to the web card-on-file
-- repoint (2026-09-10). NOT YET APPLIED. Preconditions before applying live:
--   1. The webapp deploy containing src/lib/paymentMethods.ts is live (the old
--      bundle upserts stripe_payment_method_id; PostgREST rejects unknown
--      payload columns once dropped).
--   2. The webapp-owned `create-setup-intent` edge fn (live v34, last writer of
--      client_profiles.stripe_customer_id) is retired/undeployed — no caller
--      remains after this repoint.
--   3. Drop the four fields from client_profiles Row/Insert/Update in
--      src/types/supabase.ts in the same change.
-- Live check 2026-09-10 (mgmt API): all four columns NULL on every row;
-- no pg_proc or pg_views reference; the Stripe customer mapping lives in
-- profile_private_details.stripe_customer_id (service-role-write-only).
BEGIN;
ALTER TABLE public.client_profiles
  DROP COLUMN IF EXISTS stripe_customer_id,
  DROP COLUMN IF EXISTS stripe_payment_method_id,
  DROP COLUMN IF EXISTS stripe_payment_last4,
  DROP COLUMN IF EXISTS stripe_payment_brand;
NOTIFY pgrst, 'reload schema';
COMMIT;
