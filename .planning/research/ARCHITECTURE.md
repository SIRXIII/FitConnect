# Architecture Research

**Domain:** Fitness marketplace SPA — v3.0 feature integration (Calendar Sync, Trainee Profiles, Security Hardening, UX Polish)
**Researched:** 2026-03-17
**Confidence:** HIGH (full codebase inspection + official Supabase docs + Google Calendar API docs)

---

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                     React 19 SPA (Netlify)                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────┐  │
│  │ TrainerDash  │  │ ClientProfile│  │ CalendarSync │  │ Security │  │
│  │ (existing)   │  │  (enhanced)  │  │    Pages     │  │  Guards  │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───┘  │
└─────────┼────────────────┼─────────────────┼─────────────────┼──────┘
          │ Auth JWT        │ Auth JWT         │ Auth JWT         │ CSP
          ▼                 ▼                  ▼                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     Supabase Edge Functions (Deno)                    │
│  ┌───────────────┐  ┌────────────────┐  ┌──────────────────────────┐  │
│  │ calendar-sync │  │ calendar-export│  │  existing: stripe-webhook │  │
│  │ (new — import)│  │ (new — .ics    │  │  payouts, subscriptions   │  │
│  │               │  │  generation)   │  │  referrals, admin-override│  │
│  └──────┬────────┘  └──────┬─────────┘  └──────────────────────────┘  │
└─────────┼─────────────────┼────────────────────────────────────────────┘
          │                  │
          ▼                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     Supabase PostgreSQL                               │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │ EXISTING: profiles, trainer_profiles, availability_slots,      │   │
│  │ bookings, reviews, notifications, messages, referrals,          │   │
│  │ payout_transactions, subscription_events, client_profiles       │   │
│  ├────────────────────────────────────────────────────────────────┤   │
│  │ NEW (v3.0):                                                     │   │
│  │ calendar_connections  — per-user OAuth tokens + calendar prefs  │   │
│  │ calendar_sync_log     — import audit trail                      │   │
│  │ audit_log             — security hardening: all mutations       │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ pg_cron jobs: weekly payouts (existing)                          │  │
│  │               calendar-sync poll every 15 min (new)              │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     Supabase Storage                                  │
│  ┌──────────────────────┐   ┌─────────────────────────────────────┐   │
│  │  avatars (public)    │   │  calendar-exports (private, temp)   │   │
│  │  Path: {uid}/avatar  │   │  Path: {uid}/bookings-{ts}.ics      │   │
│  └──────────────────────┘   └─────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌──────────────────────────────────────────────────────────────────────┐
│               Supabase Vault (encrypted secrets)                      │
│  google_oauth_refresh_{uid}  — per-trainer refresh tokens            │
└──────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     External Services                                 │
│  ┌──────────────────────┐   ┌──────────────────────────────────────┐  │
│  │   Google Calendar    │   │   Stripe (existing)                   │  │
│  │   REST API v3        │   │   Connect Express + Billing           │  │
│  └──────────────────────┘   └──────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `calendar-sync` Edge Fn | Fetch Google Calendar events, diff against `availability_slots`, block conflicting slots | Deno + Google Calendar REST v3 + Supabase service_role client |
| `calendar-export` Edge Fn | Generate RFC 5545 .ics text from trainer's confirmed bookings | Deno string builder, returns `text/calendar` response |
| `calendar_connections` table | Store per-trainer Google OAuth credential reference, sync preferences | vault_secret_id FK to Vault, last_synced_at, sync_enabled |
| `calendar_sync_log` table | Audit trail for every import run, how many slots blocked/unblocked | trainer_id, run_at, events_found, slots_affected, error |
| `audit_log` table | Security-layer immutable write log for all sensitive mutations | actor_id, table_name, operation, old_data, new_data, ip |
| `avatars` Storage bucket | Public bucket for trainer and client profile photos | `{uid}/avatar.jpg` path, upsert on change, CDN-cached |
| Supabase Vault | Encrypted per-user Google OAuth refresh tokens | `vault.create_secret()` returns UUID stored in `calendar_connections` |
| `useCalendarSync` hook | React hook wrapping calendar Edge Functions, provides sync state | Returns `{ connected, lastSync, triggerSync, disconnect }` |
| `useAvatarUpload` hook | Manages Storage upload flow: resize → upload → update profile.avatar_url | Uses `supabase.storage.from('avatars').upload()` |
| `client_profiles` table | Already exists (v2.1 onboarding migration) — stores fitness intake | Extend with avatar_url column if not already present |

