-- Live repair 2026-09-05 (migration 1 of 2): calendar token → private storage,
-- server-authoritative booking money/identity, founding benefit anchor.
--
-- WHY (verified read-only against live qecwxvvlpvrnrqyrdxrj on 2026-09-05):
--   1. trainer_profiles.calendar_export_token is readable by anon (column grant +
--      the public approved-trainer SELECT policy). calendar-export looks a token
--      up and emits client names + notes, so every approved trainer's feed is
--      public. The token moves to trainer_private_details (owner-only RLS). This
--      file only COPIES the current values into the private table so the
--      still-deployed calendar-export v2 and the web bundle keep working through
--      the release; rotation + nulling the public column is migration 2
--      (20260905150000_rotate_calendar_tokens_null_public.sql), applied after
--      calendar-export v3 and the web release are live. The public column's
--      DEFAULT is dropped here so new trainer rows stop minting public tokens.
--   2. create_booking_atomic (SECURITY DEFINER, EXECUTE authenticated) trusted
--      p_client_id and all three money params; the bookings INSERT policy let a
--      client insert any row; the "Involved parties" UPDATE policy has no WITH
--      CHECK, so money columns, client_id and trainer_id were client-writable.
--      Money now comes from quote_booking_price() (client pays rate + fee,
--      trainer keeps 100% of rate), identity from the JWT, and a BEFORE UPDATE
--      trigger freezes the protected columns + function-owned status moves for
--      every role except service_role/postgres/supabase_admin.
--   3. The founding benefit (0% fee for 12 months for trainers who joined before
--      founding_cutoff) had no DB anchor; web keyed it to trainer_profiles.
--      created_at and native ignored it. New column founding_benefit_started_at,
--      stamped once by the first confirmed paid booking, backfilled from history.
--
-- Inverse (rollback) SQL, in order — additive steps are simply dropped; the
-- policy drop and the function replacements have their live originals in the
-- Flutter repo at docs/deployed-snapshots/2026-09-05/live-defs.sql:
--   DROP TRIGGER IF EXISTS bookings_set_founding_start ON public.bookings;
--   DROP FUNCTION IF EXISTS public.set_founding_benefit_start();
--   ALTER TABLE public.trainer_profiles DROP COLUMN IF EXISTS founding_benefit_started_at;
--   DROP TRIGGER IF EXISTS bookings_freeze_protected_fields ON public.bookings;
--   DROP FUNCTION IF EXISTS public.bookings_freeze_protected_fields();
--   CREATE POLICY "Clients can create bookings" ON public.bookings
--     FOR INSERT TO public WITH CHECK ((select auth.uid()) = client_id);
--   DROP FUNCTION IF EXISTS public.accept_booking_request(uuid);
--   DROP FUNCTION IF EXISTS public.release_pending_booking(uuid);
--   DROP FUNCTION IF EXISTS public.mark_booking_no_show(uuid);
--   DROP FUNCTION IF EXISTS public.decline_pending_booking(uuid);
--   -- restore create_booking_atomic + reset_calendar_export_token from live-defs.sql
--   DROP FUNCTION IF EXISTS public._create_booking(uuid, uuid, uuid, text, boolean);
--   DROP FUNCTION IF EXISTS public.quote_booking_price(uuid, uuid, boolean);
--   DROP FUNCTION IF EXISTS public.get_calendar_export_token();
--   ALTER TABLE public.trainer_profiles
--     ALTER COLUMN calendar_export_token SET DEFAULT gen_random_uuid()::text;
--   DROP INDEX IF EXISTS public.idx_trainer_private_details_calendar_token;
--   ALTER TABLE public.trainer_private_details
--     DROP COLUMN IF EXISTS calendar_export_token,
--     DROP COLUMN IF EXISTS calendar_token_rotated_at,
--     DROP COLUMN IF EXISTS calendar_token_notice_acked_at;
--   -- platform_settings seeds (fee_enabled / founding_cutoff already exist live)
--   -- and the anon REVOKE on trainer_private_details are safe to leave in place.

BEGIN;

-- ============================================================
-- 1. Calendar token → private storage
-- ============================================================

