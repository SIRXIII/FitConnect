-- Truthful Stripe Connect status: stripe_account_id alone does not mean a trainer
-- can receive payouts, so track Stripe's own account flags separately.
-- NOTE: prod's `payouts_enabled` column already exists (drifted from the repo
-- baseline); this migration reconciles the repo baseline to match prod's shape
-- and additionally introduces `stripe_details_submitted`.
alter table public.trainer_profiles
  add column if not exists payouts_enabled boolean not null default false;

alter table public.trainer_profiles
  add column if not exists stripe_details_submitted boolean not null default false;

-- payouts_enabled mirrors Stripe's account.payouts_enabled.
-- stripe_details_submitted mirrors Stripe's account.details_submitted.
-- Both are written only by edge functions using the service role (create-connect-account,
-- stripe-webhook on account.updated) -- never set directly from client requests.