---

## Recommended Project Structure

```
src/
├── components/
│   ├── calendar/            # New — calendar sync UI components
│   │   ├── CalendarSyncBanner.tsx   # Connect/disconnect prompt
│   │   ├── CalendarSyncStatus.tsx   # Last sync time, conflict count
│   │   └── ExportBookingsButton.tsx # Triggers .ics download
│   ├── profile/             # New — shared avatar + profile form pieces
│   │   ├── AvatarUpload.tsx         # Drag-drop or click-to-upload
│   │   └── FitnessIntakeForm.tsx    # Client fitness profile editor
│   ├── shared/
│   │   └── ProtectedRoute.tsx       # Existing — unchanged
│   ├── trainer/
│   │   └── AvailabilityManager.tsx  # Existing — add conflict badge overlay
│   └── ...existing domains...
├── hooks/
│   ├── useCalendarSync.ts   # New — calendar connection state + sync trigger
│   ├── useAvatarUpload.ts   # New — Storage upload wrapper
│   ├── useClientProfile.ts  # New — read/write client_profiles rows
│   └── ...existing hooks...
├── lib/
│   ├── ical.ts              # New — .ics generation helper (client-side fallback)
│   ├── validators.ts        # New — Zod schemas for all user inputs (security)
│   └── ...existing lib...
├── pages/
│   ├── TrainerSettings.tsx  # New or extended — calendar connect, profile edit
│   ├── ClientProfile.tsx    # New or extended — fitness intake, avatar
│   └── ...existing pages...
└── supabase/
    └── functions/
        ├── calendar-sync/   # New Edge Function
        │   └── index.ts
        └── calendar-export/ # New Edge Function
            └── index.ts
```

### Structure Rationale

- **`components/calendar/`:** Calendar sync is a cross-cutting concern (appears on trainer dashboard and settings). Isolating these components prevents coupling with availability management.
- **`components/profile/`:** AvatarUpload is reused by both trainer and client profiles. Centralizing avoids duplication.
- **`lib/validators.ts`:** Security hardening requires Zod validation everywhere. One file > scattered inline validation.
- **`hooks/useCalendarSync.ts`:** Keeps Edge Function call details out of page components, consistent with existing hook pattern in the codebase.

---

## Architectural Patterns

### Pattern 1: iCal Subscription Feed (Recommended for Calendar Sync)

**What:** Expose a static `.ics` URL per trainer that Google Calendar, Apple Calendar, and Outlook can subscribe to. The URL returns trainer's open availability slots in RFC 5545 format. Users add this URL in their calendar app once; the calendar app polls it on its own schedule.

**When to use:** This is the correct starting point for v3.0. It requires no OAuth from trainers, no Vault secrets, no webhook channel renewal. It is one-way (app → calendar) but covers the primary use case: trainers seeing their bookings in their calendar.

**Trade-offs:**
- Pro: Zero credential management complexity. No Vault. No refresh token rotation. No 7-day channel renewal.
- Pro: Works for Google Calendar, Apple Calendar, Outlook simultaneously with one endpoint.
- Pro: Fits the existing Edge Function pattern already in the codebase.
- Con: Polling latency — Google Calendar may take up to 24 hours to pick up changes. Apple Calendar is configurable (as low as 5 minutes).
- Con: One-way only. Changes in the user's external calendar do not flow back into FitRush.

