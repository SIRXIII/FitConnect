-- Daily expiry sweep: flip approved certs past expiry to 'expired' and recompute scores.
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.expire_certifications()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_trainers uuid[]; v_count int; r uuid;
BEGIN
  WITH upd AS (
    UPDATE public.trainer_certifications SET status='expired'
    WHERE status='approved' AND expiry_date IS NOT NULL AND expiry_date < current_date
    RETURNING trainer_id
  )
  SELECT array_agg(DISTINCT trainer_id), count(*) INTO v_trainers, v_count FROM upd;
  IF v_trainers IS NOT NULL THEN
    FOREACH r IN ARRAY v_trainers LOOP
      PERFORM public.recompute_credential_score(r);
    END LOOP;
  END IF;
  RETURN COALESCE(v_count, 0);
END;$$;
GRANT EXECUTE ON FUNCTION public.expire_certifications() TO authenticated;

-- daily at 08:00 UTC; cron.schedule upserts by jobname (idempotent)
SELECT cron.schedule('expire-certifications-daily', '0 8 * * *', 'SELECT public.expire_certifications();');
