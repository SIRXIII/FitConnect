-- Phase 5: Admin role support
-- Adds admin role, is_suspended flag, and admin-scoped RLS policies

BEGIN;

-- 1. Add is_suspended to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_suspended boolean NOT NULL DEFAULT false;

-- 2. Widen role constraint to include 'admin'
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('trainer', 'client', 'admin'));

-- 3. Admin can select ALL profiles (existing own-row policy remains for non-admins)
CREATE POLICY "profiles_admin_select_all" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- 4. Admin can update any profile (e.g. suspend/unsuspend)
CREATE POLICY "profiles_admin_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- 5. Admin can view all bookings (existing parties-only policy remains)
CREATE POLICY "bookings_admin_select_all" ON public.bookings
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- 6. Admin can view all payments
CREATE POLICY "payments_admin_select_all" ON public.payments
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- 7. Admin can view all trainer profiles
CREATE POLICY "trainer_profiles_admin_select_all" ON public.trainer_profiles
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- 8. Admin can update platform_settings (existing service_role policy remains)
CREATE POLICY "platform_settings_admin_update" ON public.platform_settings
  FOR UPDATE TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

COMMIT;
