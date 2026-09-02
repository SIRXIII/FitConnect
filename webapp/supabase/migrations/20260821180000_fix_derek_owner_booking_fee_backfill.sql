-- 2026-08-21: Backfill — unblock admin payout to Derek Salem.
--
-- Two of Derek's completed sessions were recorded with `amount` = the base rate
-- ($43) while the client (owner "Xavier") was ACTUALLY charged rate + fee
-- ($48.59 / $51.60 per Stripe PIs pi_3U611W… / pi_3U17K5…). That made the rows
-- violate the money-conservation invariant trainer_payout + platform_fee ==
-- amount, so create-payout's integrity gate refused the release (HTTP 400).
--
-- Model is FEE-ON-TOP: the client pays rate + platform_fee, the trainer keeps
-- the full rate, and the platform keeps the fee. The correct rows therefore
-- record the real charge as `amount` and leave trainer_payout at the full rate:
--   6c11d689 (Aug 20): amount 48.59, platform_fee 5.59, trainer_payout 43.00
--   e003502c (Aug 6):  amount 51.60, platform_fee 8.60, trainer_payout 43.00
--
-- Root cause is the mobile stripe-webhook writing `amount = price_cents/100`
-- (base rate) instead of the actual PI amount; fixed in the FitRush-Flutter repo.
-- This migration only reconciles the two stuck rows so the pending release can
-- go through. Trainer is paid in full ($86); the platform keeps its $14.19 fee.
--
-- Idempotent absolute sets; guarded so an already-released payment is untouched.

update public.payments set
  amount = case id
    when '6c11d689-dafe-447e-a6da-8581acdcf052' then 48.59
    when 'e003502c-7bee-4292-b9f5-4d9026aaddbd' then 51.60
  end,
  platform_fee = case id
    when '6c11d689-dafe-447e-a6da-8581acdcf052' then 5.59
    when 'e003502c-7bee-4292-b9f5-4d9026aaddbd' then 8.60
  end,
  trainer_payout = 43.00,
  updated_at = now()
where id in ('6c11d689-dafe-447e-a6da-8581acdcf052','e003502c-7bee-4292-b9f5-4d9026aaddbd')
  and payout_transaction_id is null;

update public.bookings set
  platform_fee = case id
    when '9ffcce97-fac5-43b1-a3db-5b880ac70e99' then 5.59
    when '63065a30-965c-4f8b-a412-159949ae1b39' then 8.60
  end,
  trainer_payout = 43.00,
  updated_at = now()
where id in ('9ffcce97-fac5-43b1-a3db-5b880ac70e99','63065a30-965c-4f8b-a412-159949ae1b39');
