-- City Demand Nominations: a public demand-signal table, not a lead form.
-- Anyone can nominate their city ("I want a FitRush trainer here") with just
-- a first name + city/state, optionally naming a trainer to recruit. Each row
-- raises that city's running demand count, which becomes recruiting ammunition
-- ("14 people in Fresno are asking for a trainer"). No anon INSERT policy is
-- granted here (project convention: no `TO anon` INSERT policy exists anywhere
-- in the migration history). All writes go through the nominate-trainer edge
-- function's service-role client, which also rate-limits by IP.

CREATE TABLE IF NOT EXISTS public.trainer_nominations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name    text NOT NULL,
  city          text NOT NULL,
  state         text NOT NULL,
  nominee_name  text,
  nominee_email text,
  nominee_phone text,
  ip_hash       text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Powers the demand-count query: rows for a given (state, city).
CREATE INDEX IF NOT EXISTS idx_trainer_nominations_state_city
  ON public.trainer_nominations (state, lower(city));

-- Powers the per-IP daily rate limit check in the edge function.
CREATE INDEX IF NOT EXISTS idx_trainer_nominations_ip_hash_created_at
  ON public.trainer_nominations (ip_hash, created_at);

ALTER TABLE public.trainer_nominations ENABLE ROW LEVEL SECURITY;

-- No policies. INSERT handled by service-role key in the nominate-trainer
-- Edge Function (bypasses RLS). No SELECT policy, demand counts are surfaced
-- only via the admin alert email and direct DB query in v1; a public demand
-- board (security-definer RPC returning aggregates only) is a future add.

-- ============================================================
-- nominate_trainer_submit
-- Atomic rate-limit check + insert + city count for the
-- nominate-trainer edge function. Replaces three separate round trips
-- (recent-count SELECT, INSERT, city-count SELECT) that let two
-- concurrent requests from the same IP both pass the cap check before
-- either inserted (TOCTOU race).
-- ============================================================

CREATE OR REPLACE FUNCTION public.nominate_trainer_submit(
  p_first_name    text,
  p_city          text,
  p_state         text,
  p_nominee_name  text,
  p_nominee_email text,
  p_nominee_phone text,
  p_ip_hash       text,
  p_daily_cap     int DEFAULT 3
)
RETURNS TABLE(inserted boolean, city_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recent_count bigint;
  v_city_count   bigint;
BEGIN
  -- Serialize concurrent submissions from the same IP for the rest of this
  -- transaction, so the count check and the insert below are atomic. This
  -- closes the race where two simultaneous requests both read a count under
  -- the cap and both insert.
  PERFORM pg_advisory_xact_lock(hashtext(p_ip_hash));

  SELECT count(*) INTO v_recent_count
  FROM public.trainer_nominations
  WHERE ip_hash = p_ip_hash
    AND created_at >= now() - interval '24 hours';

  IF v_recent_count >= p_daily_cap THEN
    RETURN QUERY SELECT false, NULL::bigint;
    RETURN;
  END IF;

  INSERT INTO public.trainer_nominations (
    first_name, city, state, nominee_name, nominee_email, nominee_phone, ip_hash
  ) VALUES (
    p_first_name, p_city, p_state, p_nominee_name, p_nominee_email, p_nominee_phone, p_ip_hash
  );

  -- lower(city) matches idx_trainer_nominations_state_city so this count
  -- uses the index instead of a sequential scan.
  SELECT count(*) INTO v_city_count
  FROM public.trainer_nominations
  WHERE state = p_state AND lower(city) = lower(p_city);

  RETURN QUERY SELECT true, v_city_count;
END;
$$;

REVOKE ALL ON FUNCTION public.nominate_trainer_submit(text, text, text, text, text, text, text, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nominate_trainer_submit(text, text, text, text, text, text, text, int) FROM anon;
REVOKE ALL ON FUNCTION public.nominate_trainer_submit(text, text, text, text, text, text, text, int) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.nominate_trainer_submit(text, text, text, text, text, text, text, int) TO service_role;