**Example implementation:**

```typescript
// supabase/functions/calendar-export/index.ts
// GET /functions/v1/calendar-export?trainer_id={uuid}
// Returns text/calendar — RFC 5545 .ics content
// No auth required (public subscription URL) — trainer_id is the only key

serve(async (req) => {
  const trainerId = new URL(req.url).searchParams.get('trainer_id');
  if (!trainerId) return new Response('Missing trainer_id', { status: 400 });

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: bookings } = await adminClient
    .from('bookings')
    .select('id, slot:availability_slots(start_time, end_time), notes, client:profiles(full_name)')
    .eq('trainer_id', trainerId)
    .in('status', ['confirmed', 'completed'])
    .gte('availability_slots.start_time', new Date().toISOString());

  const ics = buildICS(bookings);  // RFC 5545 string builder

  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': 'public, max-age=300',  // 5-min CDN cache
    },
  });
});
```

---

### Pattern 2: Google Calendar OAuth Import (Advanced — defer to v3.1+)

**What:** Trainer connects their Google account with `calendar.readonly` scope. FitRush stores the refresh token in Vault. A pg_cron job runs every 15 minutes, triggering a `calendar-sync` Edge Function that calls Google Calendar API, fetches events in the next 30 days, finds overlapping `availability_slots`, and marks them `is_booked = true` (soft-block with `blocked_by_calendar = true` flag, not a real booking).

**When to use:** When trainers complain that they're getting double-booked because FitRush doesn't know about personal appointments. This is a real problem but adds significant complexity and maintenance burden. Defer until iCal export proves insufficient.

**Trade-offs:**
- Pro: Bidirectional awareness — personal appointments block FitRush availability automatically.
- Con: Google OAuth app verification required for `calendar.readonly` scope (takes 2-4 weeks for production apps, requires privacy policy review).
- Con: Refresh token rotation and revocation handling. If a trainer revokes access, sync fails silently unless error handling is robust.
- Con: Google Calendar push notification channels expire every 7 days — must implement auto-renewal via pg_cron or the polling approach degrades to 15-min intervals.
- Con: Google Calendar API quota: 1,000,000 req/day shared across all trainers. At 15-min polling for 500 trainers, this is 48,000 req/day — fine. At 5,000 trainers, it is at limit.

**Key tables needed for this pattern:**

```sql
-- Defer to v3.1+
CREATE TABLE calendar_connections (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id       uuid NOT NULL UNIQUE REFERENCES trainer_profiles(id) ON DELETE CASCADE,
  google_vault_id  uuid REFERENCES vault.secrets(id) ON DELETE SET NULL,
  calendar_id      text NOT NULL DEFAULT 'primary',
  sync_enabled     boolean NOT NULL DEFAULT true,
  last_synced_at   timestamptz,
  last_error       text,
  created_at       timestamptz NOT NULL DEFAULT now()
);
```

---

### Pattern 3: Avatar Upload via Supabase Storage

**What:** Client uploads image file from browser → Supabase Storage `avatars` bucket (public) → Edge Function or direct Storage API call writes to `{uid}/avatar.{ext}` → profile's `avatar_url` column updated to Storage public URL.

**When to use:** Immediately for v3.0. The `profiles.avatar_url` and `trainer_profiles.avatar_url` columns already exist in the schema. This pattern fills in what was previously only populated from Unsplash mock URLs.

**Trade-offs:**
- Pro: Public bucket means no signed URLs needed for display — images served via CDN, fast.
- Pro: Supabase Storage RLS on `storage.objects` enforces `{uid}/*` path restriction — user can only write their own folder.
- Con: Client-side image resize needed before upload to avoid storing large images. Use browser Canvas API or a library like `browser-image-compression` — do not send this to server raw.
- Con: Old avatar files accumulate unless cleanup is implemented (Storage does not auto-delete on upsert to same path). Use consistent path (`{uid}/avatar.jpg`) to overwrite on change.

