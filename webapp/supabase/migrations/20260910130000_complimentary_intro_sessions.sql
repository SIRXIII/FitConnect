-- Complimentary 30-min intro sessions (webapp self-serve booking).
--
-- WHY: the trainer OFFERS a complimentary intro (their time, no payout, no
-- Stripe call); quote_booking_price returns an all-zero quote for a slot
-- flagged is_intro, and _create_booking marks the resulting booking
-- is_comp + is_intro and confirms it directly (no pending -> webhook step,
-- since there is nothing to pay). Every CREATE OR REPLACE below is based on
-- the LIVE bodies (pg_get_functiondef against prod qecwxvvlpvrnrqyrdxrj,
-- 2026-09-10), not the 20260905120000 migration file, though the two were
-- verified identical for quote_booking_price and _create_booking.
--
-- Mobile (Flutter) is unaffected: the $0 branch only triggers on slots
-- flagged is_intro, and mobile never sets that flag.

BEGIN;

-- ============================================================
-- 1. trainer_profiles.offers_free_intro
-- ============================================================

ALTER TABLE public.trainer_profiles
  ADD COLUMN IF NOT EXISTS offers_free_intro boolean NOT NULL DEFAULT false;

-- ============================================================
-- 2. availability_slots.is_intro (+ shape trigger)
-- ============================================================

ALTER TABLE public.availability_slots
  ADD COLUMN IF NOT EXISTS is_intro boolean NOT NULL DEFAULT false;

ALTER TABLE public.availability_slots
  DROP CONSTRAINT IF EXISTS availability_slots_intro_requires_individual;
ALTER TABLE public.availability_slots
  ADD CONSTRAINT availability_slots_intro_requires_individual
    CHECK (NOT is_intro OR slot_type = 'individual');

-- Shape rule applies to every writer, including admin/service_role, no
-- current_user bypass (unlike bookings_freeze_protected_fields).
CREATE OR REPLACE FUNCTION public.enforce_intro_slot_shape()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_minutes        integer;
  v_actual_minutes numeric;
  v_offers_intro   boolean;
BEGIN
  IF NOT NEW.is_intro THEN
    RETURN NEW;
  END IF;

  -- Only validate the intro shape when it is actually being defined or changed.
  -- Routine updates to an existing intro slot (is_booked flips on booking and
  -- cancellation, updated_at, gcal fields) must NOT re-run this: otherwise a
  -- cancel or rebook would fail after the trainer turns offers_free_intro off
  -- or an admin edits free_intro_minutes, permanently wedging a confirmed intro
  -- booking and leaking the slot. INSERTs always validate; UPDATEs validate only
  -- when a shape-relevant column changes.
  IF TG_OP = 'UPDATE'
     AND NEW.is_intro    IS NOT DISTINCT FROM OLD.is_intro
     AND NEW.start_time  IS NOT DISTINCT FROM OLD.start_time
     AND NEW.end_time    IS NOT DISTINCT FROM OLD.end_time
     AND NEW.trainer_id  IS NOT DISTINCT FROM OLD.trainer_id THEN
    RETURN NEW;
  END IF;

  v_minutes := COALESCE(
    (SELECT ps.value FROM public.platform_settings ps WHERE ps.key = 'free_intro_minutes')::integer,
    30);

  v_actual_minutes := EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 60;
  IF v_actual_minutes <> v_minutes THEN
    RAISE EXCEPTION 'Complimentary intro slots must be % minutes long', v_minutes;
  END IF;

  SELECT tp.offers_free_intro INTO v_offers_intro
  FROM public.trainer_profiles tp
  WHERE tp.id = NEW.trainer_id;

  IF NOT COALESCE(v_offers_intro, false) THEN
    RAISE EXCEPTION 'Trainer is not currently offering complimentary intro sessions';
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.enforce_intro_slot_shape() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.enforce_intro_slot_shape() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_enforce_intro_slot_shape ON public.availability_slots;
CREATE TRIGGER trg_enforce_intro_slot_shape
  BEFORE INSERT OR UPDATE ON public.availability_slots
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_intro_slot_shape();

-- ============================================================
-- 3. bookings.is_intro (+ freeze-trigger key)
-- ============================================================

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS is_intro boolean NOT NULL DEFAULT false;