-- trainer_private_details is created by the Flutter repo's migration
-- (20260825070000_trainer_private_details.sql) and exists live. The local
-- webapp harness only references it inside admin RPC bodies, so mirror the live
-- definition when it is absent (no-op live).
DO $$
BEGIN
  IF to_regclass('public.trainer_private_details') IS NULL THEN
    CREATE TABLE public.trainer_private_details (
      user_id                   uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
      phone                     text,
      photo_guidelines_acked_at timestamptz,
      created_at                timestamptz NOT NULL DEFAULT now(),
      updated_at                timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE public.trainer_private_details ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Owner selects own private details" ON public.trainer_private_details
      FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
    CREATE POLICY "Owner inserts own private details" ON public.trainer_private_details
      FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
    CREATE POLICY "Owner updates own private details" ON public.trainer_private_details
      FOR UPDATE TO authenticated
      USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
  END IF;
END $$;

ALTER TABLE public.trainer_private_details
  ADD COLUMN IF NOT EXISTS calendar_export_token          text,
  ADD COLUMN IF NOT EXISTS calendar_token_rotated_at      timestamptz,
  ADD COLUMN IF NOT EXISTS calendar_token_notice_acked_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_trainer_private_details_calendar_token
  ON public.trainer_private_details (calendar_export_token)
  WHERE calendar_export_token IS NOT NULL;

-- anon holds INSERT/UPDATE/DELETE table grants with no policy — harmless but wrong.
REVOKE ALL ON public.trainer_private_details FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.trainer_private_details TO authenticated;

-- One private row per trainer (16 of 17 have none), COPYING the current public
-- token so feeds keep resolving until migration 2 rotates them.
INSERT INTO public.trainer_private_details (user_id, calendar_export_token)
SELECT tp.user_id, tp.calendar_export_token
FROM public.trainer_profiles tp
ON CONFLICT (user_id) DO UPDATE
  SET calendar_export_token = COALESCE(public.trainer_private_details.calendar_export_token,
                                       EXCLUDED.calendar_export_token),
      updated_at            = now();

-- New trainer_profiles rows stop minting public tokens. The column itself stays
-- (auth store does select('*')); migration 2 nulls it.
ALTER TABLE public.trainer_profiles
  ALTER COLUMN calendar_export_token DROP DEFAULT;

-- reset_calendar_export_token(): same signature/return, now writes the private table.
CREATE OR REPLACE FUNCTION public.reset_calendar_export_token()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  new_token text;
BEGIN
  IF v_uid IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.trainer_profiles tp WHERE tp.user_id = v_uid) THEN
    RAISE EXCEPTION 'No trainer profile found for current user';
  END IF;

  new_token := gen_random_uuid()::text;

  INSERT INTO public.trainer_private_details (user_id, calendar_export_token)
  VALUES (v_uid, new_token)
  ON CONFLICT (user_id) DO UPDATE
    SET calendar_export_token = EXCLUDED.calendar_export_token,
        updated_at            = now();

  RETURN new_token;
END;
$$;

ALTER FUNCTION public.reset_calendar_export_token() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.reset_calendar_export_token() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_calendar_export_token() TO authenticated;

-- get_calendar_export_token(): owner-only read, insert-if-missing. New trainers
-- onboard through web/Flutter paths that never create a trainer_private_details
-- row, and the public DEFAULT is gone, so the first read mints the token. While
-- the public column still holds a value (migration-1 window) it is reused so an
-- existing subscription keeps working.
CREATE OR REPLACE FUNCTION public.get_calendar_export_token()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_token text;
BEGIN
  IF v_uid IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.trainer_profiles tp WHERE tp.user_id = v_uid) THEN
    RAISE EXCEPTION 'No trainer profile found for current user';
  END IF;

  SELECT tpd.calendar_export_token INTO v_token
  FROM public.trainer_private_details tpd
  WHERE tpd.user_id = v_uid;

  IF v_token IS NULL THEN
    v_token := COALESCE(
      (SELECT tp.calendar_export_token FROM public.trainer_profiles tp WHERE tp.user_id = v_uid),
      gen_random_uuid()::text
    );

    INSERT INTO public.trainer_private_details (user_id, calendar_export_token)
    VALUES (v_uid, v_token)
    ON CONFLICT (user_id) DO UPDATE
      SET calendar_export_token = EXCLUDED.calendar_export_token,
          updated_at            = now()
      WHERE public.trainer_private_details.calendar_export_token IS NULL;

    -- Re-read: a concurrent first read may have won the upsert.
    SELECT tpd.calendar_export_token INTO v_token
    FROM public.trainer_private_details tpd
    WHERE tpd.user_id = v_uid;
  END IF;

  RETURN v_token;