**Example RLS policy for avatars bucket:**

```sql
-- storage.objects RLS
CREATE POLICY "Users upload own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users update own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Anyone can view avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');
```

---

### Pattern 4: Zod Validation at the Gate (Security Hardening)

**What:** Every user input — profile updates, booking creation, availability slot creation — passes through a Zod schema before hitting Supabase. Schemas live in `src/lib/validators.ts` and are imported by both the hooks (client-side) and Edge Functions (server-side).

**When to use:** Now. The codebase `CONCERNS.md` identified that `updateProfile` accepts `Partial<Profile>` with no validation, slot deletion has no booking check, and search has no input length limits. These are documented risks that v3.0 security hardening should address.

**Trade-offs:**
- Pro: One schema definition used at two enforcement points — client and server.
- Pro: Zod parse errors produce readable messages usable directly in UI.
- Con: Zod adds ~13KB to the bundle. Acceptable for a full-featured SPA.
- Con: Requires discipline to keep schemas and DB schema in sync. Mitigate by writing schemas against the migration, not the TypeScript types.

**Example:**

```typescript
// src/lib/validators.ts
import { z } from 'zod';

export const ProfileUpdateSchema = z.object({
  full_name: z.string().min(1).max(100).trim(),
  phone: z.string().regex(/^\+?[\d\s\-()]{7,20}$/).optional().nullable(),
  avatar_url: z.string().url().max(500).optional().nullable(),
});

export const AvailabilitySlotSchema = z.object({
  trainer_id: z.string().uuid(),
  start_time: z.string().datetime(),
  end_time: z.string().datetime(),
  discount_percentage: z.number().min(0).max(100).optional(),
}).refine(d => new Date(d.end_time) > new Date(d.start_time), {
  message: 'end_time must be after start_time',
});
```

---

## Data Flow

### Calendar Export Flow (iCal Subscription)

```
Trainer copies export URL from Settings page
    ↓
Trainer adds URL to Google Calendar as "Other calendar" subscription
    ↓  (happens in Google's UI, no FitRush involvement)

Google Calendar polls URL every ~24h (or manually triggered)
    ↓
GET /functions/v1/calendar-export?trainer_id={uuid}
    ↓
Edge Function: adminClient queries bookings JOIN availability_slots
    ↓
Edge Function: builds RFC 5545 .ics string
    ↓
Returns text/calendar response (CDN cached 5 min)
    ↓
Google Calendar displays trainer's confirmed sessions as read-only events
```

### Avatar Upload Flow

```
User selects image file (AvatarUpload.tsx)
    ↓
Browser: canvas resize to max 400×400, quality 0.85 (no server involvement)
    ↓
supabase.storage.from('avatars').upload('{uid}/avatar.jpg', blob, { upsert: true })
    ↓
Storage: RLS checks auth.uid() == foldername[1] — allows
    ↓
On success: extract publicUrl from storage response
    ↓
supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', uid)
    (or trainer_profiles — same uid pattern)
    ↓
useAuthStore.fetchProfile() → Zustand store refreshes → avatar displayed everywhere
```

### Security Audit Log Flow

```
DB trigger fires AFTER INSERT/UPDATE/DELETE on sensitive tables
    (profiles, trainer_profiles, bookings, availability_slots)
    ↓
Trigger function: audit_log_mutation()
    ↓
INSERT into audit_log: { actor_id: auth.uid(), table_name, operation,
                          old_data: row_to_json(OLD), new_data: row_to_json(NEW),
                          created_at: now() }
    ↓
audit_log: RLS blocks all user SELECT (admin-only via service_role)
    ↓
Admin dashboard can query via RPC get_audit_log(start, end) — service_role only
```

### Client Fitness Intake Flow

