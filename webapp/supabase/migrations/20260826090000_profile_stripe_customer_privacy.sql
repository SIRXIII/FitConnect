-- profile_stripe_customer_privacy — close the public exposure of
-- profiles.stripe_customer_id (sibling of 20260825070000_profile_phone_privacy).
--
-- "Public profiles are viewable by everyone" (USING true) makes every profiles
-- column anon-readable via REST and Realtime. The stripe_customer_id DATA moves
-- to profile_private_details; the profiles column is kept (shipped binaries
-- star-select profiles) but scrubbed and kept permanently NULL by a trigger.
--
-- Two deliberate differences from the phone migration:
--
-- 1. The trigger DISCARDS instead of diverting. phone has legitimate client
--    writers; stripe_customer_id's only legitimate writer is the
--    manage-payment-methods edge fn (service role), re-pointed at the private
--    table in the same rollout. Diverting would let an authenticated user
--    plant an arbitrary cus_… id in their private row via a profiles write —
--    manage-payment-methods mints ephemeral keys and honors detach ownership
--    checks against that value, so an attacker-chosen id means access to
--    someone else's saved cards.
--
-- 2. Authenticated write grants become column-scoped for the same reason.
--    The phone migration's GRANT was layered on Supabase default privileges,
--    leaving authenticated with table-wide ALL (every future column
--    client-writable, plus DELETE/TRUNCATE). Replaced with SELECT on the
--    table + INSERT/UPDATE on (user_id, phone, updated_at) only — the exact
--    payload of the shipped phone upserts. stripe_customer_id is
--    service-role-write-only.
--
-- Applied live 2026-08-26 in three chunks so neither fn version could lose a
-- write: §1+§2 → deploy re-pointed create-payment-intent +
-- manage-payment-methods → §3.

BEGIN;

-- ── §1 column + grants ──────────────────────────────────────────────────────
ALTER TABLE public.profile_private_details
  ADD COLUMN IF NOT EXISTS stripe_customer_id text;

REVOKE ALL ON public.profile_private_details FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.profile_private_details TO authenticated;
GRANT INSERT (user_id, phone, updated_at), UPDATE (user_id, phone, updated_at)
  ON public.profile_private_details TO authenticated;

-- ── §2 backfill (scrub deferred until the fns read the private table) ───────
INSERT INTO public.profile_private_details (user_id, stripe_customer_id, updated_at)
SELECT id, stripe_customer_id, now()
FROM public.profiles WHERE stripe_customer_id IS NOT NULL
ON CONFLICT (user_id) DO UPDATE
  SET stripe_customer_id = EXCLUDED.stripe_customer_id,
      updated_at         = EXCLUDED.updated_at;

-- ── §3 scrub + discard trigger ──────────────────────────────────────────────
UPDATE public.profiles SET stripe_customer_id = NULL WHERE stripe_customer_id IS NOT NULL;

-- Plain (non-DEFINER) function: it only nulls the incoming row, writes nothing.
CREATE OR REPLACE FUNCTION public.discard_profile_stripe_customer()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  NEW.stripe_customer_id := NULL;
  RETURN NEW;
END;
$$;
ALTER FUNCTION public.discard_profile_stripe_customer() OWNER TO postgres;

DROP TRIGGER IF EXISTS trg_discard_profile_stripe_customer ON public.profiles;
CREATE TRIGGER trg_discard_profile_stripe_customer
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW WHEN (NEW.stripe_customer_id IS NOT NULL)
  EXECUTE FUNCTION public.discard_profile_stripe_customer();

NOTIFY pgrst, 'reload schema';
COMMIT;
