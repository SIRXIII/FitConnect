-- REPAIR (drift): later migrations (starting 20260315120000_onboarding.sql:70) call
-- public.update_updated_at(), but no migration ever CREATES it — the base schema only
-- defines public.set_updated_at(). Production works only because the function was created
-- ad-hoc there (never captured in migration history), so a clean replay (supabase start /
-- a fresh environment) fails with "function public.update_updated_at() does not exist".
--
-- This formalizes the function in migration history. `create or replace` is idempotent, so
-- it is safe to apply to prod (which already has it). Body mirrors set_updated_at().
--
-- Reconcile note: the real cleanup is to make those triggers use set_updated_at() and drop
-- this alias, but that is a broader migration-history reconcile — out of scope for the harness.

create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