```
Client completes onboarding or visits /client/profile
    ↓
FitnessIntakeForm (new component) renders fields from client_profiles schema
    ↓
useClientProfile hook: SELECT * FROM client_profiles WHERE user_id = auth.uid()
    ↓
User fills age, weight, fitness_goals[], workout_types[], health_notes
    ↓
useClientProfile.update(): validates via FitnessIntakeSchema (Zod)
    ↓
UPSERT into client_profiles (already exists in 20260315120000_onboarding.sql)
    ↓
Trainer can view client_profiles for their booked clients via existing RLS policy:
    "Trainers can view client profiles for their bookings"
```

### Rate Limiting Flow (Edge Functions)

```
Request arrives at Edge Function
    ↓
Extract auth.uid() from JWT via verifyJWT()
    ↓
Upstash Redis: INCR "ratelimit:{uid}:{minute_bucket}"
Set TTL = 60s on first increment
    ↓
If count > threshold (e.g., 10 req/min for sync): return 429
    ↓
Else: proceed with function logic
```

---

## New Database Objects Required

### New Tables

```sql
-- calendar_connections: Phase 1 deferred (iCal export needs no table)
-- calendar_sync_log: if Google Calendar import is added in v3.1+
-- audit_log: security hardening — needed in v3.0

CREATE TABLE audit_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  table_name  text        NOT NULL,
  operation   text        NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data    jsonb,
  new_data    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- RLS: no user SELECT; service_role and admin only
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_log_admin_select ON audit_log
  FOR SELECT USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );
```

### Schema Additions (ALTER TABLE)

```sql
-- profiles: add timezone for UX Polish (timezone display fix from CONCERNS #18)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'America/New_York';

-- trainer_profiles: calendar export token (opaque URL segment, not OAuth)
ALTER TABLE trainer_profiles
  ADD COLUMN IF NOT EXISTS calendar_export_token text UNIQUE DEFAULT gen_random_uuid()::text;

-- availability_slots: flag for calendar-blocked slots (v3.1+ Google import)
-- Defer this column until Google Calendar import phase
-- ALTER TABLE availability_slots ADD COLUMN IF NOT EXISTS blocked_by_calendar boolean DEFAULT false;
```

### New RPC Functions

```sql
-- generate_calendar_export_url: returns the export URL for a trainer
-- Called from TrainerSettings page
CREATE OR REPLACE FUNCTION get_calendar_export_url(p_trainer_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT 'https://' || current_setting('app.supabase_url') ||
         '/functions/v1/calendar-export?token=' || calendar_export_token
  FROM trainer_profiles
  WHERE id = p_trainer_id AND user_id = auth.uid();
$$;
-- Returns NULL if caller is not the owner — security enforced by WHERE user_id = auth.uid()
```

### New Edge Functions

| Function | Trigger | Auth | Purpose |
|----------|---------|------|---------|
| `calendar-export` | HTTP GET (public, token-based) | `calendar_export_token` query param | Return RFC 5545 .ics of trainer's confirmed bookings |
| `delete-account` | HTTP POST (authenticated) | JWT required | GDPR account deletion: anonymize bookings, delete profile, remove Storage files |

### Modified Edge Functions

| Function | Change | Reason |
|----------|--------|--------|
| `stripe-webhook` | Add Zod validation on incoming payload fields before processing | Security hardening — currently no input validation documented |
| `create-payment-intent` | Add idempotency key + booking ownership check | Addresses CONCERNS #1 and #4 (race condition, no auth check on ownership) |

---

## Integration Points with Existing Tables

### availability_slots

| v3.0 Feature | Integration Point | Change Type |
|--------------|------------------|-------------|
| iCal Export | `calendar-export` reads `bookings JOIN availability_slots` to populate .ics VEVENT entries | Read-only — no schema change |
| Google Calendar Import (v3.1+) | Add `blocked_by_calendar boolean` column; `calendar-sync` Edge Fn sets this flag when personal event overlaps slot | Schema addition (deferred) |
| UX Polish: timezone display | Read `start_time` with trainer's `profiles.timezone` for display conversion | No schema change; client-side conversion |

