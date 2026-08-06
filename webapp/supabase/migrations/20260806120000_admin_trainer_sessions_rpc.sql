-- Admin weekly trainer-session view (2026-08-06)
--
-- Backs the "View" button on the Payouts tab: a read-only window into one
-- trainer's sessions for a date range, so the admin can tick which completed
-- sessions to release instead of paying the whole balance at once. Powers
-- partial payouts (create-payout payment_ids).
--
-- Eligibility for release is derived client-side from these columns and matches
-- the create-payout gate exactly: booking completed + payment succeeded +
-- payment row exists + not already swept into a payout.

CREATE OR REPLACE FUNCTION public.get_admin_trainer_sessions(
  p_trainer_profile_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_role text;
BEGIN
  SELECT role::text INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(r) ORDER BY r.start_time), '[]'::jsonb)
    FROM (
      SELECT
        b.id AS booking_id,
        b.status::text AS booking_status,
        b.is_comp,
        s.start_time,
        s.end_time,
        cp.full_name AS client_name,
        b.rate_charged,
        b.trainer_payout,
        pay.id AS payment_id,
        pay.status::text AS payment_status,
        pay.trainer_payout AS payment_trainer_payout,
        pay.payout_transaction_id
      FROM public.bookings b
      JOIN public.availability_slots s ON s.id = b.slot_id
      JOIN public.profiles cp ON cp.id = b.client_id
      LEFT JOIN public.payments pay ON pay.booking_id = b.id
      WHERE b.trainer_id = p_trainer_profile_id
        AND s.start_time >= p_from
        AND s.start_time < p_to
    ) r
  );
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.get_admin_trainer_sessions(uuid, timestamptz, timestamptz) TO authenticated;

NOTIFY pgrst, 'reload schema';
