-- 20260529000000_reconcile_admin_schema.sql
-- Phase 27: Reconcile admin dashboard schema drift (idempotent forward migration)
-- Applied via Supabase MCP apply_migration — do NOT run via supabase db push.
-- All 6 broken admin surfaces. Sources: admin_role.sql, trainer_discount.sql,
-- enhanced_reviews.sql, audit_log.sql (exact DDL bodies transcribed verbatim).

BEGIN;

-- ─── 1. profiles.is_suspended ─────────────────────────────────────────────
-- Source: 20260313120000_admin_role.sql
-- CORRECTION 2 (orchestrator 2026-05-29): profiles.role is ENUM user_role(client,trainer,admin);
-- admin is already valid. No constraint widening or enum addition is needed.
-- The role-check block from the source migration is intentionally omitted here.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_suspended boolean NOT NULL DEFAULT false;

-- Admin RLS policies for profiles (DROP IF EXISTS first — idempotent)
DROP POLICY IF EXISTS "profiles_admin_select_all" ON public.profiles;
CREATE POLICY "profiles_admin_select_all" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS "profiles_admin_update" ON public.profiles;
CREATE POLICY "profiles_admin_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS "bookings_admin_select_all" ON public.bookings;
CREATE POLICY "bookings_admin_select_all" ON public.bookings
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS "payments_admin_select_all" ON public.payments;
CREATE POLICY "payments_admin_select_all" ON public.payments
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS "trainer_profiles_admin_select_all" ON public.trainer_profiles;
CREATE POLICY "trainer_profiles_admin_select_all" ON public.trainer_profiles
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS "platform_settings_admin_update" ON public.platform_settings;
CREATE POLICY "platform_settings_admin_update" ON public.platform_settings
  FOR UPDATE TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- ─── 2. trainer_profiles.discount_percentage ──────────────────────────────
-- Source: 20260313110000_trainer_discount.sql
-- Idempotency: drop the CHECK constraint before ADD COLUMN (it's inlined);
-- if the column already existed without the constraint, the DROP is a no-op.
ALTER TABLE public.trainer_profiles
  DROP CONSTRAINT IF EXISTS trainer_profiles_discount_range;

ALTER TABLE public.trainer_profiles
  ADD COLUMN IF NOT EXISTS discount_percentage integer NOT NULL DEFAULT 0
  CONSTRAINT trainer_profiles_discount_range CHECK (discount_percentage >= 0 AND discount_percentage <= 80);

COMMENT ON COLUMN public.trainer_profiles.discount_percentage IS
  'Trainer-set discount on optimized_rate. 0 = no discount. 5–80 = percentage off.';

-- ─── 3. reviews enhanced columns ─────────────────────────────────────────
-- Source: 20260313140000_enhanced_reviews.sql
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS rating_punctuality   smallint CHECK (rating_punctuality   BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_expertise     smallint CHECK (rating_expertise     BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_communication smallint CHECK (rating_communication BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS trainer_response     text CHECK (char_length(trainer_response) <= 1000),
  ADD COLUMN IF NOT EXISTS trainer_response_at  timestamptz,
  ADD COLUMN IF NOT EXISTS is_flagged           boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS flagged_at           timestamptz,
  ADD COLUMN IF NOT EXISTS is_hidden            boolean NOT NULL DEFAULT false;

-- Moderation RLS policies
DROP POLICY IF EXISTS "Trainers can respond to their reviews" ON reviews;
CREATE POLICY "Trainers can respond to their reviews"
  ON reviews FOR UPDATE
  USING (trainer_id = auth.uid())
  WITH CHECK (trainer_id = auth.uid());

DROP POLICY IF EXISTS "Clients can flag their own reviews" ON reviews;
CREATE POLICY "Clients can flag their own reviews"
  ON reviews FOR UPDATE
  USING (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());

DROP POLICY IF EXISTS "Admin can moderate reviews" ON reviews;
CREATE POLICY "Admin can moderate reviews"
  ON reviews FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Aggregate view for trainer cards
CREATE OR REPLACE VIEW public.trainer_review_stats AS
  SELECT
    trainer_id,
    COUNT(*)                                          AS review_count,
    ROUND(AVG(rating)::numeric, 1)                   AS avg_overall,
    ROUND(AVG(rating_punctuality)::numeric, 1)       AS avg_punctuality,
    ROUND(AVG(rating_expertise)::numeric, 1)         AS avg_expertise,
    ROUND(AVG(rating_communication)::numeric, 1)     AS avg_communication
  FROM reviews
  WHERE is_hidden = false
  GROUP BY trainer_id;

-- ─── 4. audit_log: TABLE → function → triggers (ORDER IS CRITICAL) ────────
-- Source: 20260317200000_audit_log.sql
-- Pitfall 1: table MUST exist before function, function MUST exist before triggers.
-- A trigger firing before the table exists will roll back every trainer_profiles write.

CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  table_name text NOT NULL,
  record_id text,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON public.audit_log (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_table ON public.audit_log (table_name);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can view audit log" ON public.audit_log;
CREATE POLICY "Admin can view audit log"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Service role can insert audit log" ON public.audit_log;
CREATE POLICY "Service role can insert audit log"
  ON public.audit_log FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can insert audit log" ON public.audit_log;
CREATE POLICY "Authenticated can insert audit log"
  ON public.audit_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old jsonb;
  v_new jsonb;
  v_action text;
  v_record_id text;
BEGIN
  v_action := TG_OP;

  IF TG_OP = 'DELETE' THEN
    v_old := row_to_json(OLD)::jsonb;
    v_new := NULL;
    v_record_id := OLD.id::text;
  ELSIF TG_OP = 'INSERT' THEN
    v_old := NULL;
    v_new := row_to_json(NEW)::jsonb;
    v_record_id := NEW.id::text;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old := row_to_json(OLD)::jsonb;
    v_new := row_to_json(NEW)::jsonb;
    v_record_id := NEW.id::text;
  END IF;

  INSERT INTO public.audit_log (actor_id, action, table_name, record_id, old_values, new_values)
  VALUES (auth.uid(), v_action, TG_TABLE_NAME, v_record_id, v_old, v_new);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS audit_trainer_profiles ON public.trainer_profiles;
CREATE TRIGGER audit_trainer_profiles
  AFTER INSERT OR UPDATE OR DELETE ON public.trainer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS audit_payments ON public.payments;
CREATE TRIGGER audit_payments
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS audit_bookings ON public.bookings;
CREATE TRIGGER audit_bookings
  AFTER INSERT OR UPDATE OR DELETE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS audit_platform_settings ON public.platform_settings;
CREATE TRIGGER audit_platform_settings
  AFTER INSERT OR UPDATE OR DELETE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- ─── 5. support_tickets FK → profiles ────────────────────────────────────
-- CORRECTION 1 (orchestrator live-DB check 2026-05-29):
-- A constraint NAMED support_tickets_user_id_fkey ALREADY EXISTS → auth.users.
-- PostgREST embed profiles!support_tickets_user_id_fkey REQUIRES that name to
-- target profiles. An IF-NOT-EXISTS guard would no-op (name exists) and leave
-- the Support tab 400. 0 orphan user_id rows confirmed → safe to drop and re-point.
ALTER TABLE public.support_tickets DROP CONSTRAINT IF EXISTS support_tickets_user_id_fkey;
ALTER TABLE public.support_tickets
  ADD CONSTRAINT support_tickets_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id)
  NOT VALID;
ALTER TABLE public.support_tickets
  VALIDATE CONSTRAINT support_tickets_user_id_fkey;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;