### bookings

| v3.0 Feature | Integration Point | Change Type |
|--------------|------------------|-------------|
| iCal Export | bookings with status `confirmed` or `completed` become VEVENT records in .ics | Read-only |
| Audit Log | `audit_log_mutation()` trigger fires on bookings INSERT/UPDATE | New trigger |
| GDPR delete-account | `delete-account` Edge Fn anonymizes `notes`, sets `client_id = NULL` on completed bookings | Mutation via service_role |

### profiles / trainer_profiles

| v3.0 Feature | Integration Point | Change Type |
|--------------|------------------|-------------|
| Avatar Upload | `profiles.avatar_url` and `trainer_profiles.avatar_url` updated after Storage upload | Existing column, new write path |
| Timezone | `profiles.timezone` column added | New column via migration |
| Calendar Export Token | `trainer_profiles.calendar_export_token` column added | New column via migration |
| Zod Validation | `updateProfile()` in auth store gates on `ProfileUpdateSchema.parse()` before Supabase call | No schema change; code change |

### client_profiles (existing since 20260315120000)

| v3.0 Feature | Integration Point | Change Type |
|--------------|------------------|-------------|
| Fitness Intake UI | Expose existing `client_profiles` table via `useClientProfile` hook and `FitnessIntakeForm` component | No schema change; new frontend only |
| Avatar | Add `avatar_url` column to `client_profiles` if not present | Schema addition |

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k trainers | iCal export via Edge Function, no caching layer needed. pg_cron calendar poll is fine. |
| 1k-10k trainers | Add `Cache-Control: max-age=300` on calendar-export response (already in pattern above). Supabase CDN handles it. Avatar Storage bucket: fine, S3-backed. |
| 10k+ trainers | Google Calendar import polling at 15-min intervals hits quota. Switch to push notification channels (7-day renewal) or move to dedicated sync worker. Calendar export CDN caching becomes essential. |

### Scaling Priorities

1. **First bottleneck:** Google Calendar API quota if sync is implemented for many trainers. Mitigate by per-trainer polling rate limits and exponential backoff on errors.
2. **Second bottleneck:** audit_log table grows unbounded. Add `created_at` index and a pg_cron job to archive rows older than 90 days to a cold table or delete non-payment rows.

---

## Build Order (Security-First)

The dependency chain dictates this specific order:

```
Phase A: Security Hardening (no dependencies — improves existing code)
    ↓
    Zod validators.ts (lib only, no DB)
    Profile input validation (modifies auth store + hooks)
    Rate limiting on existing Edge Functions (Upstash Redis, modify existing functions)
    audit_log table + triggers (new migration)
    Notifications self-insert RLS cleanup (modifies existing migration)

Phase B: Trainee Profile Enhancements (depends on: Security hardening from Phase A)
    ↓
    avatars Storage bucket + RLS policies
    AvatarUpload component + useAvatarUpload hook
    FitnessIntakeForm component + useClientProfile hook
    client_profiles avatar_url column (migration)
    profiles.timezone column (migration)
    Wire into existing onboarding flow (ClientOnboarding.tsx — already exists untracked)

Phase C: Calendar Sync — iCal Export (depends on: Phase B timezone column)
    ↓
    trainer_profiles.calendar_export_token column (migration)
    calendar-export Edge Function
    ExportBookingsButton + CalendarSyncStatus components
    TrainerSettings page (or extend TrainerDashboard)
    get_calendar_export_url RPC

Phase D: UX Polish (depends on: Phase B avatar, Phase C calendar)
    ↓
    Timezone-aware date display (uses profiles.timezone from Phase B)
    Loading states on cancellation (MyBookings.tsx)
    Pagination on trainer search (useTrainers hook)
    Mock data DEV-only guard (SearchSection.tsx)
    Input length limits on search (useTrainers.ts)
```