-- Same body as live (20260905120000), plus 'is_intro' in the protected key
-- list: a client must never be able to flip a booking into/out of intro
-- pricing after the fact.
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
  IF current_user IN ('service_role', 'postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  v_old := to_jsonb(OLD);
  v_new := to_jsonb(NEW);

  FOREACH v_key IN ARRAY ARRAY[
    'client_id', 'trainer_id', 'slot_id',
    'rate_charged', 'platform_fee', 'trainer_payout',
    'stripe_payment_intent_id', 'stripe_refund_id', 'is_comp', 'is_intro', 'payment_type'
  ] LOOP
    IF (v_old -> v_key) IS DISTINCT FROM (v_new -> v_key) THEN
      RAISE EXCEPTION 'bookings.% can only be changed server-side', v_key
        USING ERRCODE = '42501';
    END IF;
  END LOOP;

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

-- ============================================================
-- 4. platform_settings seeds
-- ============================================================

INSERT INTO public.platform_settings (key, value)
VALUES
  ('free_intro_until',          '2026-12-01'),
  ('free_intro_minutes',        '30'),
  ('free_intro_max_per_client', '2')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 5. quote_booking_price(): $0 branch for is_intro slots
-- ============================================================
--
-- DEVIATION FROM THE LIVE BODY: the live function is STABLE. The intro
-- branch below takes an advisory lock and then re-counts bookings so a
-- concurrent second call sees the first call's commit; a plpgsql function
-- marked STABLE is evaluated as a single query for snapshot purposes when
-- called from the single top-level statement in _create_booking, so the
-- post-lock count re-read the pre-lock snapshot and both concurrent intro
-- bookings passed the cap check (reproduced locally, fixed by dropping
-- STABLE). Confirmed with the DB test "concurrency: per-client cap enforced
-- under a race" below. The non-intro pricing path is unchanged and has no
-- correctness dependency on volatility either way.
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
  v_trainer_id          uuid;
  v_is_intro            boolean;
  v_offers_free_intro   boolean;
  v_free_intro_until    timestamptz;
  v_free_intro_max      integer;
  v_intro_used_trainer  integer;
  v_intro_used_total    integer;
BEGIN
  SELECT s.slot_type, s.group_rate, tp.optimized_rate,
         COALESCE(tp.discount_percentage, 0)::numeric,
         tp.created_at, tp.founding_benefit_started_at,
         s.trainer_id, s.is_intro, tp.offers_free_intro
    INTO v_slot_type, v_group_rate, v_optimized_rate,
         v_discount_pct, v_trainer_created_at, v_founding_started_at,
         v_trainer_id, v_is_intro, v_offers_free_intro
  FROM public.availability_slots s
  JOIN public.trainer_profiles tp ON tp.id = s.trainer_id
  WHERE s.id = p_slot_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Slot not found: %', p_slot_id;
  END IF;

  IF v_is_intro THEN
    -- Serialize concurrent intro bookings for the same client so the
    -- per-client cap below can't be beaten by a race across two trainers.
    PERFORM pg_advisory_xact_lock(hashtextextended('intro_booking:' || p_client_id::text, 0));

    IF NOT COALESCE(v_offers_free_intro, false) THEN
      RAISE EXCEPTION 'Trainer is not currently offering complimentary intro sessions';
    END IF;

    v_free_intro_until := COALESCE(
      (SELECT ps.value FROM public.platform_settings ps WHERE ps.key = 'free_intro_until'),
      '2026-12-01')::timestamptz;
    IF now() >= v_free_intro_until THEN
      RAISE EXCEPTION 'Complimentary intro sessions are no longer available';
    END IF;

    SELECT count(*) INTO v_intro_used_trainer
    FROM public.bookings b
    WHERE b.client_id = p_client_id
      AND b.trainer_id = v_trainer_id
      AND b.is_intro
      AND b.status <> 'cancelled';
    IF v_intro_used_trainer > 0 THEN
      RAISE EXCEPTION 'You have already used your complimentary intro with this trainer';
    END IF;

    v_free_intro_max := COALESCE(
      (SELECT ps.value FROM public.platform_settings ps WHERE ps.key = 'free_intro_max_per_client')::integer,
      2);
    SELECT count(*) INTO v_intro_used_total
    FROM public.bookings b
    WHERE b.client_id = p_client_id
      AND b.is_intro
      AND b.status <> 'cancelled';
    IF v_intro_used_total >= v_free_intro_max THEN
      RAISE EXCEPTION 'You have reached the limit of complimentary intro sessions';
    END IF;

    RETURN QUERY
    SELECT 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 'usd'::text;
    RETURN;
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

-- ============================================================
-- 6. _create_booking(): is_intro slots confirm directly, is_comp, no payment
-- ============================================================

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

  IF v_slot.is_gcal_blocked THEN
    RETURN json_build_object('error', 'slot_gcal_blocked');
  END IF;

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
    rate_charged, platform_fee, trainer_payout, notes,
    is_comp, is_intro
  )
  VALUES (
    p_client_id, p_trainer_id, p_slot_id,
    (CASE WHEN v_slot.is_intro THEN 'confirmed' ELSE 'pending' END)::booking_status,
    v_q.rate_charged, v_q.platform_fee, v_q.trainer_payout,
    COALESCE(p_notes, CASE WHEN v_slot.is_intro THEN 'Complimentary intro session' ELSE NULL END),
    v_slot.is_intro, v_slot.is_intro
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

-- ============================================================
-- 7. admin_set_offers_free_intro(): admin bulk/per-row toggle
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_set_offers_free_intro(
  p_user_ids uuid[],
  p_enabled  boolean
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  v_role  text;
  v_count integer;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = (SELECT auth.uid());
  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'admin_set_offers_free_intro: admin access required' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.trainer_profiles
  SET offers_free_intro = p_enabled
  WHERE user_id = ANY(p_user_ids);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

ALTER FUNCTION public.admin_set_offers_free_intro(uuid[], boolean) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.admin_set_offers_free_intro(uuid[], boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_offers_free_intro(uuid[], boolean) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
