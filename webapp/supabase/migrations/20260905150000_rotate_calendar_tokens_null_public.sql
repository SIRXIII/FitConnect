-- Live repair 2026-09-05 (migration 2 of 2): rotate calendar export tokens,
-- null the public column, notify trainers to re-subscribe.
--
-- WHY: migration 1 (20260905120000_live_repair_security_pricing.sql) copied every
-- trainer's public trainer_profiles.calendar_export_token into owner-only
-- trainer_private_details so feeds kept working while calendar-export v3 (reads
-- the private table) and the web release (reads via get_calendar_export_token())
-- shipped. Those token values were readable by anon for months, so once both
-- are live every token is rotated here and the public column is nulled; its
-- unique index goes too. Column-level REVOKE is avoided because it breaks
-- select('*') on trainer_profiles (auth store). The column itself is dropped in
-- a later cleanup once web is confirmed on the RPC.
--
-- Apply ONLY after calendar-export v3 and the web bundle are live: v2 and the
-- old bundle read the public column and would 404 every feed.
--
-- The reconnect push reuses send_booking_push() (live SECURITY DEFINER helper:
-- net.http_post to send-push-notification with the vault service_role_key) with
-- type 'calendar_token_rotated' and no booking id. The dashboard shows the
-- reconnect notice while calendar_token_rotated_at > calendar_token_notice_acked_at
-- (or the ack is null).
--
-- Inverse (rollback) SQL — the pre-rotation values are gone, so rollback means
-- putting the CURRENT private tokens back where calendar-export v2 reads them:
--   UPDATE public.trainer_profiles tp
--   SET calendar_export_token = tpd.calendar_export_token
--   FROM public.trainer_private_details tpd
--   WHERE tpd.user_id = tp.user_id;
--   CREATE UNIQUE INDEX IF NOT EXISTS idx_trainer_profiles_calendar_token
--     ON public.trainer_profiles (calendar_export_token)
--     WHERE calendar_export_token IS NOT NULL;
--   UPDATE public.trainer_private_details SET calendar_token_rotated_at = NULL;
--   (the push cannot be recalled; feeds re-subscribed to the new links keep working)

BEGIN;

-- Fresh token + rotated_at for every trainer (insert-if-missing so a trainer who
-- onboarded between the two migrations gets a row too).
INSERT INTO public.trainer_private_details (user_id, calendar_export_token, calendar_token_rotated_at)
SELECT tp.user_id, gen_random_uuid()::text, now()
FROM public.trainer_profiles tp
ON CONFLICT (user_id) DO UPDATE
  SET calendar_export_token     = EXCLUDED.calendar_export_token,
      calendar_token_rotated_at = EXCLUDED.calendar_token_rotated_at,
      updated_at                = now();

UPDATE public.trainer_profiles
SET calendar_export_token = NULL
WHERE calendar_export_token IS NOT NULL;

DROP INDEX IF EXISTS public.idx_trainer_profiles_calendar_token;

-- Best-effort reconnect notice to every trainer. send_booking_push swallows and
-- warns on any failure; the guard keeps the file applicable in a harness that
-- lacks the helper (it lives in the Flutter repo's migrations).
DO $$
DECLARE
  r record;
BEGIN
  IF to_regprocedure('public.send_booking_push(uuid, text, text, text, uuid, text)') IS NULL THEN
    RAISE NOTICE 'send_booking_push(uuid, text, text, text, uuid, text) not present; skipping the reconnect push';
    RETURN;
  END IF;

  FOR r IN SELECT DISTINCT tp.user_id FROM public.trainer_profiles tp LOOP
    PERFORM public.send_booking_push(
      r.user_id,
      'Calendar feed link changed',
      'Your calendar feed link changed for security. Open your dashboard to re-subscribe.',
      'calendar_token_rotated',
      NULL::uuid,
      NULL::text
    );
  END LOOP;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
