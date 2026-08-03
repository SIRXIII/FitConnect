-- Migration: Free Session Credits
-- Adds complimentary / onboarding session credit system.
-- Writes two new boolean columns, a credits table, seeding trigger,
-- booking-completion trigger, and admin RPCs.
-- All CREATEs are idempotent.

-- ============================================================
-- 1. Add is_comp column to bookings
-- ============================================================

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS is_comp boolean NOT NULL DEFAULT false;

-- ============================================================
-- 2. Add is_comp column to payments
-- ============================================================

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS is_comp boolean NOT NULL DEFAULT false;

-- ============================================================
-- 3. client_session_credits table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.client_session_credits (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason        text        NOT NULL DEFAULT 'onboarding'
                              CHECK (reason IN ('onboarding', 'make_good')),
  status        text        NOT NULL DEFAULT 'available'
                              CHECK (status IN ('available', 'reserved', 'redeemed', 'expired', 'revoked')),
  booking_id    uuid        REFERENCES public.bookings(id) ON DELETE SET NULL,
  trainer_id    uuid        REFERENCES public.trainer_profiles(id) ON DELETE SET NULL,
  granted_by    uuid        REFERENCES public.profiles(id),
  outcome       text        CHECK (outcome IN ('completed', 'no_show', 'cancelled', 'flagged')),
  granted_at    timestamptz NOT NULL DEFAULT now(),
  redeemed_at   timestamptz,
  notes         text
);

CREATE INDEX IF NOT EXISTS idx_client_session_credits_client_status
  ON public.client_session_credits (client_id, status);

ALTER TABLE public.client_session_credits ENABLE ROW LEVEL SECURITY;

-- Admin SELECT
DROP POLICY IF EXISTS "Admins can view all session credits" ON public.client_session_credits;
CREATE POLICY "Admins can view all session credits"
  ON public.client_session_credits
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- Admin INSERT
DROP POLICY IF EXISTS "Admins can insert session credits" ON public.client_session_credits;
CREATE POLICY "Admins can insert session credits"
  ON public.client_session_credits
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- Admin UPDATE
DROP POLICY IF EXISTS "Admins can update session credits" ON public.client_session_credits;
CREATE POLICY "Admins can update session credits"
  ON public.client_session_credits
  FOR UPDATE TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- Admin DELETE
DROP POLICY IF EXISTS "Admins can delete session credits" ON public.client_session_credits;
CREATE POLICY "Admins can delete session credits"
  ON public.client_session_credits
  FOR DELETE TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- ============================================================
-- 4. seed_onboarding_credits() function + trigger
--    Fires on profile INSERT or role UPDATE; grants 2 onboarding
--    credits to every new client, exactly once (idempotent).
-- ============================================================

CREATE OR REPLACE FUNCTION public.seed_onboarding_credits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_count int;
BEGIN
  -- Only act when the row is (or has become) a client
  IF NEW.role IS DISTINCT FROM 'client' THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_existing_count
  FROM public.client_session_credits
  WHERE client_id = NEW.id
    AND reason = 'onboarding';

  IF v_existing_count = 0 THEN
    INSERT INTO public.client_session_credits (client_id, reason, status)
    VALUES
      (NEW.id, 'onboarding', 'available'),
      (NEW.id, 'onboarding', 'available');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_onboarding_credits ON public.profiles;
CREATE TRIGGER trg_seed_onboarding_credits
  AFTER INSERT OR UPDATE OF role
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_onboarding_credits();

-- ============================================================
-- 5. handle_comp_booking_completion() function + trigger
--    Fires on bookings UPDATE; handles comp-booking lifecycle:
--      completed  → zero-dollar payment record + mark credit redeemed
--      cancelled  → release credit back to available
--      no_show    → mark credit consumed (redeemed / no_show outcome)
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_comp_booking_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only process comp bookings with a meaningful status change
  IF NOT NEW.is_comp THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    -- Insert zero-dollar payment record (guard against duplicate)
    IF NOT EXISTS (
      SELECT 1 FROM public.payments WHERE booking_id = NEW.id
    ) THEN
      INSERT INTO public.payments (
        booking_id, client_id, amount, platform_fee, trainer_payout,
        status, is_comp
      ) VALUES (
        NEW.id, NEW.client_id, 0, 0, NEW.trainer_payout,
        'succeeded', true
      );
    END IF;

    -- Mark the linked credit as redeemed
    UPDATE public.client_session_credits
    SET
      status     = 'redeemed',
      outcome    = 'completed',
      redeemed_at = now()
    WHERE booking_id = NEW.id;

  ELSIF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    -- Release credit so it can be re-used
    UPDATE public.client_session_credits
    SET
      status     = 'available',
      booking_id = NULL,
      trainer_id = NULL,
      outcome    = 'cancelled',
      redeemed_at = NULL
    WHERE booking_id = NEW.id;

  ELSIF NEW.status = 'no_show' AND OLD.status IS DISTINCT FROM 'no_show' THEN
    -- Credit is consumed (no re-use on no-show)
    UPDATE public.client_session_credits
    SET
      status      = 'redeemed',
      outcome     = 'no_show',
      redeemed_at = now()
    WHERE booking_id = NEW.id;

  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_comp_booking_completion ON public.bookings;
CREATE TRIGGER trg_comp_booking_completion
  AFTER UPDATE
  ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_comp_booking_completion();

