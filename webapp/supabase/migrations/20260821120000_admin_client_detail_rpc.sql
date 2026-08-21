-- Admin client detail view RPC (2026-08-21)
--
-- Mirrors the get_admin_trainer_detail pattern (admin-guard SECURITY DEFINER,
-- see 20260801000000_admin_release_payment.sql) for the Users-tab client
-- drill-down. Schema facts confirmed live: bookings.trainer_id ->
-- trainer_profiles.id; reviews.trainer_id -> trainer_profiles.id; bookings
-- has slot_id -> availability_slots(start_time); profiles has is_suspended,
-- avatar_url, phone; spend column = bookings.rate_charged.

CREATE OR REPLACE FUNCTION public.get_admin_client_detail(p_user_id uuid)
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
    SELECT to_jsonb(r) FROM (
      SELECT
        p.id AS user_id, p.full_name, p.avatar_url, p.phone, p.is_suspended,
        p.created_at, u.email, u.last_sign_in_at,
        COALESCE(bc.total_bookings, 0)  AS total_bookings,
        COALESCE(bc.completed_count, 0) AS completed_count,
        COALESCE(bc.cancelled_count, 0) AS cancelled_count,
        COALESCE(bc.no_show_count, 0)   AS no_show_count,
        COALESCE(bc.total_spend, 0)     AS total_spend,
        COALESCE(rb.recent_bookings, '[]'::jsonb) AS recent_bookings,
        COALESCE(rv.reviews, '[]'::jsonb) AS reviews
      FROM public.profiles p
      JOIN auth.users u ON u.id = p.id
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS total_bookings,
               COUNT(*) FILTER (WHERE b.status = 'completed') AS completed_count,
               COUNT(*) FILTER (WHERE b.status = 'cancelled') AS cancelled_count,
               COUNT(*) FILTER (WHERE b.status = 'no_show')   AS no_show_count,
               COALESCE(SUM(b.rate_charged) FILTER (WHERE b.status = 'completed'), 0) AS total_spend
        FROM public.bookings b WHERE b.client_id = p.id
      ) bc ON true
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(jsonb_build_object(
          'id', b.id, 'status', b.status, 'rate_charged', b.rate_charged,
          'start_time', s.start_time, 'trainer_name', tpr.full_name
        ) ORDER BY s.start_time DESC) AS recent_bookings
        FROM (SELECT * FROM public.bookings bx WHERE bx.client_id = p.id
              ORDER BY bx.created_at DESC LIMIT 10) b
        JOIN public.availability_slots s ON s.id = b.slot_id
        JOIN public.trainer_profiles tp ON tp.id = b.trainer_id
        JOIN public.profiles tpr ON tpr.id = tp.user_id
      ) rb ON true
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(jsonb_build_object(
          'id', r.id, 'rating', r.rating, 'comment', r.comment,
          'created_at', r.created_at, 'trainer_name', tpr2.full_name
        ) ORDER BY r.created_at DESC) AS reviews
        FROM public.reviews r
        JOIN public.trainer_profiles tp2 ON tp2.id = r.trainer_id
        JOIN public.profiles tpr2 ON tpr2.id = tp2.user_id
        WHERE r.client_id = p.id
      ) rv ON true
      WHERE p.id = p_user_id AND p.role = 'client'
    ) r
  );
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.get_admin_client_detail(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