**Why Security first:** Phase A's Zod validators are referenced by Phase B's avatar upload hook and Phase C's calendar-export Edge Function. Building them first means Phase B and C inherit validation automatically rather than retrofitting it.

**Why iCal before Google Calendar OAuth:** iCal export (Phase C) requires zero OAuth, zero Vault secrets, zero channel renewal. It delivers 80% of the calendar value (trainers see bookings in their calendar) with 20% of the complexity. Google Calendar OAuth import (bidirectional) should be a separate v3.1 milestone after iCal proves the use case.

---

## Anti-Patterns

### Anti-Pattern 1: Google Calendar OAuth Before iCal Export

**What people do:** Jump straight to Google Calendar OAuth integration for "bidirectional sync" because it sounds more complete.

**Why it's wrong:** Requires Google OAuth app verification (2-4 week review), Vault refresh token storage, pg_cron-driven 7-day channel renewal, and rate limit management — all before a single trainer has used calendar sync. The primary user need is "see my bookings in my calendar," which iCal export solves with one Edge Function and zero credential management.

**Do this instead:** Ship iCal export first. Measure adoption. If trainers report double-bookings from personal appointments, that's the signal to build Google Calendar import.

---

### Anti-Pattern 2: Public Calendar Export URL Without Token

**What people do:** Expose `/functions/v1/calendar-export?trainer_id={uuid}` with no other authentication, reasoning that trainer UUIDs are "not guessable."

**Why it's wrong:** UUIDs are not secret. Trainer IDs are present in the URL when a client books a session (`/book/:slotId` reveals trainer context), in `trainer_profiles` public table rows, and potentially in browser history. Anyone who obtains a trainer UUID can subscribe to that trainer's booking calendar, exposing client names.

**Do this instead:** Use `calendar_export_token` — a separate random token stored on `trainer_profiles`, not derivable from the trainer UUID. The trainer can reset it (generate a new token) if they suspect exposure, invalidating existing subscriptions without changing their account.

---

### Anti-Pattern 3: Storing OAuth Refresh Tokens in a Plain DB Column

**What people do:** Add a `google_refresh_token text` column to `trainer_profiles`.

**Why it's wrong:** PostgreSQL stores text columns in plaintext on disk. Any database backup, snapshot, or leaked pg_dump exposes all refresh tokens. A single compromised backup gives an attacker access to every trainer's Google Calendar.

**Do this instead:** Use Supabase Vault. Store the UUID returned by `vault.create_secret()` in the `calendar_connections` table. Decrypt via `vault.decrypted_secrets` view only inside Edge Functions running as service_role. Revoke access to the view from the `authenticated` role.

---

### Anti-Pattern 4: Avatar URL Stored as Unsplash or External URL

**What people do:** Accept any URL string as `avatar_url` from user input.

**Why it's wrong:** External URLs break when the source changes, create privacy leaks (Unsplash sees a request for every avatar render in production), and allow users to set `avatar_url` to tracking pixels, 10GB video files, or NSFW content hosted externally — the app has no control over what is displayed.

**Do this instead:** Accept only Storage URLs from the `avatars` bucket. Validate in ProfileUpdateSchema that `avatar_url` matches `^https://{your-supabase-project}.supabase.co/storage/v1/object/public/avatars/` if set. The `AvatarUpload` component should be the only path for updating `avatar_url` — not a free text field.

---

### Anti-Pattern 5: Audit Log Written by the Client

**What people do:** Call a mutation from the browser to insert into `audit_log` whenever a sensitive action occurs.

**Why it's wrong:** The client controls the audit. A user could emit misleading entries, omit entries when convenient, or forge entries for other users.

