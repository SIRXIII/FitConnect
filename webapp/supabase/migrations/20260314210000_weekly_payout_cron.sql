-- Migration: 20260314210000_weekly_payout_cron.sql
-- Purpose: Schedule weekly auto-payout via pg_cron + pg_net calling the weekly-payouts Edge Function.
--
-- REQUIRED MANUAL SETUP (run in SQL Editor AFTER deploying this migration):
-- ============================================================================
-- The pg_cron job reads Vault secrets to authenticate with the Edge Function.
-- You MUST create these secrets before the cron job can execute successfully:
--
--   SELECT vault.create_secret('https://YOUR_PROJECT_REF.supabase.co', 'project_url');
--   SELECT vault.create_secret('YOUR_SERVICE_ROLE_KEY', 'service_role_key');
--
-- Replace YOUR_PROJECT_REF with your Supabase project reference ID.
-- Replace YOUR_SERVICE_ROLE_KEY with the service_role key from:
--   Supabase Dashboard -> Settings -> API -> service_role (secret)
--
-- Do NOT put real secret values in this migration file.
-- ============================================================================

-- Enable required extensions
-- These may already be enabled on Supabase hosted projects.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule: Every Monday at 09:00 UTC
-- Cron expression: minute hour day month weekday
--   0 9 * * 1 = 09:00 UTC every Monday (1 = Monday)
SELECT cron.schedule(
  'weekly-trainer-payouts',
  '0 9 * * 1',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/weekly-payouts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