-- ============================================================
-- 6. get_admin_session_credits() SECURITY DEFINER RPC
--    Returns per-client credit summary with nested credit rows
--    including trainer name and outcome.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_admin_session_credits()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_role text;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb)
    FROM (
      SELECT
        p.id                                AS client_id,
        p.full_name,
        u.email,
        COUNT(csc.id)                       AS granted_count,
        COUNT(csc.id) FILTER (WHERE csc.status = 'available')  AS available_count,
        COUNT(csc.id) FILTER (WHERE csc.status = 'redeemed')   AS redeemed_count,
        COUNT(csc.id) FILTER (WHERE csc.outcome = 'no_show')   AS no_show_count,
        COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'id',           csc.id,
              'reason',       csc.reason,
              'status',       csc.status,
              'outcome',      csc.outcome,
              'booking_id',   csc.booking_id,
              'granted_at',   csc.granted_at,
              'redeemed_at',  csc.redeemed_at,
              'notes',        csc.notes,
              'trainer_name', tp_pr.full_name
            )
          ) FILTER (WHERE csc.id IS NOT NULL),
          '[]'::jsonb
        )                                   AS credits
      FROM public.profiles p
      JOIN auth.users u ON u.id = p.id
      LEFT JOIN public.client_session_credits csc ON csc.client_id = p.id
      LEFT JOIN public.trainer_profiles tp ON tp.id = csc.trainer_id
      LEFT JOIN public.profiles tp_pr ON tp_pr.id = tp.user_id
      WHERE p.role = 'client'
      GROUP BY p.id, p.full_name, u.email
      ORDER BY COUNT(csc.id) DESC
    ) r
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_session_credits() TO authenticated;

-- ============================================================
-- 7. admin_grant_comp_session() SECURITY DEFINER RPC
--    Inserts one credit for the given client. Returns new credit id.
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_grant_comp_session(
  p_client_id uuid,
  p_reason    text DEFAULT 'make_good',
  p_notes     text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role      text;
  v_credit_id uuid;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  INSERT INTO public.client_session_credits (
    client_id, reason, status, granted_by, notes
  ) VALUES (
    p_client_id, p_reason, 'available', auth.uid(), p_notes
  )
  RETURNING id INTO v_credit_id;

  RETURN v_credit_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_grant_comp_session(uuid, text, text) TO authenticated;

-- ============================================================
-- 8. admin_arrange_comp_booking() SECURITY DEFINER RPC
--    Locks the slot (FOR UPDATE), validates it is free,
--    creates an is_comp booking, marks the slot booked,
--    and reserves the credit — all atomically.
--    Returns the new booking id (uuid).
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_arrange_comp_booking(
  p_credit_id  uuid,
  p_trainer_id uuid,
  p_slot_id    uuid,
  p_rate       numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role       text;
  v_slot       public.availability_slots;
  v_credit     public.client_session_credits;
  v_booking_id uuid;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  -- Lock the slot to prevent concurrent double-booking
  SELECT * INTO v_slot
  FROM public.availability_slots
  WHERE id = p_slot_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Slot not found: %', p_slot_id;
  END IF;

  IF v_slot.is_booked THEN
    RAISE EXCEPTION 'Slot is already booked: %', p_slot_id;
  END IF;

  IF v_slot.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Slot has been deleted: %', p_slot_id;
  END IF;

  -- Validate the credit
  SELECT * INTO v_credit
  FROM public.client_session_credits
  WHERE id = p_credit_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Credit not found: %', p_credit_id;
  END IF;

  IF v_credit.status IS DISTINCT FROM 'available' THEN
    RAISE EXCEPTION 'Credit is not available (status: %)', v_credit.status;
  END IF;

  -- Create the comp booking (confirmed, zero cost to client)
  INSERT INTO public.bookings (
    client_id, trainer_id, slot_id, status,
    rate_charged, platform_fee, trainer_payout,
    is_comp, notes
  ) VALUES (
    v_credit.client_id, p_trainer_id, p_slot_id, 'confirmed',
    0, 0, p_rate,
    true, 'Complimentary session (admin-arranged)'
  )
  RETURNING id INTO v_booking_id;

  -- Mark slot as booked (mirrors create_booking_atomic)
  UPDATE public.availability_slots
  SET is_booked = true, updated_at = now()
  WHERE id = p_slot_id;

  -- Reserve the credit against this booking
  UPDATE public.client_session_credits
  SET
    status      = 'reserved',
    booking_id  = v_booking_id,
    trainer_id  = p_trainer_id,
    redeemed_at = now()
  WHERE id = p_credit_id;

  RETURN v_booking_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_arrange_comp_booking(uuid, uuid, uuid, numeric) TO authenticated;

-- ============================================================
-- 9. get_admin_comp_owed() SECURITY DEFINER RPC
--    Returns per-trainer summary of completed comp sessions
--    where the trainer_payout has not yet been swept into a
--    payout_transaction (payout_transaction_id IS NULL).
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_admin_comp_owed()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_role text;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb)
    FROM (
      SELECT
        tp.id                              AS trainer_profile_id,
        tp.user_id                         AS trainer_user_id,
        pr.full_name                       AS trainer_name,
        tp.stripe_account_id,
        COUNT(pay.id)::int                 AS comp_count,
        COALESCE(SUM(pay.trainer_payout), 0)::numeric AS comp_owed
      FROM public.trainer_profiles tp
      JOIN public.profiles pr ON pr.id = tp.user_id
      JOIN public.bookings b
        ON b.trainer_id = tp.id
        AND b.is_comp = true
        AND b.status = 'completed'
      JOIN public.payments pay
        ON pay.booking_id = b.id
        AND pay.is_comp = true
        AND pay.status = 'succeeded'
        AND pay.payout_transaction_id IS NULL
      GROUP BY tp.id, tp.user_id, pr.full_name, tp.stripe_account_id
      ORDER BY comp_owed DESC
    ) r
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_comp_owed() TO authenticated;

-- ============================================================
-- 10. Notify PostgREST to reload schema cache
-- ============================================================

NOTIFY pgrst, 'reload schema';
