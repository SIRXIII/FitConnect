-- profile_phone_privacy — close the public exposure of profiles.phone.
--
-- profiles_select_public (USING true) makes every profiles column — including
-- phone — readable by anon, via both REST and the Realtime change feed. The
-- policy must stay (trainer discovery embeds profiles everywhere), so the phone
-- DATA moves to a new self-only table `profile_private_details`. The profiles
-- column is kept (shipped mobile binaries upsert a `phone` key; PostgREST
-- rejects unknown payload columns) but is scrubbed and kept permanently NULL by
-- a diversion trigger, so old binaries keep working without repopulating it.
-- Admin dashboards read phone via the three SECURITY DEFINER RPCs below, which
-- are re-pointed at the private table (bodies taken from the LIVE definitions,
-- fetched 2026-08-25 — this repo's migration history is known to drift).

BEGIN;

-- ── 1. Private table (clients AND trainers) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profile_private_details (
  user_id    uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  phone      text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- New tables are anon-writable via Supabase default privileges until RLS is on.
ALTER TABLE public.profile_private_details ENABLE ROW LEVEL SECURITY;

-- Self-only. The UPDATE policy is required for PostgREST upserts on a
-- pre-existing row (INSERT .. ON CONFLICT DO UPDATE evaluates both).
DROP POLICY IF EXISTS profile_private_details_select_own ON public.profile_private_details;
CREATE POLICY profile_private_details_select_own ON public.profile_private_details
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS profile_private_details_insert_own ON public.profile_private_details;
CREATE POLICY profile_private_details_insert_own ON public.profile_private_details
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS profile_private_details_update_own ON public.profile_private_details;
CREATE POLICY profile_private_details_update_own ON public.profile_private_details
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

REVOKE ALL ON public.profile_private_details FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.profile_private_details TO authenticated;

-- ── 2. Backfill, then scrub the public column ───────────────────────────────
-- The scrub sets phone = NULL, so the diversion trigger's WHEN clause never
-- matches it regardless of creation order.
INSERT INTO public.profile_private_details (user_id, phone, updated_at)
SELECT id, phone, now() FROM public.profiles WHERE phone IS NOT NULL
ON CONFLICT (user_id) DO UPDATE SET phone = EXCLUDED.phone, updated_at = EXCLUDED.updated_at;

UPDATE public.profiles SET phone = NULL WHERE phone IS NOT NULL;

-- ── 3. Back-compat net for shipped binaries that still write profiles.phone ─
-- Deliberately NO role exemption (unlike the referral lockdown trigger): no
-- path, however privileged, may leave a real phone in profiles.phone.
-- On an authenticated upsert the trigger fires on the INSERT phase (nulls
-- NEW.phone) and the UPDATE-phase re-fire then fails the WHEN clause — one
-- effective diversion per write.
CREATE OR REPLACE FUNCTION public.divert_profile_phone_to_private()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO public.profile_private_details (user_id, phone, updated_at)
  VALUES (NEW.id, NEW.phone, now())
  ON CONFLICT (user_id) DO UPDATE SET phone = EXCLUDED.phone, updated_at = EXCLUDED.updated_at;
  NEW.phone := NULL;
  RETURN NEW;
END;
$$;
ALTER FUNCTION public.divert_profile_phone_to_private() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.divert_profile_phone_to_private() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_divert_profile_phone ON public.profiles;
CREATE TRIGGER trg_divert_profile_phone
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW WHEN (NEW.phone IS NOT NULL)
  EXECUTE FUNCTION public.divert_profile_phone_to_private();

-- ── 4. Admin RPCs: phone now comes from the private table ───────────────────
-- COALESCE(ppd.phone, p.phone) keeps a safety net during rollout.

CREATE OR REPLACE FUNCTION public.get_admin_client_detail(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_role text;
BEGIN
  SELECT role::text INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN (
    SELECT to_jsonb(r) FROM (
      SELECT
        p.id AS user_id, p.full_name, p.avatar_url,
        COALESCE(ppd.phone, p.phone) AS phone, p.is_suspended,
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
      LEFT JOIN public.profile_private_details ppd ON ppd.user_id = p.id
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
$function$;

CREATE OR REPLACE FUNCTION public.get_admin_pending_trainers()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
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
        tp.user_id,
        tp.id AS trainer_profile_id,
        tp.approval_status,
        tp.created_at,
        p.full_name,
        p.avatar_url,
        COALESCE(ppd.phone, p.phone) AS phone,
        u.email,
        u.last_sign_in_at,
        tp.bio,
        tp.specialty::text AS specialty,
        NULLIF(tp.location, '') AS trainer_location,
        NULLIF(p.location, '') AS profile_location,
        tp.hourly_rate,
        tp.optimized_rate,
        tp.discount_percentage,
        tp.credential_score,
        tp.verified_cert_count,
        tp.credentials_verified_at,
        tp.profile_completeness,
        tp.intro_video_url,
        tp.intro_video_thumbnail_url,
        tp.certifications,
        tp.certification_number,
        tp.certification_url,
        tp.gym_memberships,
        tp.stripe_account_id,
        tp.payouts_enabled,
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', tc.id,
            'cert_name', tc.cert_name,
            'cert_code', tc.cert_code,
            'cert_number', tc.cert_number,
            'status', tc.status,
            'expiry_date', tc.expiry_date,
            'file_url', tc.file_url,
            'file_path', tc.file_path,
            'submitted_at', tc.submitted_at
          ) ORDER BY tc.submitted_at DESC)
          FROM public.trainer_certifications tc
          WHERE tc.trainer_id = tp.id
        ), '[]'::jsonb) AS cert_documents
      FROM public.trainer_profiles tp
      JOIN public.profiles p ON p.id = tp.user_id
      JOIN auth.users u ON u.id = tp.user_id
      LEFT JOIN public.profile_private_details ppd ON ppd.user_id = tp.user_id
      WHERE tp.approval_status = 'pending'
      ORDER BY tp.created_at DESC
    ) r
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_admin_trainer_detail(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE v_role text;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN (
    SELECT to_jsonb(r)
    FROM (
      SELECT
        tp.user_id,
        tp.id AS trainer_profile_id,
        tp.approval_status,
        tp.created_at,
        p.full_name,
        p.avatar_url,
        COALESCE(ppd.phone, p.phone) AS phone,
        u.email,
        u.last_sign_in_at,
        tp.bio,
        tp.specialty::text AS specialty,
        NULLIF(tp.location, '') AS trainer_location,
        NULLIF(p.location, '') AS profile_location,
        tp.hourly_rate,
        tp.optimized_rate,
        tp.discount_percentage,
        tp.years_experience,
        tp.expertise_tags,
        tp.credential_score,
        tp.verified_cert_count,
        tp.credentials_verified_at,
        tp.profile_completeness,
        tp.intro_video_url,
        tp.intro_video_thumbnail_url,
        tp.certifications,
        tp.certification_number,
        tp.certification_url,
        tp.gym_memberships,
        tp.stripe_account_id,
        tp.payouts_enabled,
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', tc.id,
            'cert_name', tc.cert_name,
            'cert_code', tc.cert_code,
            'cert_number', tc.cert_number,
            'status', tc.status,
            'expiry_date', tc.expiry_date,
            'file_url', tc.file_url,
            'file_path', tc.file_path,
            'submitted_at', tc.submitted_at
          ) ORDER BY tc.submitted_at DESC)
          FROM public.trainer_certifications tc
          WHERE tc.trainer_id = tp.id
        ), '[]'::jsonb) AS cert_documents
      FROM public.trainer_profiles tp
      JOIN public.profiles p ON p.id = tp.user_id
      JOIN auth.users u ON u.id = tp.user_id
      LEFT JOIN public.profile_private_details ppd ON ppd.user_id = tp.user_id
      WHERE tp.user_id = p_user_id
    ) r
  );
END;
$function$;

NOTIFY pgrst, 'reload schema';
COMMIT;
