-- FitConnect MVP (Current-Schema Track)
-- Source of truth for frontend contracts in src/

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Shared helpers
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Core tables
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text check (role in ('trainer', 'client')),
  full_name text not null default '',
  avatar_url text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trainer_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  specialty text not null default 'strength_training',
  bio text,
  hourly_rate numeric(10,2) not null default 100.00 check (hourly_rate > 0),
  optimized_rate numeric(10,2) not null default 60.00 check (optimized_rate > 0),
  location text not null default '',
  latitude numeric(10,7),
  longitude numeric(10,7),
  certifications text[] not null default '{}',
  verified boolean not null default false,
  rating numeric(3,2) not null default 0 check (rating >= 0 and rating <= 5),
  review_count integer not null default 0 check (review_count >= 0),
  stripe_account_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.availability_slots (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainer_profiles(id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz not null,
  is_booked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint availability_slots_time_order check (end_time > start_time),
  constraint availability_slots_unique_slot unique (trainer_id, start_time)
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  trainer_id uuid not null references public.trainer_profiles(id) on delete restrict,
  slot_id uuid not null references public.availability_slots(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')),
  rate_charged numeric(10,2) not null check (rate_charged > 0),
  platform_fee numeric(10,2) not null default 0 check (platform_fee >= 0),
  trainer_payout numeric(10,2) not null default 0 check (trainer_payout >= 0),
  notes text,
  cancellation_reason text,
  cancelled_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  trainer_id uuid not null references public.trainer_profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  stripe_payment_intent_id text unique,
  amount numeric(10,2) not null check (amount >= 0),
  platform_fee numeric(10,2) not null default 0 check (platform_fee >= 0),
  trainer_payout numeric(10,2) not null default 0 check (trainer_payout >= 0),
  currency text not null default 'usd',
  payment_method text not null default 'card' check (payment_method in ('card', 'debit', 'venmo', 'zelle')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'succeeded', 'failed', 'refunded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------
create index if not exists idx_trainer_profiles_specialty on public.trainer_profiles(specialty);
create index if not exists idx_trainer_profiles_location on public.trainer_profiles(location);
create index if not exists idx_slots_trainer_start on public.availability_slots(trainer_id, start_time);
create index if not exists idx_slots_available_start on public.availability_slots(start_time) where is_booked = false;
create index if not exists idx_bookings_client_status on public.bookings(client_id, status);
create index if not exists idx_bookings_trainer_status on public.bookings(trainer_id, status);
create index if not exists idx_reviews_trainer on public.reviews(trainer_id);
create index if not exists idx_notifications_user_created on public.notifications(user_id, created_at desc);
create index if not exists idx_notifications_user_unread on public.notifications(user_id) where read = false;
create index if not exists idx_payments_status on public.payments(status);

-- At most one non-cancelled booking can reserve the same slot.
create unique index if not exists uq_bookings_active_slot
  on public.bookings(slot_id)
  where status in ('pending', 'confirmed', 'completed', 'no_show');

-- -----------------------------------------------------------------------------
-- updated_at triggers
-- -----------------------------------------------------------------------------
drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_trainer_profiles_updated_at on public.trainer_profiles;
create trigger set_trainer_profiles_updated_at
before update on public.trainer_profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_availability_slots_updated_at on public.availability_slots;
create trigger set_availability_slots_updated_at
before update on public.availability_slots
for each row execute function public.set_updated_at();

drop trigger if exists set_bookings_updated_at on public.bookings;
create trigger set_bookings_updated_at
before update on public.bookings
for each row execute function public.set_updated_at();

drop trigger if exists set_payments_updated_at on public.payments;
create trigger set_payments_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Auth signup -> profile bootstrap
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name, avatar_url)
  values (
    new.id,
    null,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture', null)
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Review aggregation -> trainer rating/review_count
-- -----------------------------------------------------------------------------
create or replace function public.sync_trainer_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_trainer_id uuid;
begin
  target_trainer_id := coalesce(new.trainer_id, old.trainer_id);

  update public.trainer_profiles tp
  set
    rating = coalesce((
      select round(avg(r.rating)::numeric, 2)
      from public.reviews r
      where r.trainer_id = target_trainer_id
    ), 0),
    review_count = (
      select count(*)
      from public.reviews r
      where r.trainer_id = target_trainer_id
    )
  where tp.id = target_trainer_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists reviews_sync_trainer_rating_insert on public.reviews;
create trigger reviews_sync_trainer_rating_insert
after insert on public.reviews
for each row execute function public.sync_trainer_rating();

drop trigger if exists reviews_sync_trainer_rating_update on public.reviews;
create trigger reviews_sync_trainer_rating_update
after update of rating, trainer_id on public.reviews
for each row execute function public.sync_trainer_rating();

drop trigger if exists reviews_sync_trainer_rating_delete on public.reviews;
create trigger reviews_sync_trainer_rating_delete
after delete on public.reviews
for each row execute function public.sync_trainer_rating();

-- -----------------------------------------------------------------------------
-- Booking lifecycle integrity
-- -----------------------------------------------------------------------------
create or replace function public.validate_booking_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid;
  trainer_user_id uuid;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  -- Service role operations (webhooks, backend jobs) are trusted.
  if auth.role() = 'service_role' then
    return new;
  end if;

  if new.slot_id <> old.slot_id then
    raise exception 'slot_id is immutable for existing bookings';
  end if;

  if new.client_id <> old.client_id then
    raise exception 'client_id is immutable for existing bookings';
  end if;

  if new.trainer_id <> old.trainer_id then
    raise exception 'trainer_id is immutable for existing bookings';
  end if;

  if new.status = old.status then
    return new;
  end if;

  actor := auth.uid();

  select tp.user_id
    into trainer_user_id
  from public.trainer_profiles tp
  where tp.id = old.trainer_id;

  if new.status = 'cancelled' then
    if actor is null or (actor <> old.client_id and actor <> trainer_user_id) then
      raise exception 'Only the client or trainer can cancel this booking';
    end if;
  elsif new.status in ('confirmed', 'completed', 'no_show') then
    if actor is null or actor <> trainer_user_id then
      raise exception 'Only the trainer can set status to %', new.status;
    end if;
  else
    raise exception 'Invalid booking status target: %', new.status;
  end if;

  if old.status = 'pending' and new.status in ('confirmed', 'cancelled') then
    return new;
  end if;

  if old.status = 'confirmed' and new.status in ('completed', 'cancelled', 'no_show') then
    return new;
  end if;

  raise exception 'Invalid booking status transition: % -> %', old.status, new.status;
end;
$$;

drop trigger if exists bookings_validate_transition on public.bookings;
create trigger bookings_validate_transition
before update on public.bookings
for each row execute function public.validate_booking_transition();

create or replace function public.lock_and_mark_slot_on_booking_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  locked_slot public.availability_slots%rowtype;
begin
  if new.status <> 'pending' then
    raise exception 'New bookings must be created in pending status';
  end if;

  select *
    into locked_slot
  from public.availability_slots
  where id = new.slot_id
  for update;

  if not found then
    raise exception 'Selected slot does not exist';
  end if;

  if locked_slot.trainer_id <> new.trainer_id then
    raise exception 'Booking trainer_id does not match slot trainer owner';
  end if;

  if locked_slot.start_time < now() then
    raise exception 'Cannot book a past slot';
  end if;

  if locked_slot.is_booked then
    raise exception 'Slot is already booked';
  end if;

  update public.availability_slots
  set is_booked = true,
      updated_at = now()
  where id = locked_slot.id;

  return new;
end;
$$;

drop trigger if exists bookings_before_insert_lock_slot on public.bookings;
create trigger bookings_before_insert_lock_slot
before insert on public.bookings
for each row execute function public.lock_and_mark_slot_on_booking_insert();

create or replace function public.sync_slot_on_booking_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_slot uuid;
  has_active boolean;
begin
  if tg_op = 'UPDATE' then
    target_slot := new.slot_id;

    if new.status = old.status then
      return new;
    end if;

    if new.status = 'cancelled' then
      select exists (
        select 1
        from public.bookings b
        where b.slot_id = target_slot
          and b.id <> new.id
          and b.status in ('pending', 'confirmed', 'completed', 'no_show')
      )
      into has_active;

      if not has_active then
        update public.availability_slots
        set is_booked = false,
            updated_at = now()
        where id = target_slot;
      end if;
    elsif old.status = 'cancelled' and new.status in ('pending', 'confirmed', 'completed', 'no_show') then
      update public.availability_slots
      set is_booked = true,
          updated_at = now()
      where id = target_slot;
    end if;

    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.status in ('pending', 'confirmed', 'completed', 'no_show') then
      select exists (
        select 1
        from public.bookings b
        where b.slot_id = old.slot_id
          and b.status in ('pending', 'confirmed', 'completed', 'no_show')
      )
      into has_active;

      if not has_active then
        update public.availability_slots
        set is_booked = false,
            updated_at = now()
        where id = old.slot_id;
      end if;
    end if;

    return old;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists bookings_after_update_sync_slot on public.bookings;
create trigger bookings_after_update_sync_slot
after update of status on public.bookings
for each row execute function public.sync_slot_on_booking_change();

drop trigger if exists bookings_after_delete_sync_slot on public.bookings;
create trigger bookings_after_delete_sync_slot
after delete on public.bookings
for each row execute function public.sync_slot_on_booking_change();

-- -----------------------------------------------------------------------------
-- Booking notifications
-- -----------------------------------------------------------------------------
create or replace function public.handle_booking_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  trainer_user_id uuid;
  trainer_name text;
  client_name text;
  actor uuid;
begin
  if tg_op = 'INSERT' then
    select tp.user_id, p.full_name
      into trainer_user_id, trainer_name
    from public.trainer_profiles tp
    join public.profiles p on p.id = tp.user_id
    where tp.id = new.trainer_id;

    select p.full_name
      into client_name
    from public.profiles p
    where p.id = new.client_id;

    if trainer_user_id is not null then
      insert into public.notifications (user_id, type, title, message, link)
      values (
        trainer_user_id,
        'booking_requested',
        'New booking request',
        format('%s requested one of your available sessions.', coalesce(nullif(client_name, ''), 'A client')),
        '/trainer/bookings'
      );
    end if;

    insert into public.notifications (user_id, type, title, message, link)
    values (
      new.client_id,
      'booking_requested',
      'Booking request submitted',
      'Your booking request is pending trainer confirmation.',
      '/client/bookings'
    );

    return new;
  end if;

  if tg_op = 'UPDATE' and new.status <> old.status then
    actor := auth.uid();

    select tp.user_id, p.full_name
      into trainer_user_id, trainer_name
    from public.trainer_profiles tp
    join public.profiles p on p.id = tp.user_id
    where tp.id = new.trainer_id;

    select p.full_name
      into client_name
    from public.profiles p
    where p.id = new.client_id;

    if new.status = 'confirmed' then
      insert into public.notifications (user_id, type, title, message, link)
      values (
        new.client_id,
        'booking_confirmed',
        'Booking confirmed',
        format('%s confirmed your booking request.', coalesce(nullif(trainer_name, ''), 'Your trainer')),
        '/client/bookings'
      );
    elsif new.status = 'cancelled' then
      if actor = new.client_id then
        if trainer_user_id is not null then
          insert into public.notifications (user_id, type, title, message, link)
          values (
            trainer_user_id,
            'booking_cancelled',
            'Booking cancelled',
            format('%s cancelled a booking.', coalesce(nullif(client_name, ''), 'A client')),
            '/trainer/bookings'
          );
        end if;
      elsif trainer_user_id is not null and actor = trainer_user_id then
        insert into public.notifications (user_id, type, title, message, link)
        values (
          new.client_id,
          'booking_cancelled',
          'Booking cancelled',
          format('%s cancelled your booking.', coalesce(nullif(trainer_name, ''), 'Your trainer')),
          '/client/bookings'
        );
      else
        if trainer_user_id is not null then
          insert into public.notifications (user_id, type, title, message, link)
          values (
            trainer_user_id,
            'booking_cancelled',
            'Booking cancelled',
            'A booking was cancelled.',
            '/trainer/bookings'
          );
        end if;

        insert into public.notifications (user_id, type, title, message, link)
        values (
          new.client_id,
          'booking_cancelled',
          'Booking cancelled',
          'A booking was cancelled.',
          '/client/bookings'
        );
      end if;
    elsif new.status = 'completed' then
      insert into public.notifications (user_id, type, title, message, link)
      values (
        new.client_id,
        'booking_completed',
        'Session completed',
        'Your trainer marked this session as completed. Leave a review when ready.',
        '/client/bookings'
      );
    elsif new.status = 'no_show' then
      insert into public.notifications (user_id, type, title, message, link)
      values (
        new.client_id,
        'booking_no_show',
        'Session marked as no-show',
        'Your trainer marked this booking as no-show.',
        '/client/bookings'
      );
    end if;

    return new;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists bookings_after_insert_notify on public.bookings;
create trigger bookings_after_insert_notify
after insert on public.bookings
for each row execute function public.handle_booking_notifications();

drop trigger if exists bookings_after_update_notify on public.bookings;
create trigger bookings_after_update_notify
after update of status on public.bookings
for each row execute function public.handle_booking_notifications();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.trainer_profiles enable row level security;
alter table public.availability_slots enable row level security;
alter table public.bookings enable row level security;
alter table public.reviews enable row level security;
alter table public.notifications enable row level security;
alter table public.payments enable row level security;

-- Profiles policies

drop policy if exists profiles_select_public on public.profiles;
create policy profiles_select_public
on public.profiles
for select
using (true);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

-- Trainer profiles policies

drop policy if exists trainer_profiles_select_public on public.trainer_profiles;
create policy trainer_profiles_select_public
on public.trainer_profiles
for select
using (true);

drop policy if exists trainer_profiles_insert_own on public.trainer_profiles;
create policy trainer_profiles_insert_own
on public.trainer_profiles
for insert
with check (auth.uid() = user_id);

drop policy if exists trainer_profiles_update_own on public.trainer_profiles;
create policy trainer_profiles_update_own
on public.trainer_profiles
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists trainer_profiles_delete_own on public.trainer_profiles;
create policy trainer_profiles_delete_own
on public.trainer_profiles
for delete
using (auth.uid() = user_id);

-- Availability policies

drop policy if exists availability_select_public_or_owner on public.availability_slots;
create policy availability_select_public_or_owner
on public.availability_slots
for select
using (
  is_booked = false
  or trainer_id in (
    select tp.id from public.trainer_profiles tp where tp.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.bookings b
    where b.slot_id = availability_slots.id
      and b.client_id = auth.uid()
  )
);

drop policy if exists availability_insert_owner on public.availability_slots;
create policy availability_insert_owner
on public.availability_slots
for insert
with check (
  trainer_id in (
    select tp.id from public.trainer_profiles tp where tp.user_id = auth.uid()
  )
);

drop policy if exists availability_update_owner on public.availability_slots;
create policy availability_update_owner
on public.availability_slots
for update
using (
  trainer_id in (
    select tp.id from public.trainer_profiles tp where tp.user_id = auth.uid()
  )
)
with check (
  trainer_id in (
    select tp.id from public.trainer_profiles tp where tp.user_id = auth.uid()
  )
);

drop policy if exists availability_delete_owner on public.availability_slots;
create policy availability_delete_owner
on public.availability_slots
for delete
using (
  trainer_id in (
    select tp.id from public.trainer_profiles tp where tp.user_id = auth.uid()
  )
);

-- Bookings policies

drop policy if exists bookings_select_involved on public.bookings;
create policy bookings_select_involved
on public.bookings
for select
using (
  client_id = auth.uid()
  or trainer_id in (
    select tp.id from public.trainer_profiles tp where tp.user_id = auth.uid()
  )
);

drop policy if exists bookings_insert_client on public.bookings;
create policy bookings_insert_client
on public.bookings
for insert
with check (client_id = auth.uid());

drop policy if exists bookings_update_involved on public.bookings;
create policy bookings_update_involved
on public.bookings
for update
using (
  client_id = auth.uid()
  or trainer_id in (
    select tp.id from public.trainer_profiles tp where tp.user_id = auth.uid()
  )
)
with check (
  client_id = auth.uid()
  or trainer_id in (
    select tp.id from public.trainer_profiles tp where tp.user_id = auth.uid()
  )
);

-- Reviews policies

drop policy if exists reviews_select_public on public.reviews;
create policy reviews_select_public
on public.reviews
for select
using (true);

drop policy if exists reviews_insert_completed_booking_client on public.reviews;
create policy reviews_insert_completed_booking_client
on public.reviews
for insert
with check (
  client_id = auth.uid()
  and exists (
    select 1
    from public.bookings b
    where b.id = booking_id
      and b.client_id = auth.uid()
      and b.trainer_id = reviews.trainer_id
      and b.status = 'completed'
  )
);

-- Notifications policies

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own
on public.notifications
for select
using (user_id = auth.uid());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own
on public.notifications
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists notifications_insert_service_or_owner on public.notifications;
create policy notifications_insert_service_or_owner
on public.notifications
for insert
with check (auth.role() = 'service_role' or user_id = auth.uid());

-- Payments policies

drop policy if exists payments_select_involved on public.payments;
create policy payments_select_involved
on public.payments
for select
using (
  exists (
    select 1
    from public.bookings b
    left join public.trainer_profiles tp on tp.id = b.trainer_id
    where b.id = payments.booking_id
      and (
        b.client_id = auth.uid()
        or tp.user_id = auth.uid()
      )
  )
);

drop policy if exists payments_insert_service_role on public.payments;
create policy payments_insert_service_role
on public.payments
for insert
with check (auth.role() = 'service_role');

drop policy if exists payments_update_service_role on public.payments;
create policy payments_update_service_role
on public.payments
for update
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
