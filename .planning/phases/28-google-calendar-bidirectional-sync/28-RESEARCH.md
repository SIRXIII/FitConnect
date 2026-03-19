# Phase 28: Google Calendar Bidirectional Sync - Research

**Researched:** 2026-03-19
**Domain:** Google Calendar API v3, OAuth 2.0, Supabase Edge Functions (Deno), PostgreSQL scheduling
**Confidence:** HIGH (core patterns verified against official Google docs + project codebase)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- "Connect Google Calendar" button in trainer Settings/Calendar section
- OAuth popup flow (not redirect) — trainer stays in FitRush
- Supabase Edge Function handles OAuth token exchange and storage
- Tokens stored encrypted in a new `google_calendar_connections` table
- Disconnect option with confirmation dialog
- Connection status indicator (Connected/Not Connected) with last sync time
- When a booking is confirmed, create a Google Calendar event via GCal API
- Event includes: client name, session type, location, time, FitRush booking link
- Store GCal event ID on the booking record for future updates/deletion
- Edge Function `sync-booking-to-gcal` handles the API call
- Retry logic: 3 attempts with exponential backoff on GCal API failure
- Periodic sync (every 15 min via pg_cron or on-demand) pulls trainer's GCal events
- External events that overlap with FitRush availability slots mark those slots as blocked
- Blocked slots are NOT bookable (filtered from client-facing queries)
- Use Google Calendar push notifications (webhooks) for real-time sync if feasible, otherwise polling
- Store external events in a `gcal_blocked_slots` table
- When a booking is cancelled, delete the corresponding GCal event
- Use the stored GCal event ID from the booking record
- Graceful handling: if GCal deletion fails, log error but don't block the cancellation
- Existing iCal export (Phase 19) continues working unchanged
- Trainers without Google Calendar connection see iCal as the primary option
- Both can coexist — iCal + GCal connected simultaneously

### Claude's Discretion
- Whether to use Google push notifications (webhooks) or polling for external event sync
- OAuth token refresh mechanism details
- How to handle trainers who revoke Google access externally
- Edge Function naming and structure
- gcal_blocked_slots table schema details

### Deferred Ideas (OUT OF SCOPE)
- None — this is the final v4.0 phase
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CALSYNC-01 | Trainer can connect Google Calendar via OAuth from settings | OAuth 2.0 web server flow; popup pattern; token exchange Edge Function |
| CALSYNC-02 | FitRush bookings automatically push to Google Calendar as events | GCal events.insert API; `sync-booking-to-gcal` Edge Function; `gcal_event_id` on bookings |
| CALSYNC-03 | External Google Calendar events block FitRush availability slots | GCal events.list API; `gcal_blocked_slots` table; pg_cron polling at 15 min intervals |
| CALSYNC-04 | Booking cancellation removes the corresponding Google Calendar event | GCal events.delete API; graceful failure pattern; extend `cancel-booking` Edge Function |
| CALSYNC-05 | Existing iCal export continues working as fallback during OAuth verification | CalendarExportCard.tsx + `calendar-export` Edge Function untouched; coexistence confirmed |
</phase_requirements>

---

## Summary

Phase 28 implements Google Calendar bidirectional sync for trainers. The feature has three flows: (1) OAuth connection — trainer authorizes FitRush to access their Google Calendar via a popup, tokens stored in a new `google_calendar_connections` table; (2) outbound push — when a booking is confirmed/cancelled, FitRush creates/deletes the corresponding GCal event; (3) inbound pull — FitRush polls GCal every 15 minutes to detect external events that would conflict with availability slots, marking those slots as blocked.

The Google Calendar API v3 requires OAuth 2.0 with `access_type=offline` to receive refresh tokens. The minimum scope for creating and deleting events is `https://www.googleapis.com/auth/calendar.events`. Token refresh must be handled server-side in Edge Functions. The popup + postMessage pattern works well for OAuth without leaving the page. Push notifications (GCal webhooks) are technically possible but require domain verification, max 7-day channel expiry with manual renewal, and a public HTTPS endpoint — polling is substantially simpler and meets the 15-min latency requirement.

