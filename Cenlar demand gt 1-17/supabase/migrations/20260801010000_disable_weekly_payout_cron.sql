-- 2026-08-01: Xavier wants manual payout control only for now. Payouts are
-- executed exclusively via the admin dashboard Release button (create-payout
-- with target_trainer_profile_id). Unschedule the weekly auto-payout cron
-- that 20260801000000_admin_release_payment.sql armed earlier the same day.
-- The weekly-payouts edge function stays deployed but nothing invokes it;
-- re-arm later by re-running the cron.schedule block from that migration.
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly-trainer-payouts') THEN
    PERFORM cron.unschedule('weekly-trainer-payouts');
  END IF;
END;
$do$;