**Do this instead:** Audit log entries are written exclusively by a `SECURITY DEFINER` trigger on the relevant tables. The trigger fires on the database server regardless of what the client does. Users have no `INSERT` permission on `audit_log`. The RLS blocks all reads except admin role and service_role.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Google Calendar v3 REST API | HTTP fetch from Deno Edge Function using per-trainer OAuth access token | Access token derived from refresh token stored in Vault. Refresh token obtained once via `signInWithOAuth` with `access_type=offline` param. Requires `calendar.readonly` scope for import; no scope needed for export (app reads its own DB). |
| Supabase Storage | Direct JS SDK call: `supabase.storage.from('avatars').upload()` from browser | Public bucket — no signed URLs for reads. RLS on `storage.objects` enforces write ownership via `foldername` check. |
| Supabase Vault | SQL: `vault.create_secret()` on connect, `vault.decrypted_secrets` view on sync | Only accessible from Edge Functions (service_role) and SECURITY DEFINER functions. Never accessible via anon or authenticated role. |
| Upstash Redis | HTTP REST API from Edge Function — no persistent connection needed | Required only if rate limiting is implemented. Serverless-compatible (HTTP). Supabase's own docs recommend this for Edge Function rate limiting. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| React hooks ↔ Supabase Storage | `@supabase/supabase-js` StorageClient methods | Same SDK, same auth session. No new auth plumbing needed. |
| `calendar-export` Edge Fn ↔ `bookings` table | Supabase service_role client query | Uses service_role to bypass RLS — needed because the function is called without user auth (calendar app HTTP request has no JWT). The `calendar_export_token` provides caller identity. |
| `audit_log` trigger ↔ `profiles` table | PostgreSQL AFTER trigger | `audit_log_mutation()` is a `SECURITY DEFINER` function — fires as DB owner regardless of RLS. Inserts rows that `authenticated` role cannot read. |
| `useClientProfile` hook ↔ `client_profiles` | `@supabase/supabase-js` authenticated query | Existing RLS: `auth.uid() = user_id` — no changes needed. Trainers viewing client intake data flow through the existing "Trainers can view client profiles for their bookings" policy. |

---

## Sources

- [Supabase Storage Buckets Fundamentals](https://supabase.com/docs/guides/storage/buckets/fundamentals) — Public vs private buckets, RLS on storage.objects, signed URLs
- [Supabase Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control) — storage.objects RLS policy patterns
- [Supabase Vault Docs](https://supabase.com/docs/guides/database/vault) — vault.create_secret(), vault.decrypted_secrets view, per-user secret pattern
- [Supabase Rate Limiting Edge Functions](https://supabase.com/docs/guides/functions/examples/rate-limiting) — Upstash Redis pattern
- [Google Calendar API Sync Guide](https://developers.google.com/workspace/calendar/api/guides/sync) — Differential sync, push notification channels
- [Google Calendar Push Notifications](https://developers.google.com/workspace/calendar/api/guides/push) — 7-day expiration, channel renewal requirements
- [CalendHub Bidirectional Sync Guide 2025](https://calendhub.com/blog/implement-bidirectional-calendar-sync-2025/) — Conflict loop prevention, rate limit tradeoffs
- [ABC Trainerize Calendar Sync](https://help.trainerize.com/hc/en-us/articles/360052750491) — Industry precedent: fitness apps sync appointments one-way first, then add bidirectional
- Existing codebase: `20260315120000_onboarding.sql` — `client_profiles` table already exists with fitness intake fields
- Existing codebase: `20260316100000_subscription_foundation.sql` — `guard_subscription_tier_write` trigger pattern reusable for audit log
- Existing codebase: `.planning/codebase/CONCERNS.md` — Security gaps requiring v3.0 hardening

---

*Architecture research for: FitRush v3.0 — Calendar Sync, Trainee Profiles, Security Hardening, UX Polish*
*Researched: 2026-03-17*
