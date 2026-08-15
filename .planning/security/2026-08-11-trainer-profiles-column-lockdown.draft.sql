-- ============================================================================
-- DRAFT — NOT A MIGRATION YET. DO NOT `supabase db push` FROM HERE.
-- Kept out of supabase/migrations/ on purpose so it cannot auto-apply.
-- Review, then move into supabase/migrations/ with a real timestamp and apply
-- WITH the smoke test at the bottom. Gates the Train Therapy campaign (F4).
-- ============================================================================
--
-- PROBLEM (verified live 2026-08-10):
--   Both `authenticated` AND `anon` hold UPDATE on all 60 columns of
--   public.trainer_profiles, including is_verified, approval_status, rank_score,
--   payouts_enabled, payout_on_hold, stripe_account_id. Row-level RLS is correct
--   ("Trainers can update own profile": auth.uid() = user_id) but the COLUMN grant
--   is not, so a trainer can self-verify, self-boost their search rank, and
--   un-freeze their own payouts. The UPDATE policy also has USING but no WITH CHECK,
--   so a trainer can update their row to point user_id at someone else.
--
-- FIX:
--   1. Revoke blanket UPDATE from authenticated + anon.
--   2. Re-grant UPDATE only on the columns the app actually writes client-side.
--      (Allowlist below was built by grepping every .update()/.upsert() call site:
--       TrainerOnboarding, SettingsTab, VideoUploader, DiscountSlider,
--       BufferTimeSelector, useAvailabilitySession. If a NEW trainer-editable
--       field ships later, add it here or that save silently 403s.)
--   3. anon gets NO update grant at all (an anonymous user never edits a profile).
--   4. Add WITH CHECK to the update policy so the row can't be re-owned.
--
-- SENSITIVE-READ NOTE (separate, do after the smoke test passes):
--   anon/authenticated also hold SELECT on stripe_account_id, stripe_customer_id,
--   and calendar_export_token. The public trainer card does not need those. Narrowing
--   SELECT is trickier (the card needs most columns) so it is deliberately NOT in this
--   draft — handle via a public view or column-level REVOKE in a follow-up, and rotate
--   calendar_export_token for all 7 trainers when you do.

BEGIN;

REVOKE UPDATE ON public.trainer_profiles FROM authenticated;
REVOKE UPDATE ON public.trainer_profiles FROM anon;

-- Editable allowlist — evidence-based (every client-side write site as of 2026-08-11).
GRANT UPDATE (
  bio,
  location,
  specialty,
  hourly_rate,
  optimized_rate,
  certification_number,
  certification_url,
  years_experience,
  expertise_tags,
  success_story,
  faqs,
  intro_video_url,
  intro_video_thumbnail_url,
  discount_percentage,
  buffer_minutes,
  availability_status,
  booking_mode,
  sleep_timer_expires_at,
  availability_session_started_at,
  active_location_id
) ON public.trainer_profiles TO authenticated;

-- Defense in depth: stop a trainer from updating their row to point at another user.
DROP POLICY IF EXISTS "Trainers can update own profile" ON public.trainer_profiles;
CREATE POLICY "Trainers can update own profile"
  ON public.trainer_profiles
  FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

COMMIT;

-- ---------------------------------------------------------------------------
-- ROLLBACK (if a trainer save breaks after apply):
-- ---------------------------------------------------------------------------
-- BEGIN;
--   GRANT UPDATE ON public.trainer_profiles TO authenticated;
--   DROP POLICY IF EXISTS "Trainers can update own profile" ON public.trainer_profiles;
--   CREATE POLICY "Trainers can update own profile"
--     ON public.trainer_profiles FOR UPDATE
--     USING ((SELECT auth.uid()) = user_id);
-- COMMIT;
-- (Note: rollback restores the vulnerable state. If a save breaks, prefer adding
--  the missing column to the GRANT list above over rolling back wholesale.)

-- ---------------------------------------------------------------------------
-- SMOKE TEST after apply (run as a real logged-in trainer, e.g. Derek):
-- ---------------------------------------------------------------------------
--   1. Edit + save bio, location, rate in Settings           -> must succeed
--   2. Toggle availability live/offline                       -> must succeed
--   3. Change buffer time                                     -> must succeed
--   4. Change discount slider                                 -> must succeed
--   5. Upload/replace intro video                             -> must succeed
--   6. Complete trainer onboarding as a fresh trainer         -> must succeed
--   7. Attempt from the browser console as that trainer:
--        update trainer_profiles set is_verified=true where user_id=auth.uid();
--                                                             -> must be DENIED
--        update trainer_profiles set payout_on_hold=false where user_id=auth.uid();
--                                                             -> must be DENIED
--   If 1-6 all pass and 7 is denied, the lockdown is correct.
