-- Add first-touch UTM attribution columns to profiles. Additive only, no backfill.
alter table public.profiles
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text;
