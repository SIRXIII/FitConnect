-- Richer public-profile fields + SEO slug for trainer_profiles.
-- Additive + nullable → safe for the shared DB (mobile app unaffected).
-- Applied to prod 2026-06-25 via Supabase MCP.

alter table public.trainer_profiles
  add column if not exists years_experience smallint,
  add column if not exists expertise_tags text[] not null default '{}',
  add column if not exists success_story text,
  add column if not exists faqs jsonb not null default '[]'::jsonb,
  add column if not exists slug text;

-- Case-insensitive unique slug (nulls allowed).
create unique index if not exists trainer_profiles_slug_key
  on public.trainer_profiles (lower(slug)) where slug is not null;

-- One-time backfill from profiles.full_name, deduped with a short id suffix.
with base as (
  select tp.id,
         nullif(trim(both '-' from regexp_replace(lower(trim(coalesce(p.full_name,''))), '[^a-z0-9]+', '-', 'g')), '') as s
  from public.trainer_profiles tp
  join public.profiles p on p.id = tp.user_id
  where tp.slug is null
),
numbered as (
  select id, s, row_number() over (partition by s order by id) as rn
  from base
)
update public.trainer_profiles tp
set slug = case
    when n.s is null then 'trainer-' || substr(tp.id::text, 1, 8)
    when n.rn = 1 then n.s
    else n.s || '-' || substr(tp.id::text, 1, 4)
  end
from numbered n
where n.id = tp.id;

-- Auto-assign a unique slug on insert (covers BOTH web + mobile onboarding).
create or replace function public.set_trainer_slug()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_slug text;
  candidate text;
  n int := 0;
begin
  if new.slug is not null and new.slug <> '' then
    return new;
  end if;
  select nullif(trim(both '-' from regexp_replace(lower(trim(coalesce(p.full_name, ''))), '[^a-z0-9]+', '-', 'g')), '')
    into base_slug
  from public.profiles p
  where p.id = new.user_id;
  if base_slug is null then
    base_slug := 'trainer-' || substr(new.id::text, 1, 8);
  end if;
  candidate := base_slug;
  while exists (
    select 1 from public.trainer_profiles
    where lower(slug) = lower(candidate) and id <> new.id
  ) loop
    n := n + 1;
    candidate := base_slug || '-' || n;
  end loop;
  new.slug := candidate;
  return new;
end;
$$;

drop trigger if exists trg_set_trainer_slug on public.trainer_profiles;
create trigger trg_set_trainer_slug
  before insert on public.trainer_profiles
  for each row execute function public.set_trainer_slug();
