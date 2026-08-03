-- Audit log table for security-sensitive operations
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  table_name text NOT NULL,
  record_id text,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX idx_audit_log_created_at ON public.audit_log (created_at DESC);
CREATE INDEX idx_audit_log_actor ON public.audit_log (actor_id);
CREATE INDEX idx_audit_log_table ON public.audit_log (table_name);

-- RLS
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Only admin users can read audit logs
CREATE POLICY "Admin can view audit log"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Service role can insert (used by trigger functions)
CREATE POLICY "Service role can insert audit log"
  ON public.audit_log FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Authenticated users can also insert via trigger context
CREATE POLICY "Authenticated can insert audit log"
  ON public.audit_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ─── Trigger function ────────────────────────────────────────────────────

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

-- ─── Attach triggers to security-sensitive tables ────────────────────────

-- trainer_profiles: tier changes, rate changes
CREATE TRIGGER audit_trainer_profiles
  AFTER INSERT OR UPDATE OR DELETE ON public.trainer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- payments: status changes
CREATE TRIGGER audit_payments
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- bookings: cancellations, status changes
CREATE TRIGGER audit_bookings
  AFTER INSERT OR UPDATE OR DELETE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- platform_settings: fee changes
CREATE TRIGGER audit_platform_settings
  AFTER INSERT OR UPDATE OR DELETE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
