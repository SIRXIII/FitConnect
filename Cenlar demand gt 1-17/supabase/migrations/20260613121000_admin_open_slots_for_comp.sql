-- Helper RPC: open future slots across approved trainers, for the admin comp-arrange picker.
CREATE OR REPLACE FUNCTION public.get_admin_open_slots()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role text;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Admin access required'; END IF;
  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(r) ORDER BY r.start_time), '[]'::jsonb)
    FROM (
      SELECT
        s.id                                   AS slot_id,
        tp.id                                  AS trainer_profile_id,
        pr.full_name                           AS trainer_name,
        COALESCE(tp.optimized_rate, tp.hourly_rate, 0)::numeric AS rate,
        s.start_time,
        s.end_time,
        (EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 60)::int AS duration_minutes
      FROM public.availability_slots s
      JOIN public.trainer_profiles tp ON tp.id = s.trainer_id
      JOIN public.profiles pr ON pr.id = tp.user_id
      WHERE s.is_booked = false
        AND s.deleted_at IS NULL
        AND s.start_time > now()
        AND tp.approval_status = 'approved'
      ORDER BY s.start_time
    ) r
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_admin_open_slots() TO authenticated;
NOTIFY pgrst, 'reload schema';
