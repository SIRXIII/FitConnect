-- Phase 3: Configurable platform fee (REQ-CFG-01)

CREATE TABLE IF NOT EXISTS public.platform_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read settings (fee is shown to users in booking flow)
DROP POLICY IF EXISTS platform_settings_select_public ON public.platform_settings;
CREATE POLICY platform_settings_select_public
ON public.platform_settings
FOR SELECT
USING (true);

-- Only service_role can insert/update (admin-controlled)
DROP POLICY IF EXISTS platform_settings_insert_service_role ON public.platform_settings;
CREATE POLICY platform_settings_insert_service_role
ON public.platform_settings
FOR INSERT
WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS platform_settings_update_service_role ON public.platform_settings;
CREATE POLICY platform_settings_update_service_role
ON public.platform_settings
FOR UPDATE
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Seed default values (service_role inserts during migration)
INSERT INTO public.platform_settings (key, value, description)
VALUES ('platform_fee_pct', '0.08', 'Platform fee as a decimal (e.g. 0.08 = 8%). Applied to all bookings.')
ON CONFLICT (key) DO NOTHING;