Google OAuth apps in "Testing" publishing status are limited to 100 test users with tokens expiring after 7 days. The app is already noted as needing OAuth verification (see STATE.md Blockers). For production, the app must be submitted for Google OAuth app verification, which takes 4–8 weeks when sensitive scopes are involved.

**Primary recommendation:** Use pg_cron polling (15 min) for inbound sync — significantly simpler than push notifications with no domain verification requirement. Reserve push notifications as a future enhancement after OAuth verification completes.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Google Calendar API v3 | REST (no npm package needed) | Create/delete/list calendar events | Official Google Calendar API; no SDK needed for Deno Edge Functions |
| `fetch` (native Deno) | Deno built-in | HTTP calls to GCal REST API | Native in Deno runtime; no googleapis npm package needed |
| `@supabase/supabase-js` | 2.49.8 (match existing) | Supabase client for Edge Functions | Already used in all existing edge functions |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `crypto` (native Deno) | Deno built-in | Generate secure `state` param for OAuth CSRF protection | During OAuth authorization URL construction |
| Lucide React icons | existing | Calendar connection UI icons | CalendarTab UI extension |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw `fetch` to GCal REST | `googleapis` npm package | googleapis is large (Node-first), not well-suited for Deno edge; raw fetch is simpler and sufficient |
| pg_cron polling | GCal push notifications (webhooks) | Webhooks require domain verification + channel renewal every ≤7 days + Supabase public endpoint; polling is simpler and sufficient for 15-min latency |
| Popup + postMessage | Full-page redirect OAuth | Redirect loses page state and complicates the trainer Settings UX; popup keeps trainer on the page |

**Installation:** No new npm packages required. All dependencies are either native Deno APIs or already installed in the project.

**Version verification:** Not applicable — using native Deno fetch and existing `@supabase/supabase-js@2.49.8`.

---

## Architecture Patterns

### Recommended Project Structure
```
supabase/functions/
├── google-calendar-connect/   # OAuth token exchange (new)
├── sync-booking-to-gcal/      # Push booking → GCal event (new)
├── sync-gcal-events/          # Poll GCal → block slots (new)
└── cancel-booking/            # Extended to delete GCal event (modified)

src/components/calendar/
├── CalendarExportCard.tsx     # Unchanged (iCal fallback)
└── GoogleCalendarConnect.tsx  # New: Connect/Disconnect UI card

supabase/migrations/
└── 20260320200000_google_calendar_sync.sql  # New tables + cron job
```

### Pattern 1: OAuth Popup + postMessage
**What:** Parent page opens a small popup to Google's OAuth URL. Callback page (hosted at `/auth/google-callback`) sends the auth code back via `postMessage`. Parent receives code, sends to Edge Function for token exchange.
**When to use:** Required — user decision is popup flow, not redirect.

```typescript
// Source: https://dev.to/dinkydani21/how-we-use-a-popup-for-google-and-outlook-oauth-oci
// In GoogleCalendarConnect.tsx

const handleConnect = () => {
  const state = crypto.randomUUID(); // CSRF protection
  sessionStorage.setItem('gcal_oauth_state', state);

  const params = new URLSearchParams({
    client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    redirect_uri: `${window.location.origin}/auth/google-callback`,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar.events',
    access_type: 'offline',
    prompt: 'consent',  // CRITICAL: forces refresh_token to be returned on every auth
    state,
  });

  const popup = window.open(
    `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
    'googleCalendarAuth',
    'menubar=no,toolbar=no,width=500,height=600'
  );

  const onMessage = async (event: MessageEvent) => {
    if (event.origin !== window.location.origin) return;
    if (!event.data?.code) return;
    window.removeEventListener('message', onMessage);

    const savedState = sessionStorage.getItem('gcal_oauth_state');
    if (event.data.state !== savedState) return; // CSRF check

    await exchangeCodeForTokens(event.data.code);
  };

  window.addEventListener('message', onMessage);
};
```

```typescript
// /auth/google-callback route (React page, runs in popup)
// Reads code + state from URL, posts to opener, closes self

useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  if (code && window.opener) {
    window.opener.postMessage({ code, state }, window.location.origin);
    window.close();
  }
}, []);
```

### Pattern 2: Edge Function Token Exchange and Storage
**What:** Edge Function receives the auth code, exchanges it with Google for access + refresh tokens, stores them in `google_calendar_connections`.
**When to use:** On initial OAuth connection.

```typescript
// Source: https://developers.google.com/identity/protocols/oauth2/web-server
// supabase/functions/google-calendar-connect/index.ts

// Token exchange
const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    code,
    client_id: requireEnv('GOOGLE_CLIENT_ID'),
    client_secret: requireEnv('GOOGLE_CLIENT_SECRET'),
    redirect_uri: requireEnv('GOOGLE_REDIRECT_URI'),
    grant_type: 'authorization_code',
  }),
});

const tokens = await tokenRes.json();
// tokens.access_token, tokens.refresh_token, tokens.expires_in

// Upsert into google_calendar_connections
await adminClient.from('google_calendar_connections').upsert({
  trainer_id: trainerProfile.id,
  access_token: tokens.access_token,         // short-lived (~1hr)
  refresh_token: tokens.refresh_token,       // long-lived, store securely
  expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
  connected_at: new Date().toISOString(),
  last_sync_at: null,
}, { onConflict: 'trainer_id' });
```

### Pattern 3: Access Token Refresh
**What:** Before any GCal API call, check if `expires_at < now()`. If expired, use refresh token to get a new access token. If refresh fails with `invalid_grant`, mark the connection as disconnected.
**When to use:** In every Edge Function that calls the GCal API.

```typescript
// Source: https://developers.google.com/identity/protocols/oauth2/web-server
async function getValidAccessToken(connection: GcalConnection, adminClient: SupabaseClient) {
  const now = new Date();
  if (new Date(connection.expires_at) > now) {
    return connection.access_token;  // Still valid
  }

  // Refresh
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: requireEnv('GOOGLE_CLIENT_ID'),
      client_secret: requireEnv('GOOGLE_CLIENT_SECRET'),
      refresh_token: connection.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  const refreshed = await res.json();
  if (refreshed.error === 'invalid_grant') {
    // Token revoked or expired — mark disconnected
    await adminClient.from('google_calendar_connections')
      .update({ is_active: false, disconnected_reason: 'token_revoked' })
      .eq('trainer_id', connection.trainer_id);
    throw new Error('gcal_token_revoked');
  }

  // Update stored token
  await adminClient.from('google_calendar_connections').update({
    access_token: refreshed.access_token,
    expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
  }).eq('trainer_id', connection.trainer_id);

  return refreshed.access_token;
}
```

### Pattern 4: Create GCal Event for Booking
**What:** POST to GCal events.insert with booking details. Store the returned event `id` on the booking record.
**When to use:** After booking status changes to `confirmed`.

```typescript
// Source: https://developers.google.com/workspace/calendar/api/v3/reference/events/insert
const gcalRes = await fetch(
  'https://www.googleapis.com/calendar/v3/calendars/primary/events',
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      summary: `FitRush Session - ${clientName}`,
      description: `Session type: ${sessionType}\nBooked via FitRush: ${bookingUrl}`,
      location: trainerLocation,
      start: { dateTime: slot.start_time },
      end: { dateTime: slot.end_time },
    }),
  }
);
const event = await gcalRes.json();
const gcalEventId = event.id;

// Store on booking
await adminClient.from('bookings')
  .update({ gcal_event_id: gcalEventId })
  .eq('id', bookingId);
```

### Pattern 5: Poll GCal for External Events (Blocking)
**What:** Fetch events from trainer's primary calendar for the next 4 weeks, compare against `availability_slots`, upsert overlapping events into `gcal_blocked_slots`, update `availability_slots.is_gcal_blocked = true`.
**When to use:** pg_cron every 15 minutes via `sync-gcal-events` Edge Function.

```typescript
// Source: https://developers.google.com/workspace/calendar/api/v3/reference/events/list
const timeMin = new Date().toISOString();
const timeMax = new Date(Date.now() + 28 * 86400000).toISOString();