END;
$$;

ALTER FUNCTION public.get_calendar_export_token() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_calendar_export_token() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_calendar_export_token() TO authenticated;

-- ============================================================
-- 2. Booking authority
-- ============================================================

-- Both exist live but no migration creates them; without the seeds the local
-- harness would compute a different fee. Every SQL read below still COALESCEs.
-- NOTE: live platform_settings is (key, value, updated_at) only — the base-schema
-- 'description' column was dropped in prod. Insert (key, value) so this applies to
-- both live and the local harness (description defaults NULL there).
INSERT INTO public.platform_settings (key, value)
VALUES
  ('fee_enabled',     'true'),
  ('founding_cutoff', '2026-10-01')
ON CONFLICT (key) DO NOTHING;

-- Founding anchor: set once by the first confirmed, non-comp, paid booking.
ALTER TABLE public.trainer_profiles
  ADD COLUMN IF NOT EXISTS founding_benefit_started_at timestamptz;

-- quote_booking_price(): the single source of truth for booking money.
--   rate          = group_rate (group slot) | optimized_rate less discount_percentage
--   referral      = $5 (capped at rate) when p_apply_referral, the client's own
--                   referral_discount_pending is set, and the slot is individual;
--                   only the client themself (or a service/SQL caller with no
--                   JWT) can have it applied, so the flag is never probed or
--                   spent by another user.
--   fee_pct       = 0 when fee_enabled='false'; 0 while the trainer is founding
--                   (created_at < founding_cutoff and founding_benefit_started_at
--                   is null or < 12 months ago); else platform_fee_pct
--   platform_fee  = round(rate * fee_pct, 2); total = rate + fee; payout = rate
CREATE OR REPLACE FUNCTION public.quote_booking_price(
  p_slot_id        uuid,
  p_client_id      uuid,
  p_apply_referral boolean DEFAULT true
)
RETURNS TABLE (
  rate_charged      numeric,
  discount_pct      numeric,
  referral_discount numeric,
  fee_pct           numeric,
  platform_fee      numeric,
  total             numeric,
  trainer_payout    numeric,
  currency          text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid                 uuid := auth.uid();
  v_slot_type           text;
  v_group_rate          numeric;
  v_optimized_rate      numeric;
  v_discount_pct        numeric;
  v_trainer_created_at  timestamptz;
  v_founding_started_at timestamptz;
  v_fee_enabled         boolean;
  v_fee_setting         numeric;
  v_cutoff              timestamptz;
  v_rate                numeric;
  v_referral            numeric := 0;
  v_fee_pct             numeric;
  v_fee                 numeric;
BEGIN
  SELECT s.slot_type, s.group_rate, tp.optimized_rate,
         COALESCE(tp.discount_percentage, 0)::numeric,
         tp.created_at, tp.founding_benefit_started_at
    INTO v_slot_type, v_group_rate, v_optimized_rate,
         v_discount_pct, v_trainer_created_at, v_founding_started_at
  FROM public.availability_slots s
  JOIN public.trainer_profiles tp ON tp.id = s.trainer_id
  WHERE s.id = p_slot_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Slot not found: %', p_slot_id;
  END IF;

  IF v_slot_type = 'group' THEN
    v_rate         := COALESCE(v_group_rate, 0);
    v_discount_pct := 0;
  ELSIF v_discount_pct > 0 THEN
    v_rate := round(v_optimized_rate * (1 - v_discount_pct / 100), 2);
  ELSE
    v_rate := v_optimized_rate;
  END IF;

  IF p_apply_referral
     AND v_slot_type IS DISTINCT FROM 'group'
     AND (v_uid IS NULL OR v_uid = p_client_id)
     AND EXISTS (
       SELECT 1 FROM public.profiles p
       WHERE p.id = p_client_id AND p.referral_discount_pending
     ) THEN
    v_referral := LEAST(5, v_rate);
    v_rate     := v_rate - v_referral;
  END IF;

  v_fee_enabled := COALESCE(
    (SELECT ps.value FROM public.platform_settings ps WHERE ps.key = 'fee_enabled'),
    'true') = 'true';
  v_fee_setting := COALESCE(
    (SELECT ps.value FROM public.platform_settings ps WHERE ps.key = 'platform_fee_pct')::numeric,
    0);
  v_cutoff := COALESCE(
    (SELECT ps.value FROM public.platform_settings ps WHERE ps.key = 'founding_cutoff'),
    '2026-10-01')::timestamptz;

  IF NOT v_fee_enabled THEN
    v_fee_pct := 0;
  ELSIF v_trainer_created_at < v_cutoff
        AND (v_founding_started_at IS NULL
             OR v_founding_started_at > now() - interval '12 months') THEN
    v_fee_pct := 0;
  ELSE
    v_fee_pct := v_fee_setting;
  END IF;

  v_fee := round(v_rate * v_fee_pct, 2);

  RETURN QUERY
  SELECT v_rate, v_discount_pct, v_referral, v_fee_pct, v_fee,
         v_rate + v_fee, v_rate, 'usd'::text;
END;
$$;

ALTER FUNCTION public.quote_booking_price(uuid, uuid, boolean) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.quote_booking_price(uuid, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quote_booking_price(uuid, uuid, boolean) TO authenticated, service_role;

-- _create_booking(): shared internal used by create_booking_atomic and
-- accept_booking_request. Keeps the live slot lock / capacity / gcal / live-trainer
-- checks and the {error: ...} return strings the web relies on; money comes from
-- quote_booking_price; the referral flag is consumed in the same transaction.
CREATE OR REPLACE FUNCTION public._create_booking(
  p_slot_id        uuid,
  p_client_id      uuid,
  p_trainer_id     uuid,
  p_notes          text,
  p_apply_referral boolean
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slot          availability_slots;
  v_booking_count integer;
  v_booking_id    uuid;
  v_q             record;
BEGIN
  SELECT * INTO v_slot
  FROM availability_slots
  WHERE id = p_slot_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'slot_not_found');
  END IF;

  IF v_slot.deleted_at IS NOT NULL THEN
    RETURN json_build_object('error', 'slot_deleted');
  END IF;

  -- Phase 31 CAL-03 — external-calendar hard-block guard (additive).
  IF v_slot.is_gcal_blocked THEN
    RETURN json_build_object('error', 'slot_gcal_blocked');
  END IF;

  -- The booked trainer is the slot's owner; a mismatched p_trainer_id would
  -- credit a different trainer.
  IF v_slot.trainer_id <> p_trainer_id THEN
    RAISE EXCEPTION 'p_trainer_id does not own p_slot_id' USING ERRCODE = '42501';
  END IF;

  IF v_slot.slot_type = 'group' THEN
    SELECT COUNT(*)::integer INTO v_booking_count
    FROM bookings
    WHERE slot_id = p_slot_id
      AND status IN ('confirmed', 'pending');

    IF v_booking_count >= v_slot.max_capacity THEN
      RETURN json_build_object('error', 'slot_taken');
    END IF;
  ELSE
    IF v_slot.is_booked THEN
      RETURN json_build_object('error', 'slot_taken');
    END IF;

    UPDATE availability_slots
    SET is_booked = true, updated_at = now()
    WHERE id = p_slot_id;
  END IF;

  IF (SELECT availability_status FROM trainer_profiles WHERE id = p_trainer_id) != 'live' THEN
    RAISE EXCEPTION 'Trainer is no longer available' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_q
  FROM public.quote_booking_price(p_slot_id, p_client_id, p_apply_referral);

  IF v_q.referral_discount > 0 THEN
    UPDATE public.profiles
    SET referral_discount_pending = false,
        referral_discount_trainer_id = NULL
    WHERE id = p_client_id;
  END IF;

  INSERT INTO bookings (
    client_id, trainer_id, slot_id, status,
    rate_charged, platform_fee, trainer_payout, notes
  )
  VALUES (
    p_client_id, p_trainer_id, p_slot_id, 'pending',
    v_q.rate_charged, v_q.platform_fee, v_q.trainer_payout, p_notes
  )
  RETURNING id INTO v_booking_id;

  RETURN json_build_object(
    'booking_id',     v_booking_id,
    'rate_charged',   v_q.rate_charged,
    'platform_fee',   v_q.platform_fee,
    'total',          v_q.total,
    'trainer_payout', v_q.trainer_payout
  );
END;
$$;

ALTER FUNCTION public._create_booking(uuid, uuid, uuid, text, boolean) OWNER TO postgres;
REVOKE ALL ON FUNCTION public._create_booking(uuid, uuid, uuid, text, boolean) FROM PUBLIC, anon, authenticated;

-- create_booking_atomic(): SAME signature and json contract (legacy callers keep
-- working). p_rate_charged / p_platform_fee / p_trainer_payout are accepted and
-- IGNORED. Identity comes from the JWT: a caller may only book for themself,
-- except the slot's trainer accepting a client who has a pending/accepted
-- booking_requests row for that slot (keeps the still-deployed web request-accept
-- flow working during the release window). auth.uid() is NULL for service-role
-- and direct SQL — the intended exemption (current_user is the definer inside a
-- SECURITY DEFINER function, so it cannot be used for this check).
CREATE OR REPLACE FUNCTION public.create_booking_atomic(
  p_slot_id        uuid,
  p_client_id      uuid,
  p_trainer_id     uuid,
  p_rate_charged   numeric,
  p_platform_fee   numeric,
  p_trainer_payout numeric,
  p_notes          text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NOT NULL AND p_client_id <> v_uid THEN
    IF NOT (
      EXISTS (
        SELECT 1 FROM public.trainer_profiles tp
        WHERE tp.id = p_trainer_id AND tp.user_id = v_uid
      )
      AND EXISTS (
        SELECT 1 FROM public.booking_requests br
        WHERE br.slot_id = p_slot_id
          AND br.client_id = p_client_id
          AND br.trainer_id = p_trainer_id
          AND br.status IN ('pending', 'accepted')
      )
    ) THEN
      RAISE EXCEPTION 'create_booking_atomic: p_client_id must be the caller'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN public._create_booking(p_slot_id, p_client_id, p_trainer_id, p_notes, true);
END;
$$;

ALTER FUNCTION public.create_booking_atomic(uuid, uuid, uuid, numeric, numeric, numeric, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.create_booking_atomic(uuid, uuid, uuid, numeric, numeric, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_booking_atomic(uuid, uuid, uuid, numeric, numeric, numeric, text) TO authenticated, service_role;

-- accept_booking_request(): one transaction for what the web did as two client
-- calls (booking_requests.update + create_booking_atomic). On a slot error the
-- request is left pending and the error json is returned unchanged.
CREATE OR REPLACE FUNCTION public.accept_booking_request(p_request_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_req    booking_requests;
  v_result json;
BEGIN
  SELECT * INTO v_req
  FROM public.booking_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking request not found: %', p_request_id;
  END IF;

  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.trainer_profiles tp
    WHERE tp.id = v_req.trainer_id AND tp.user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Not your booking request' USING ERRCODE = '42501';
  END IF;

  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'Booking request is not pending (status: %)', v_req.status;
  END IF;

  -- The trainer is the caller, so the client's referral discount is not applied
  -- here (matches the request-accept path before this migration).
  v_result := public._create_booking(v_req.slot_id, v_req.client_id, v_req.trainer_id, NULL, false);

  IF v_result ->> 'error' IS NOT NULL THEN
    RETURN v_result;
  END IF;

  UPDATE public.booking_requests
  SET status = 'accepted', accepted_at = now(), updated_at = now()
  WHERE id = p_request_id;

  RETURN v_result;
END;
$$;

ALTER FUNCTION public.accept_booking_request(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.accept_booking_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_booking_request(uuid) TO authenticated;

-- release_pending_booking(): replaces the web's no-op bookings.delete() when
-- PaymentIntent creation fails. The existing status-change trigger frees the slot.
CREATE OR REPLACE FUNCTION public.release_pending_booking(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_booking bookings;
BEGIN
  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found: %', p_booking_id;
  END IF;

  IF v_uid IS NULL OR v_booking.client_id <> v_uid THEN
    RAISE EXCEPTION 'Not your booking' USING ERRCODE = '42501';
  END IF;

  IF v_booking.status::text <> 'pending' THEN
    RAISE EXCEPTION 'Booking is not pending (status: %)', v_booking.status;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.payments p
    WHERE p.booking_id = p_booking_id AND p.status = 'succeeded'
  ) THEN
    RAISE EXCEPTION 'Booking already has a succeeded payment';
  END IF;

  UPDATE public.bookings
  SET status              = 'cancelled',
      cancelled_by        = v_uid,
      cancellation_reason = 'client_abandoned_checkout',
      updated_at          = now()
  WHERE id = p_booking_id;
END;
$$;

ALTER FUNCTION public.release_pending_booking(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.release_pending_booking(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.release_pending_booking(uuid) TO authenticated;

-- Guarded trainer RPCs the web already calls (TrainerBookings.tsx) but that did
-- not exist live. Definer-owned, so they pass the freeze trigger below.
CREATE OR REPLACE FUNCTION public.mark_booking_no_show(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_booking bookings;
  v_start   timestamptz;
BEGIN
  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found: %', p_booking_id;
  END IF;

  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.trainer_profiles tp
    WHERE tp.id = v_booking.trainer_id AND tp.user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Not your booking' USING ERRCODE = '42501';
  END IF;

  IF v_booking.status::text <> 'confirmed' THEN
    RAISE EXCEPTION 'Booking is not confirmed (status: %)', v_booking.status;
  END IF;

  SELECT s.start_time INTO v_start
  FROM public.availability_slots s
  WHERE s.id = v_booking.slot_id;

  IF v_start IS NULL OR v_start > now() THEN
    RAISE EXCEPTION 'Session has not started yet';
  END IF;

  UPDATE public.bookings
  SET status = 'no_show', updated_at = now()
  WHERE id = p_booking_id;
END;
$$;

ALTER FUNCTION public.mark_booking_no_show(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.mark_booking_no_show(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_booking_no_show(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.decline_pending_booking(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_booking bookings;
BEGIN
  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found: %', p_booking_id;
  END IF;

  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.trainer_profiles tp
    WHERE tp.id = v_booking.trainer_id AND tp.user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Not your booking' USING ERRCODE = '42501';
  END IF;

  IF v_booking.status::text <> 'pending' THEN
    RAISE EXCEPTION 'Booking is not pending (status: %)', v_booking.status;
  END IF;

  UPDATE public.bookings
  SET status              = 'cancelled',
      cancelled_by        = v_uid,
      cancellation_reason = 'trainer_declined',
      updated_at          = now()
  WHERE id = p_booking_id;
END;
$$;

ALTER FUNCTION public.decline_pending_booking(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.decline_pending_booking(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decline_pending_booking(uuid) TO authenticated;

-- All inserts now go through SECURITY DEFINER RPCs, the webhook (service_role)
-- or admin_arrange_comp_booking. Live name first; bookings_insert_client is the
-- local harness's equivalent (base schema), absent live.
DROP POLICY IF EXISTS "Clients can create bookings" ON public.bookings;
DROP POLICY IF EXISTS bookings_insert_client ON public.bookings;

-- Freeze trigger: SECURITY INVOKER so current_user is the caller's role, exactly
-- like enforce_referral_discount_lockdown. Compares to_jsonb(OLD)/to_jsonb(NEW)
-- over a key list so columns absent in the local harness (stripe_payment_intent_id,
-- stripe_refund_id, payment_type are Flutter-repo migrations) are simply not
-- present rather than a 42703. Participants keep notes, cancellation_reason,
-- verification/nudge columns, gcal_event_id and reminder_sent_at. The
-- "Involved parties can update bookings" policy stays as is.
CREATE OR REPLACE FUNCTION public.bookings_freeze_protected_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_old jsonb;
  v_new jsonb;
  v_key text;
BEGIN
  -- Service role / migrations / definer functions running as postgres are exempt.
  IF current_user IN ('service_role', 'postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  v_old := to_jsonb(OLD);
  v_new := to_jsonb(NEW);

  FOREACH v_key IN ARRAY ARRAY[
    'client_id', 'trainer_id', 'slot_id',
    'rate_charged', 'platform_fee', 'trainer_payout',
    'stripe_payment_intent_id', 'stripe_refund_id', 'is_comp', 'payment_type'
  ] LOOP
    IF (v_old -> v_key) IS DISTINCT FROM (v_new -> v_key) THEN
      RAISE EXCEPTION 'bookings.% can only be changed server-side', v_key
        USING ERRCODE = '42501';
    END IF;
  END LOOP;

  -- Payment / completion / cancel are function-owned; pending -> confirmed is the webhook's.
  IF NEW.status::text IS DISTINCT FROM OLD.status::text
     AND NEW.status::text IN ('confirmed', 'completed', 'cancelled', 'no_show') THEN
    RAISE EXCEPTION 'bookings.status -> % can only be set server-side', NEW.status
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.bookings_freeze_protected_fields() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.bookings_freeze_protected_fields() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS bookings_freeze_protected_fields ON public.bookings;
CREATE TRIGGER bookings_freeze_protected_fields
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.bookings_freeze_protected_fields();

-- ============================================================
-- 3. Founding benefit
-- ============================================================

-- Stamp founding_benefit_started_at once, on the first confirmed paid booking:
-- native inserts confirmed rows from the webhook, web goes pending -> confirmed.
-- No PaymentIntent-id condition: web bookings carry it on payments, not here.
-- Set-once; refunds/retries never reset it.
CREATE OR REPLACE FUNCTION public.set_founding_benefit_start()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cutoff timestamptz;
BEGIN
  IF NEW.status::text <> 'confirmed' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status::text = 'confirmed' THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.is_comp, false) OR COALESCE(NEW.rate_charged, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  v_cutoff := COALESCE(
    (SELECT ps.value FROM public.platform_settings ps WHERE ps.key = 'founding_cutoff'),
    '2026-10-01')::timestamptz;

  UPDATE public.trainer_profiles
  SET founding_benefit_started_at = now()
  WHERE id = NEW.trainer_id
    AND founding_benefit_started_at IS NULL
    AND created_at < v_cutoff;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.set_founding_benefit_start() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.set_founding_benefit_start() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS bookings_set_founding_start ON public.bookings;
CREATE TRIGGER bookings_set_founding_start
  AFTER INSERT OR UPDATE OF status ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_founding_benefit_start();

-- Backfill from history: earliest confirmed/completed, non-comp, paid booking per
-- founding trainer (Derek fc985883, joined 2026-06-17, anchors at 2026-06-18).
UPDATE public.trainer_profiles tp
SET founding_benefit_started_at = fb.first_paid_at
FROM (
  SELECT b.trainer_id, min(b.created_at) AS first_paid_at
  FROM public.bookings b
  WHERE b.status::text IN ('confirmed', 'completed')
    AND NOT COALESCE(b.is_comp, false)
    AND b.rate_charged > 0
  GROUP BY b.trainer_id
) fb
WHERE fb.trainer_id = tp.id
  AND tp.founding_benefit_started_at IS NULL
  AND tp.created_at < COALESCE(
    (SELECT ps.value FROM public.platform_settings ps WHERE ps.key = 'founding_cutoff'),
    '2026-10-01')::timestamptz;

COMMIT;

NOTIFY pgrst, 'reload schema';
