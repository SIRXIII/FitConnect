-- Onboarding funnel + free-session program metrics for the Analytics tab.
CREATE OR REPLACE FUNCTION public.get_admin_free_session_metrics()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role text;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Admin access required'; END IF;
  RETURN jsonb_build_object(
    'new_clients', (SELECT count(*) FROM public.profiles WHERE role = 'client'),
    'booked_any', (SELECT count(DISTINCT client_id) FROM public.bookings),
    'first_free_done', (
      SELECT count(*) FROM (
        SELECT client_id FROM public.bookings WHERE is_comp = true AND status = 'completed'
        GROUP BY client_id HAVING count(*) >= 1
      ) a),
    'second_free_done', (
      SELECT count(*) FROM (
        SELECT client_id FROM public.bookings WHERE is_comp = true AND status = 'completed'
        GROUP BY client_id HAVING count(*) >= 2
      ) b),
    'converted_paid', (
      SELECT count(DISTINCT b.client_id)
      FROM public.bookings b JOIN public.payments p ON p.booking_id = b.id
      WHERE b.is_comp = false AND p.status = 'succeeded'),
    'credits_granted', (SELECT count(*) FROM public.client_session_credits),
    'credits_available', (SELECT count(*) FROM public.client_session_credits WHERE status = 'available'),
    'credits_redeemed', (SELECT count(*) FROM public.client_session_credits WHERE status = 'redeemed'),
    'comp_no_shows', (SELECT count(*) FROM public.client_session_credits WHERE outcome = 'no_show'),
    'comp_cost_total', (SELECT COALESCE(SUM(trainer_payout),0)::numeric FROM public.bookings WHERE is_comp = true AND status = 'completed'),
    'comp_cost_unpaid', (
      SELECT COALESCE(SUM(p.trainer_payout),0)::numeric
      FROM public.payments p WHERE p.is_comp = true AND p.status = 'succeeded' AND p.payout_transaction_id IS NULL)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_admin_free_session_metrics() TO authenticated;
NOTIFY pgrst, 'reload schema';