const listRes = await fetch(
  `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
  new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    // Do NOT include FitRush-created events (filter by source or extendedProperties)
  }),
  { headers: { Authorization: `Bearer ${accessToken}` } }
);
const { items } = await listRes.json();
// items: array of { id, summary, start.dateTime, end.dateTime }
```

### Pattern 6: Delete GCal Event on Cancellation
**What:** Call GCal events.delete. If it fails (event already deleted, or 404), log and continue — do NOT block the booking cancellation.
**When to use:** In `cancel-booking` Edge Function, after the booking is successfully cancelled.

```typescript
// Source: https://developers.google.com/workspace/calendar/api/v3/reference/events/delete
if (booking.gcal_event_id && accessToken) {
  try {
    await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${booking.gcal_event_id}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } }
    );
  } catch (gcalErr) {
    console.error('GCal event deletion failed (non-blocking):', gcalErr);
  }
}
```

### Anti-Patterns to Avoid
- **Missing `prompt: 'consent'` on OAuth URL:** Without this, Google only returns a refresh_token on the FIRST authorization. If trainer reconnects without `prompt: 'consent'`, no refresh token is returned, and the feature breaks silently after 1 hour.
- **Storing tokens in `trainer_profiles`:** Project decision (STATE.md) is to use a separate `google_calendar_connections` table. Tokens should NEVER be in the main profile row.
- **Blocking booking cancellation on GCal failure:** GCal deletion is best-effort. Cancellation must proceed regardless.
- **Using `https://www.googleapis.com/auth/calendar` (full scope):** Over-privileged. Use `calendar.events` which covers create/delete/list events without giving access to calendar settings.
- **Calling GCal API without checking token expiry:** Access tokens expire in ~1 hour. Every GCal call must go through the refresh-check helper.
- **Push notifications without managing channel renewal:** GCal push channels expire (≤7 days). Without a renewal cron, sync silently stops. Polling is safer for this implementation.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP calls to Google APIs | Custom HTTP client wrapper | Native `fetch` in Deno | Deno has built-in fetch; no SDK needed |
| OAuth PKCE / state verification | Custom crypto | `crypto.randomUUID()` (Deno built-in) | Available natively; edge case handling already done |
| Token expiry math | Custom JWT decoder | Store `expires_at` timestamp on connection record | Don't decode JWT; just store expiry time from `expires_in` field |
| Retry with backoff | Custom retry loop | Simple for-loop with `await new Promise(r => setTimeout(r, delay * 2^attempt))` | 3 attempts max; keep it simple |
| External event overlap detection | Custom interval overlap algorithm | SQL `tstzrange` overlap query in migration | PostgreSQL handles range overlap natively |

**Key insight:** The Google Calendar REST API is simple JSON over HTTPS. Don't import heavyweight SDKs into Deno edge functions — raw `fetch` is cleaner, faster, and avoids Deno/Node compatibility issues.

---

## Common Pitfalls

### Pitfall 1: Refresh Token Only Returned on First Auth (Missing `prompt: 'consent'`)
**What goes wrong:** No `prompt: 'consent'` on the OAuth URL → Google only returns refresh_token on the trainer's VERY FIRST authorization. If they disconnect and reconnect, no refresh_token is returned, `google_calendar_connections.refresh_token` becomes null, and sync breaks after 1 hour.
**Why it happens:** Google's default behavior is "incremental auth" — if the user already granted the scope, no refresh token is re-issued.
**How to avoid:** Always include `prompt: 'consent'` AND `access_type: 'offline'` in the OAuth authorization URL.
**Warning signs:** `google_calendar_connections.refresh_token` is null after a reconnect attempt.

### Pitfall 2: 100-User Limit During Testing Phase
**What goes wrong:** Google OAuth app in "Testing" publishing status is limited to 100 test users. Tokens granted by test users expire after 7 days. For production deployment, OAuth verification is required.
**Why it happens:** Google security requirement for apps using sensitive scopes.
**How to avoid:** The app is already noted in STATE.md blockers as needing OAuth verification. The feature works for testing with up to 100 testers, but must not ship to all users until verification completes.
**Warning signs:** Trainers report being disconnected every 7 days; new users see "unverified app" warning.

### Pitfall 3: `invalid_grant` After Token Revocation
**What goes wrong:** Trainer revokes FitRush access from their Google Account settings. Subsequent token refresh calls return `invalid_grant`. If not handled, the Edge Function crashes and errors are surfaced to users.
**Why it happens:** External revocation outside FitRush's control.
**How to avoid:** Catch `invalid_grant` on refresh, set `is_active = false` on the connection, surface a "Reconnect required" message in the UI.
**Warning signs:** `is_active = false` connections with `disconnected_reason = 'token_revoked'`.

### Pitfall 4: FitRush Events Appearing as "External" Events
**What goes wrong:** When polling GCal for external events, FitRush-created events (bookings we pushed) would also appear and block their own slots, causing phantom blocks.
**Why it happens:** The sync-gcal-events poller doesn't know which events it created.
**How to avoid:** Tag FitRush-created events with `extendedProperties.private.source = 'fitrush'` when inserting. Filter those out during the polling query using `privateExtendedProperty=source=fitrush` to exclude them.
**Warning signs:** Slots that are both booked AND gcal-blocked when they shouldn't be.

### Pitfall 5: Blocking Slot Overlap Logic in Application Code
**What goes wrong:** Overlap detection coded in TypeScript in the Edge Function is error-prone (timezone edge cases, boundary conditions).
**Why it happens:** Temptation to do it in code rather than SQL.
**How to avoid:** Use PostgreSQL `tstzrange` overlap operator (`&&`) in a migration function. The database handles timezone-aware interval math correctly.

### Pitfall 6: OAuth Callback Route Not Registered in App Router
**What goes wrong:** The popup callback page at `/auth/google-callback` isn't defined as a route in App.tsx, causing a blank screen or 404 in the popup.
**Why it happens:** Easy to forget since it's a transient popup page, not a main UI page.
**How to avoid:** Add a `GoogleCalendarCallback` page component and register it in App.tsx routing before testing the OAuth flow.
**Warning signs:** Popup opens and shows a blank white page or the React "not found" page.

---

## Code Examples

### Database Migration Pattern (modeled after Phase 22 pg_cron pattern)
```sql
-- Source: Project pattern from 20260319000000_availability_toggle.sql

-- 1. google_calendar_connections table
CREATE TABLE public.google_calendar_connections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id      uuid NOT NULL UNIQUE REFERENCES trainer_profiles(id) ON DELETE CASCADE,
  access_token    text NOT NULL,
  refresh_token   text NOT NULL,
  expires_at      timestamptz NOT NULL,
  is_active       boolean NOT NULL DEFAULT true,
  disconnected_reason text,
  connected_at    timestamptz NOT NULL DEFAULT now(),
  last_sync_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trainer can manage own gcal connection"
  ON public.google_calendar_connections
  FOR ALL
  USING (trainer_id IN (
    SELECT id FROM trainer_profiles WHERE user_id = auth.uid()
  ));

-- 2. gcal_blocked_slots table
CREATE TABLE public.gcal_blocked_slots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id      uuid NOT NULL REFERENCES trainer_profiles(id) ON DELETE CASCADE,
  gcal_event_id   text NOT NULL,
  gcal_summary    text,
  starts_at       timestamptz NOT NULL,
  ends_at         timestamptz NOT NULL,
  synced_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trainer_id, gcal_event_id)
);

-- 3. Add gcal_event_id to bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS gcal_event_id text;

-- 4. Add is_gcal_blocked to availability_slots
ALTER TABLE public.availability_slots
  ADD COLUMN IF NOT EXISTS is_gcal_blocked boolean NOT NULL DEFAULT false;

-- 5. RPC to detect overlapping slots and mark as blocked
CREATE OR REPLACE FUNCTION public.apply_gcal_blocks(p_trainer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Mark slots that overlap with any gcal_blocked_slot for this trainer
  UPDATE availability_slots AS s
  SET is_gcal_blocked = true
  FROM gcal_blocked_slots b
  WHERE s.trainer_id = p_trainer_id
    AND b.trainer_id = p_trainer_id
    AND tstzrange(s.start_time, s.end_time) && tstzrange(b.starts_at, b.ends_at)
    AND NOT s.is_booked;

  -- Unblock slots that no longer have overlapping gcal events
  UPDATE availability_slots AS s
  SET is_gcal_blocked = false
  WHERE s.trainer_id = p_trainer_id
    AND s.is_gcal_blocked = true
    AND NOT EXISTS (
      SELECT 1 FROM gcal_blocked_slots b
      WHERE b.trainer_id = p_trainer_id
        AND tstzrange(s.start_time, s.end_time) && tstzrange(b.starts_at, b.ends_at)
    );
END;
$$;

-- 6. pg_cron for polling (graceful fallback if pg_cron unavailable)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'sync-gcal-events',
      '*/15 * * * *',
      $cron$ SELECT net.http_post(
        url := current_setting('app.supabase_url') || '/functions/v1/sync-gcal-events',
        headers := '{"Content-Type":"application/json","Authorization":"Bearer ' || current_setting('app.service_role_key') || '"}'::jsonb,
        body := '{}'::jsonb
      ); $cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron not available — schedule sync-gcal-events manually';
  END IF;
END $$;
```

### Retry with Exponential Backoff (for sync-booking-to-gcal)
```typescript
// Source: CONTEXT.md locked decision — 3 attempts with exponential backoff
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3
): Promise<T> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxAttempts - 1) throw err;
      const delay = Math.pow(2, attempt) * 1000; // 1s, 2s
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error('unreachable');
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Google Sign-In JS library (deprecated) | Google Identity Services (GIS) + raw OAuth | 2023 | GIS provides popup flow; raw fetch works fine for token exchange in Deno |
| `googleapis` npm SDK | Raw `fetch` to REST API | 2022+ (Deno era) | googleapis is Node-first; raw fetch is idiomatic Deno |
| Implicit OAuth flow (token in URL) | Authorization code flow (`response_type=code`) | 2019+ | Implicit flow deprecated; code flow is current standard |

**Deprecated/outdated:**
- Google Sign-In JS: replaced by Google Identity Services
- Implicit OAuth flow: deprecated, all new apps should use authorization code flow

---

## Open Questions

1. **pg_net availability for cron-triggered Edge Function calls**
   - What we know: Phase 27 notes mention `pg_net` extension availability as a blocker concern on free tier. The cron job pattern used in Phase 26 uses `SELECT public.expire_stale_availability()` (a pure SQL function) rather than calling an Edge Function via HTTP.
   - What's unclear: Whether Supabase's current plan has `pg_net` available for `net.http_post()` in cron. If not, `sync-gcal-events` can't be scheduled via pg_cron with an HTTP call.
   - Recommendation: Plan A — use `pg_net` if available (check `SELECT * FROM pg_extension WHERE extname = 'pg_net'`). Plan B — make `sync-gcal-events` callable from the frontend on a timer (e.g., useEffect with setInterval) for MVP. Plan C — defer real-time polling to a separate always-on approach.

2. **Supabase secrets for Google OAuth credentials**
   - What we know: `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` must be stored as Supabase Edge Function secrets (not hardcoded). `VITE_GOOGLE_CLIENT_ID` must be a public env var for the frontend popup URL construction.
   - What's unclear: Whether the project's current `.env` + `supabase/.env` setup is documented.
   - Recommendation: Document required env vars in RESEARCH.md and ensure plan tasks include setting them.

3. **Scope sensitivity and OAuth verification timeline**
   - What we know: `https://www.googleapis.com/auth/calendar.events` is a sensitive scope. Apps using sensitive scopes must go through Google's OAuth verification before removing the 100-user testing limit. STATE.md already notes this as a blocker started at Phase 21.
   - What's unclear: Current verification status.
   - Recommendation: This feature can be implemented fully in testing mode. Add a UI note that GCal sync requires OAuth verification to work for all users. The feature should ship but be gated behind completion of the existing verification process.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (via `vite.config.ts` `test` block) |
| Config file | `vite.config.ts` — `test.globals = true, environment = 'jsdom'` |
| Quick run command | `cd "Cenlar demand gt 1-17" && npx vitest run --reporter=verbose` |
| Full suite command | `cd "Cenlar demand gt 1-17" && npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CALSYNC-01 | Connect button renders; disconnect confirmation renders | unit (component) | `npx vitest run src/components/calendar/GoogleCalendarConnect.test.tsx` | ❌ Wave 0 |
| CALSYNC-02 | sync-booking-to-gcal retry logic (3 attempts, backoff) | unit (Edge Function logic) | `npx vitest run supabase/functions/sync-booking-to-gcal/` | ❌ Wave 0 (if tested) |
| CALSYNC-03 | apply_gcal_blocks SQL function / slot blocking | manual-only | GCal events overlap query requires live Postgres | Manual |
| CALSYNC-04 | GCal deletion failure does not block cancellation | unit | `npx vitest run src/components/calendar/` | ❌ Wave 0 |
| CALSYNC-05 | CalendarExportCard renders unchanged | unit (regression) | `npx vitest run src/components/calendar/CalendarExportCard` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd "Cenlar demand gt 1-17" && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd "Cenlar demand gt 1-17" && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/components/calendar/GoogleCalendarConnect.test.tsx` — covers CALSYNC-01 connect/disconnect UI states
- [ ] `src/pages/GoogleCalendarCallback.test.tsx` — covers popup callback postMessage behavior
- [ ] Note: Edge Function logic tests require Deno test runner, not Vitest — test retry logic via unit-testable helper modules if needed

---

## Sources

### Primary (HIGH confidence)
- [Google OAuth 2.0 Web Server Flow](https://developers.google.com/identity/protocols/oauth2/web-server) — authorization URL params, token exchange, refresh token flow
- [Google Calendar API Auth Scopes](https://developers.google.com/workspace/calendar/api/auth) — scope selection: `calendar.events` for create/delete
- [Google Calendar API Events Insert](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert) — event resource format, required fields, response with `id`
- [Google Calendar API Events List](https://developers.google.com/workspace/calendar/api/v3/reference/events/list) — timeMin/timeMax, singleEvents, nextSyncToken
- [Google Calendar API Error Handling](https://developers.google.com/calendar/api/guides/errors) — 401 handling, exponential backoff for 403/429
- [Google Calendar Push Notifications](https://developers.google.com/workspace/calendar/api/guides/push) — channel setup, expiry, no auto-renewal
- Project codebase: `cancel-booking/index.ts`, `calendar-export/index.ts`, `vite.config.ts`, `20260319000000_availability_toggle.sql` — existing patterns verified by direct reading

### Secondary (MEDIUM confidence)
- [OAuth Popup + postMessage pattern](https://dev.to/dinkydani21/how-we-use-a-popup-for-google-and-outlook-oauth-oci) — popup UX implementation, verified against Google's own GIS documentation
- [Google OAuth Unverified App Limits](https://support.google.com/cloud/answer/7454865) — 100 user cap, 7-day token expiry in Testing mode

### Tertiary (LOW confidence)
- WebSearch finding: refresh tokens expire if unused for 6 months — not directly verified against official docs but consistent with multiple community sources

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — native Deno fetch + existing supabase-js, no new dependencies needed
- Architecture: HIGH — OAuth patterns verified against official Google docs; existing codebase patterns directly read
- Pitfalls: HIGH — `prompt: 'consent'` issue verified against official OAuth docs; 100-user limit verified against official Google support docs
- Push notifications recommendation: HIGH — GCal push docs confirm no auto-renewal, max 7-day channels; polling recommendation is confirmed correct

**Research date:** 2026-03-19
**Valid until:** 2026-07-01 (Google OAuth scopes are stable; API v3 has been stable for years)
