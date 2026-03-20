# Phase 22: Availability Toggle Foundation - Research

**Researched:** 2026-03-18
**Domain:** Supabase Realtime + PostgreSQL concurrency + React state (Zustand) + Framer Motion UI
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Sticky header bar on trainer dashboard — always visible, never scrolls away
- Green accent bar + "You are LIVE" status text when online; neutral/dark when offline
- Toggle is a single tap to go live / go offline
- 5-second "Going live..." warm-up animation before trainer becomes visible to clients
- Going offline with upcoming bookings: allow with warning ("You have 2 upcoming bookings. Going offline won't cancel them.")
- First-time use: quick dismissible tooltip explaining the toggle
- Per-session toggle: trainer sets default mode in settings, can override when going live
- Instant Book: client books immediately, slot is reserved atomically
- Request to Book: client sends request, trainer sees it in dashboard queue
- Badge on trainer profile card and profile page: "Instant Book" or "Request to Book"
- Request queue shows rich client card: name, avatar, Fitness Passport summary, booking history with this trainer, requested slot time, countdown to auto-decline
- Max 5 pending requests at a time; new clients see "Trainer is busy" when queue is full
- Individual accept/decline only (no batch operations)
- 30-minute auto-decline timeout on pending requests
- Switching from Request to Instant mid-session: pending requests stay alive, new bookings are instant
- Auto-decline all pending requests when trainer goes offline (manual or auto-expire)
- Pill buttons in sticky header: 1hr, 2hr, 4hr, EOD
- Always-visible countdown next to status: "LIVE - 2h 14m remaining"
- EOD = midnight in trainer's local timezone
- Tap countdown to extend without going offline — reopens pill buttons, new duration adds to current time
- Atomic PostgreSQL RPC for booking creation (SELECT ... FOR UPDATE on slot row)
- When client loses race: toast error "This slot was just booked by another client" + auto-refresh available slots
- Realtime slot updates on booking page — grey out slots as they get booked by others in real time
- For Request mode: pending booking appears in "My Bookings" with "Pending Approval" status + countdown to auto-decline
- 10-minute warning notification before sleep timer expires: "Your availability expires in 10 minutes. Extend?"
- 12-hour maximum session duration cap (even without timer)
- pg_cron job checks for stale sessions every 5 minutes (per AVAIL-03)
- Auto-decline all pending requests when auto-expiry triggers
- Green dot + "Live Now" badge on trainer cards in search results
- Live trainers get visual priority in search results
- No live notifications in this phase (deferred to Phase 27)
- Strictly 1:1 personal training — one client per slot
- No overlapping availability time ranges allowed
- Group sessions deferred to future phase

### Claude's Discretion
- Exact animation timing and easing for warm-up transition
- Header bar layout details (spacing, typography sizing)
- pg_cron implementation specifics
- Realtime channel naming and subscription patterns
- Error state handling beyond double-booking (network failures, etc.)

### Deferred Ideas (OUT OF SCOPE)
- Group sessions / configurable slot capacity — future phase
- Live notifications when favorite trainer goes online — Phase 27
- Push notifications for booking requests — requires push infrastructure (FCM)
- Overlapping availability for different locations — future phase
- Auto-on scheduling for trainer availability — deferred to AUTO-01
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AVAIL-01 | Trainer can toggle online/offline availability (Uber-style live switch) | Sticky header component pattern identified; Zustand store extension strategy defined; Supabase RPC for state write |
| AVAIL-02 | Trainer can set sleep timer to auto-disable availability at a chosen time | Pill buttons UI pattern from BillingToggle; `sleep_timer_expires_at` column on `trainer_profiles`; EOD via `Intl.DateTimeFormat` |
| AVAIL-03 | System auto-expires stale availability sessions via pg_cron | pg_cron available on Supabase paid plans; polling fallback required for free tier; 5-minute interval UPDATE function identified |
| AVAIL-04 | Booking creation uses atomic PostgreSQL RPC to prevent double-booking race conditions | `SELECT ... FOR UPDATE` advisory locking pattern confirmed; existing `BookSession.tsx` direct insert identified for replacement |
</phase_requirements>

---

## Summary

Phase 22 adds Uber-style trainer availability — a live/offline toggle with sleep timer, Airbnb-style booking modes, and a race-condition-safe booking RPC — to FitRush. The codebase is well-prepared: Supabase Realtime subscriptions are already in use in `TrainerDashboard.tsx`, the Zustand auth store has a clear extension point for availability state, and `BillingToggle.tsx` provides the exact pill/toggle CSS pattern to reuse. Framer Motion (v12, already installed) handles the 5-second warm-up animation and state transitions.

The most technically sensitive work is the atomic PostgreSQL RPC in `BookSession.tsx`: the existing direct `INSERT` into `bookings` has no concurrency protection. This must be replaced with a PL/pgSQL function that uses `SELECT ... FOR UPDATE` to lock the slot row before inserting, returning a structured error when the slot is taken. pg_cron is the standard mechanism for stale session cleanup (AVAIL-03), but its availability must be confirmed for this Supabase project's plan before writing the migration — Supabase's Free plan does not include pg_cron; it requires Pro or above. The project is already past Phase 21, so a paid plan is likely, but this must be verified.

A new `booking_requests` table is required for Request to Book mode. This table is absent from the current schema and needs a full migration including RLS policies, a 30-minute auto-decline trigger or pg_cron cleanup, and Realtime publication. The `trainer_profiles` table needs four new columns: `availability_status`, `booking_mode`, `sleep_timer_expires_at`, and `availability_session_started_at` (for the 12-hour cap check).

**Primary recommendation:** Write the atomic booking RPC first (AVAIL-04 is the safety critical path), then add DB columns + `booking_requests` table, then build the UI components from the top down: `AvailabilityHeader` → `LiveToggle` → `SleepTimerPills` → `CountdownDisplay` → `BookingRequestQueue`.

---

## Standard Stack

### Core (already installed — no new packages required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | ^2.99.0 | Realtime subscriptions, RPC calls, DB access | Already in use throughout app |
| `framer-motion` | ^12.35.2 | Warm-up progress bar, state transition cross-fades | Already in use in BookingWizard |
| `zustand` | ^5.0.11 | Global availability state (extends auth store) | Established pattern in auth.ts |
| `sonner` | ^2.0.7 | Toast notifications (double-booking error, warnings) | Already used throughout app |
| `lucide-react` | ^0.555.0 | Icons (live dot, timer icon) | Already used in UI |
| `vitest` | ^4.1.0 | Unit tests for RPC logic, countdown utils, state transitions | Already configured in vite.config.ts |

### No new npm packages needed

All required libraries are already installed. The UI spec confirms no shadcn, no registry components, no new third-party packages.

**Installation:** No new packages required.

---

## Architecture Patterns

### Recommended Project Structure

New files for this phase:

```
src/
├── components/
│   ├── trainer/
│   │   ├── AvailabilityHeader.tsx     # Sticky header bar (new)
│   │   ├── LiveToggle.tsx              # Toggle pill with warm-up state (new)
│   │   ├── SleepTimerPills.tsx         # 1hr/2hr/4hr/EOD pill group (new)
│   │   ├── CountdownDisplay.tsx        # "2h 14m remaining" (new)
│   │   ├── BookingRequestCard.tsx      # Rich client request card (new)
│   │   └── BookingRequestQueue.tsx     # Queue container, max 5 (new)
│   └── shared/
│       ├── LiveNowBadge.tsx            # Green dot + "Live Now" (new)
│       └── BookingModeBadge.tsx        # "Instant Book"/"Request to Book" (new)
├── hooks/
│   └── useAvailabilitySession.ts       # Manages live state, countdown, auto-expiry warning (new)
├── stores/
│   └── auth.ts                         # Extend with availability fields (modified)
├── pages/
│   ├── TrainerDashboard.tsx            # Add AvailabilityHeader (modified)
│   └── BookSession.tsx                 # Replace direct insert with RPC (modified)
└── types/
    └── supabase.ts                     # Add new table types (modified)

supabase/
├── migrations/
│   └── 20260319000000_availability_toggle.sql   # All schema changes (new)
└── functions/
    └── (no new Edge Functions — pg_cron + RPC handles server-side logic)
```

### Pattern 1: Sticky Header — Fixed Position Below Global Nav

The existing `TrainerDashboard.tsx` has `pt-32` on the outer div, meaning the global nav is 8rem (128px / `h-32`). The sticky availability header sits below the nav:

```tsx
// src/components/trainer/AvailabilityHeader.tsx
// Position: fixed, top-16 (nav height), z-40
<div className={`fixed top-16 left-0 right-0 z-40 h-16 border-b border-ink/10 bg-paper
  ${isLive ? 'border-t-2 border-green-500' : ''}`}>
  ...
</div>
```

The dashboard content wrapper then needs `pt-16` added (on top of existing `pt-32`) to avoid content being hidden under the sticky bar:

```tsx
// TrainerDashboard.tsx — change outer div
<div className="min-h-screen bg-paper pt-48 pb-20 px-6">
```

(`pt-48` = `pt-32` existing nav offset + `pt-16` for the new availability header)

### Pattern 2: Atomic Booking RPC — SELECT ... FOR UPDATE

Replace the direct `supabase.from('bookings').insert(...)` in `BookSession.tsx` with an RPC call to a PostgreSQL function:

```sql
-- In migration: create_booking_atomic RPC
CREATE OR REPLACE FUNCTION public.create_booking_atomic(
  p_slot_id      uuid,
  p_client_id    uuid,
  p_trainer_id   uuid,
  p_rate_charged numeric,
  p_platform_fee numeric,
  p_trainer_payout numeric,
  p_notes        text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slot availability_slots;
  v_booking_id uuid;
BEGIN
  -- Lock the slot row to prevent concurrent bookings
  SELECT * INTO v_slot
  FROM availability_slots
  WHERE id = p_slot_id
  FOR UPDATE;

  -- Check slot is still available
  IF v_slot.is_booked THEN
    RETURN json_build_object('error', 'slot_taken');
  END IF;

  IF v_slot.deleted_at IS NOT NULL THEN
    RETURN json_build_object('error', 'slot_deleted');
  END IF;

  -- Mark slot as booked
  UPDATE availability_slots
  SET is_booked = true, updated_at = now()
  WHERE id = p_slot_id;

  -- Create the booking
  INSERT INTO bookings (
    client_id, trainer_id, slot_id, status,
    rate_charged, platform_fee, trainer_payout, notes
  )
  VALUES (
    p_client_id, p_trainer_id, p_slot_id, 'pending',
    p_rate_charged, p_platform_fee, p_trainer_payout, p_notes
  )
  RETURNING id INTO v_booking_id;

  RETURN json_build_object('booking_id', v_booking_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_booking_atomic(...) TO authenticated;
```

In `BookSession.tsx` `handleBooking`, replace the insert block with:

```typescript
const { data, error } = await supabase.rpc('create_booking_atomic', {
  p_slot_id: slot.id,
  p_client_id: user.id,
  p_trainer_id: trainerProfile.id,
  p_rate_charged: finalRate,
  p_platform_fee: platformFee,
  p_trainer_payout: trainerPayout,
  p_notes: notes || null,
});

if (error || data?.error === 'slot_taken') {
  toast.error('This slot was just booked. Pick another time.');
  // Trigger slot list refresh via Realtime or explicit refetch
  return null;
}
return data?.booking_id ?? null;
```

### Pattern 3: Zustand Store Extension

Extend `TrainerProfile` type and auth store to hold live availability state. Avoid storing derived UI state (countdown seconds) in Zustand — compute that locally in `useAvailabilitySession`:

```typescript
// In auth.ts — extend AuthState interface
interface AuthState {
  // ... existing fields ...
  setAvailabilityStatus: (status: 'offline' | 'live', expiresAt?: string | null) => void;
}

// TrainerProfile type needs new DB columns:
// availability_status: 'offline' | 'live' | null
// booking_mode: 'instant' | 'request' | null
// sleep_timer_expires_at: string | null  (ISO timestamp)
// availability_session_started_at: string | null
```

### Pattern 4: Realtime Subscriptions — Existing Pattern to Follow

The existing channel pattern in `TrainerDashboard.tsx` (lines 68–105) is the authoritative example:

```typescript
const channel = supabase
  .channel(`trainer-availability-${trainerProfile.id}`)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'trainer_profiles',
    filter: `id=eq.${trainerProfile.id}`,
  }, (payload) => {
    // update local state from payload.new
  })
  .subscribe();

return () => { supabase.removeChannel(channel); };
```

For `BookSession.tsx` slot greying (Realtime client-side updates when another client books):

```typescript
const slotChannel = supabase
  .channel(`slot-availability-${trainerId}`)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'availability_slots',
    filter: `trainer_id=eq.${trainerId}`,
  }, (payload) => {
    if (payload.new.is_booked) {
      // grey out that slot in UI
      setBookedSlotIds(prev => [...prev, payload.new.id]);
    }
  })
  .subscribe();
```

### Pattern 5: pg_cron Stale Session Cleanup

```sql
-- Enable pg_cron (only if on Supabase Pro+)
-- Verify first: SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- Function to expire stale sessions
CREATE OR REPLACE FUNCTION public.expire_stale_availability()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Expire sessions past their sleep timer
  UPDATE trainer_profiles
  SET
    availability_status = 'offline',
    sleep_timer_expires_at = NULL,
    availability_session_started_at = NULL
  WHERE
    availability_status = 'live'
    AND (
      -- Sleep timer expired
      (sleep_timer_expires_at IS NOT NULL AND sleep_timer_expires_at < now())
      OR
      -- 12-hour hard cap
      (availability_session_started_at IS NOT NULL
        AND availability_session_started_at < now() - INTERVAL '12 hours')
    );

  -- Auto-decline pending booking_requests for offline trainers
  UPDATE booking_requests br
  SET status = 'declined', declined_at = now(), decline_reason = 'trainer_went_offline'
  FROM trainer_profiles tp
  WHERE br.trainer_id = tp.id
    AND tp.availability_status = 'offline'
    AND br.status = 'pending';

  -- Auto-decline requests past 30-minute timeout
  UPDATE booking_requests
  SET status = 'declined', declined_at = now(), decline_reason = 'auto_timeout'
  WHERE status = 'pending'
    AND created_at < now() - INTERVAL '30 minutes';
END;
$$;

-- Schedule every 5 minutes
SELECT cron.schedule(
  'expire-stale-availability',
  '*/5 * * * *',
  $$ SELECT public.expire_stale_availability(); $$
);
```

**pg_cron plan check (CRITICAL):** Run `SELECT * FROM pg_extension WHERE extname = 'pg_cron';` in Supabase SQL editor before migration. If not available, implement via a Supabase Edge Function triggered by a database webhook on a scheduled job, or use the `pg_net` extension with an HTTP poll — but pg_cron is the right tool if available.

### Pattern 6: booking_requests Table

New table needed (not in current schema):

```sql
CREATE TABLE public.booking_requests (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id     uuid NOT NULL REFERENCES trainer_profiles(id) ON DELETE CASCADE,
  client_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  slot_id        uuid NOT NULL REFERENCES availability_slots(id) ON DELETE CASCADE,
  status         text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'accepted', 'declined')),
  decline_reason text,
  declined_at    timestamptz,
  accepted_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- RLS: trainer sees their own requests; client sees requests they sent
ALTER TABLE public.booking_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trainer can manage their requests"
  ON public.booking_requests
  FOR ALL
  USING (trainer_id IN (
    SELECT id FROM trainer_profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "client can view their own requests"
  ON public.booking_requests
  FOR SELECT
  USING (client_id = auth.uid());

CREATE POLICY "client can insert requests"
  ON public.booking_requests
  FOR INSERT
  WITH CHECK (client_id = auth.uid());

-- Enable Realtime for request queue updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_requests;
```

### Anti-Patterns to Avoid

- **Direct DB insert for bookings without atomic RPC:** The existing `BookSession.tsx` pattern is unsafe under concurrent load. Even with RLS, two simultaneous inserts can both see `is_booked = false` before either has committed. Never build a "check then insert" pattern without `FOR UPDATE`.
- **Storing countdown seconds in Zustand:** Countdown state changes every second and should live in local component state (`useAvailabilitySession` hook), not the global store. Only persist the `sleep_timer_expires_at` ISO timestamp.
- **Computing EOD in UTC:** "End of day" must resolve to midnight in the trainer's local timezone via `Intl.DateTimeFormat`, not `new Date().setHours(23, 59, 59)` (which uses local time of the client's machine, but trainers may be in different zones from their device settings).
- **Using `supabase.channel('notifications')` (bare name):** `useNotifications.ts` already uses this channel name. Name new channels with unique identifiers (trainer ID, page context) to avoid cross-subscription conflicts.
- **Forgetting to remove Realtime channels on unmount:** Every `useEffect` that subscribes must return `() => { supabase.removeChannel(channel); }`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Concurrent booking prevention | Client-side "check before insert" | PostgreSQL `SELECT ... FOR UPDATE` in RPC | Client-side checks have a race window between read and write; row-level locking is the only safe solution |
| Auto-expiry scheduling | Frontend timer that calls an API | pg_cron `*/5 * * * *` | Browser timers die when tab closes; server-side cron is reliable |
| Countdown display | Custom date-diff implementation | `Math.floor((expiresAt - Date.now()) / 1000 / 60)` with `setInterval` | Simple arithmetic; no library needed |
| EOD calculation | Custom timezone logic | `Intl.DateTimeFormat` + date parsing | Built into all modern environments; handles DST correctly |
| Toast for double-booking error | Custom notification UI | `sonner` `toast.error()` | Already installed and used throughout app; consistent UX |
| Realtime slot greying | Polling `availability_slots` every N seconds | Supabase Realtime `postgres_changes` subscription | Already established pattern; zero extra polling cost |

**Key insight:** The entire server-side logic for this phase (atomic booking, auto-expiry, auto-decline) belongs in PostgreSQL. No new Edge Functions are needed — pg_cron + RPCs + database triggers handle everything, matching the existing pattern of keeping business logic in the database layer.

---

## Common Pitfalls

### Pitfall 1: pg_cron Not Available on Free Plan

**What goes wrong:** Migration runs `cron.schedule(...)` and fails with "schema cron does not exist" on a Supabase Free plan project.

**Why it happens:** pg_cron is only available on Supabase Pro plan and above. Free plan has pg_net but not pg_cron.

**How to avoid:** Before writing the migration, run `SELECT * FROM pg_extension WHERE extname = 'pg_cron';` in the Supabase SQL editor. If it returns no rows, the migration needs a fallback (pg_net + webhook, or a periodic Edge Function). From STATE.md, the project is on a plan that supports 14 Edge Functions and pg_cron is listed as a concern for Phase 27 specifically regarding `pg_net` — this suggests pg_cron is likely available but must be verified.

**Warning signs:** Migration error mentioning "schema cron" or "function cron.schedule does not exist".

### Pitfall 2: Sticky Header Obscuring Content (z-index Stack)

**What goes wrong:** The sticky `AvailabilityHeader` (z-40) overlaps the global nav (which may also be fixed/sticky) or tab content.

**Why it happens:** The existing `TrainerDashboard.tsx` uses `pt-32` for the global nav offset. Adding a second sticky bar requires increasing top padding by the header height (64px = `pt-16`).

**How to avoid:** The outer div padding must become `pt-48` (12rem = 8rem nav + 4rem availability header). The header must be positioned `top-16` (assumes global nav is `h-16`; verify actual nav height — the dashboard uses `pt-32` which implies `h-32` OR the nav is shorter and the extra padding is decorative whitespace). Check the Nav component height before hardcoding.

**Warning signs:** Content starts scrolled under the availability bar; toggle is covered by nav on mobile.

### Pitfall 3: Realtime Channel Name Collision

**What goes wrong:** The new availability subscription fires handlers meant for a different channel, or `useNotifications.ts` stops receiving notifications.

**Why it happens:** `useNotifications.ts` uses the bare channel name `'notifications'` (line 36). Supabase channels are scoped per client connection, but reusing the same name in the same page context will cause the old channel to be overwritten.

**How to avoid:** Always include a unique scope in channel names:
- `trainer-availability-${trainerProfile.id}` for trainer profile updates
- `slot-realtime-${trainerId}` for booking page slot updates
- `booking-requests-${trainerProfile.id}` for request queue

**Warning signs:** Realtime stops working for notifications after the availability header mounts.

### Pitfall 4: Sleep Timer EOD Timezone Error

**What goes wrong:** EOD timer expires at midnight UTC, not midnight in the trainer's timezone — trainers in Pacific time go offline at 4pm their time.

**Why it happens:** `new Date(new Date().setHours(23, 59, 59))` uses the browser's local system timezone. On iOS (Capacitor), the device timezone may differ from the trainer's workout location.

**How to avoid:** Use the explicit timezone-aware approach:
```typescript
function getEODTimestamp(): Date {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const parts = formatter.formatToParts(now);
  const year = parts.find(p => p.type === 'year')!.value;
  const month = parts.find(p => p.type === 'month')!.value;
  const day = parts.find(p => p.type === 'day')!.value;
  return new Date(`${year}-${month}-${day}T23:59:59`);
}
```

Or simpler: `const eod = new Date(); eod.setHours(23, 59, 59, 0); return eod;` — this is actually correct because `setHours` operates on local time, which IS the trainer's device time. The risk is if a trainer has their device set to the wrong timezone.

**Warning signs:** Trainer reports going offline hours before or after intended EOD.

### Pitfall 5: Warm-Up Window Creates Inconsistent State

**What goes wrong:** Trainer taps toggle, 5-second warm-up starts. During warm-up, a client visits the trainer's profile. The DB already shows `availability_status = 'live'` (if updated immediately) or still `'offline'` (if updated after warm-up). Client sees stale state.

**Why it happens:** The 5-second warm-up is a UI-only animation. The DB write must happen AFTER the warm-up completes, or the warm-up must be purely cosmetic with no DB state change during it.

**How to avoid:** Set `availability_status` in DB only AFTER the 5-second animation completes. During the warm-up, keep DB status as `'offline'` and local UI state as `'warming_up'`. Clients see the trainer as offline until the DB write happens. This is the correct "going live" semantics — the trainer is not yet live until the warm-up completes.

**Warning signs:** Clients receive `'live'` trainer status during the 5-second warm-up window.

### Pitfall 6: Framer Motion 12 API Changes

**What goes wrong:** Code copied from older examples uses deprecated APIs that changed in framer-motion v12.

**Why it happens:** Framer Motion v12 (currently installed as ^12.35.2) made breaking changes from v10/v11 in some animation APIs.

**How to avoid:** Key patterns that are stable in v12:
- `<AnimatePresence>` with `initial={false}` for state transitions
- `motion.div` with `animate={{ width: '100%' }}` for progress bar
- `transition={{ duration: 5, ease: 'linear' }}`
- `initial={{ opacity: 0, y: -8 }}` / `exit={{ opacity: 0, x: 40 }}`

These are all standard Framer Motion patterns unchanged since v10. The one change in v12 is the Motion component API for React — use `motion.div` (not `<Motion>`). The project's `BookingWizard.tsx` already uses framer-motion with AnimatePresence, so follow its import pattern.

---

## Code Examples

Verified patterns from existing codebase:

### Existing Realtime Subscription Pattern (from TrainerDashboard.tsx lines 68–104)

```typescript
// Source: TrainerDashboard.tsx — authoritative pattern for this codebase
useEffect(() => {
  if (!trainerProfile) return;

  const bookingChannel = supabase
    .channel(`trainer-dashboard-bookings-${trainerProfile.id}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'bookings',
        filter: `trainer_id=eq.${trainerProfile.id}`,
      },
      () => { fetchBookingCount(); }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(bookingChannel);
  };
}, [trainerProfile?.id]);
```

### BillingToggle Pill Pattern (reuse for SleepTimerPills)

```typescript
// Source: src/components/subscription/BillingToggle.tsx
const base = 'px-5 py-2 text-[10px] uppercase tracking-[0.2em] font-medium transition-colors';

// Selected: 'bg-ink text-white'
// Unselected: 'text-ink/40 hover:text-ink'
```

### Existing Direct Insert (BookSession.tsx lines 194–208) — TO BE REPLACED

```typescript
// Source: BookSession.tsx handleBooking — replace this with RPC call
const { data, error: bookingError } = await supabase
  .from('bookings')
  .insert({
    client_id: user.id,
    trainer_id: trainerProfile.id,
    slot_id: slot.id,
    status: 'pending',
    rate_charged: finalRate,
    platform_fee: platformFee,
    trainer_payout: trainerPayout,
    notes: notes || null,
  })
  .select('id')
  .single();
```

### Edge Function Auth Pattern (from cancel-booking/index.ts)

```typescript
// Source: supabase/functions/cancel-booking/index.ts — pattern for any future EFs
const authHeader = req.headers.get('Authorization') || '';
const userClient = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { Authorization: authHeader } },
  auth: { persistSession: false },
});
const { data: { user }, error: userError } = await userClient.auth.getUser();
```

### Framer Motion Progress Bar (warm-up animation)

```typescript
// Warm-up progress bar — fills left to right in 5 seconds
import { motion, AnimatePresence } from 'framer-motion';

// During GOING_LIVE state:
<motion.div
  className="absolute inset-x-0 bottom-0 h-0.5 bg-amber-400 origin-left"
  initial={{ scaleX: 0 }}
  animate={{ scaleX: 1 }}
  transition={{ duration: 5, ease: 'linear' }}
  onAnimationComplete={handleWarmupComplete}
/>
```

### Countdown Display

```typescript
// useAvailabilitySession.ts — countdown computed locally, not in Zustand
const [secondsRemaining, setSecondsRemaining] = useState<number>(0);

useEffect(() => {
  if (!sleepTimerExpiresAt) return;

  const tick = () => {
    const remaining = Math.max(0, Math.floor(
      (new Date(sleepTimerExpiresAt).getTime() - Date.now()) / 1000
    ));
    setSecondsRemaining(remaining);
    if (remaining === 600) { // 10 minutes
      toast.warning('Availability expires in 10 min. Extend Timer?', {
        duration: Infinity,
        action: { label: 'Extend Timer', onClick: () => setShowSleepPills(true) },
      });
    }
  };

  tick();
  const interval = setInterval(tick, 1000);
  return () => clearInterval(interval);
}, [sleepTimerExpiresAt]);

// Display format
const hours = Math.floor(secondsRemaining / 3600);
const minutes = Math.floor((secondsRemaining % 3600) / 60);
const display = hours > 0 ? `${hours}h ${minutes}m remaining` : `${minutes}m remaining`;
```

---

## Database Schema Changes Required

### trainer_profiles — 4 new columns

```sql
ALTER TABLE public.trainer_profiles
  ADD COLUMN IF NOT EXISTS availability_status text NOT NULL DEFAULT 'offline'
    CHECK (availability_status IN ('offline', 'live')),
  ADD COLUMN IF NOT EXISTS booking_mode text NOT NULL DEFAULT 'instant'
    CHECK (booking_mode IN ('instant', 'request')),
  ADD COLUMN IF NOT EXISTS sleep_timer_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS availability_session_started_at timestamptz;
```

### booking_requests — new table

See Pattern 6 above for full DDL.

### availability_slots — Realtime must be enabled

```sql
-- Verify: SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'availability_slots';
-- If not present:
ALTER PUBLICATION supabase_realtime ADD TABLE public.availability_slots;
```

### supabase.ts type file — must be updated

After running the migration, update `src/types/supabase.ts` to add:
- `availability_status`, `booking_mode`, `sleep_timer_expires_at`, `availability_session_started_at` to `trainer_profiles` Row/Insert/Update
- Full `booking_requests` table definition

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| pg_cron requires direct Postgres access | Supabase exposes pg_cron on Pro+ via `cron` schema | Supabase Pro plan | Cron jobs can be managed via SQL migrations |
| Framer Motion `useAnimation` hook for sequenced animations | `animate` prop with `onAnimationComplete` callback | framer-motion v10+ | Simpler, declarative; no separate controller |
| Supabase Realtime v1 (broadcast-only) | Realtime v2 with `postgres_changes` filter support | @supabase/supabase-js v2.x | Row-level filters reduce unnecessary payloads |
| Booking inserts without RLS | Bookings table protected by RLS policies | Existing (already in place) | Atomic RPC must be `SECURITY DEFINER` to bypass RLS while still enforcing business rules |

---

## Open Questions

1. **pg_cron availability on this Supabase project**
   - What we know: Project is past Phase 21, likely on paid plan. STATE.md mentions pg_cron concern only for Phase 27 (pg_net, not pg_cron), suggesting pg_cron is expected to be available.
   - What's unclear: Exact Supabase plan for the `qecwxvvlpvrnrqyrdxrj` project is not in any config file.
   - Recommendation: Wave 0 task: run `SELECT * FROM pg_extension WHERE extname = 'pg_cron';` in Supabase SQL editor. If absent, implement expiry via a pg_net + database webhook or a 5-minute cron-trigger Edge Function.

2. **Global nav actual height**
   - What we know: `TrainerDashboard.tsx` outer div uses `pt-32` (8rem / 128px). The sticky header needs to sit at `top-[nav-height]`.
   - What's unclear: Whether `pt-32` is the nav height or additional decorative top margin. The Nav component source wasn't read.
   - Recommendation: Read the Nav component to confirm its height, then set `AvailabilityHeader` `top-` value accordingly. If nav is `h-16` (64px), set header to `top-16`. If nav is `h-32` (128px), set header to `top-32` and total content padding becomes `pt-[calc(8rem+4rem)]`.

3. **Existing bookings trigger for slot mark-as-booked**
   - What we know: `availability_slots.is_booked` is set manually in the current booking flow (or via trigger — not confirmed from migrations read).
   - What's unclear: Whether a database trigger already marks `is_booked = true` when a booking is inserted, or if the application layer does it. The atomic RPC must mark `is_booked = true` explicitly (see Pattern 2 above) — this is safe regardless of whether a trigger also exists, but a trigger would cause a redundant update.
   - Recommendation: Check the latest migrations for any trigger on `bookings INSERT` that sets `availability_slots.is_booked`. If one exists, remove the explicit UPDATE from the RPC to avoid conflicts.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.0 |
| Config file | `vite.config.ts` (test block: `globals: true`, `environment: jsdom`) |
| Quick run command | `cd "Cenlar demand gt 1-17" && npx vitest run --reporter=verbose` |
| Full suite command | `cd "Cenlar demand gt 1-17" && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AVAIL-01 | Toggle sets availability_status in DB and local state | unit | `npx vitest run src/hooks/useAvailabilitySession.test.ts` | ❌ Wave 0 |
| AVAIL-02 | Sleep timer resolves EOD to correct timestamp; countdown decrements correctly | unit | `npx vitest run src/components/trainer/SleepTimerPills.test.ts` | ❌ Wave 0 |
| AVAIL-03 | expire_stale_availability SQL function correctly expires sessions and auto-declines requests | manual-only | SQL: `SELECT public.expire_stale_availability(); SELECT * FROM trainer_profiles WHERE availability_status='live';` | n/a |
| AVAIL-04 | create_booking_atomic RPC returns slot_taken when slot is_booked=true; returns booking_id on success | unit + manual | `npx vitest run src/pages/BookSession.test.ts` | ❌ Wave 0 |

**Note on AVAIL-03:** pg_cron scheduling and the SQL function itself cannot be unit-tested in jsdom. Test the function body manually in Supabase SQL editor by setting a trainer's `sleep_timer_expires_at` to a past timestamp, running the function, and verifying the row is updated.

### Sampling Rate

- **Per task commit:** `cd "Cenlar demand gt 1-17" && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd "Cenlar demand gt 1-17" && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/hooks/useAvailabilitySession.test.ts` — covers AVAIL-01, AVAIL-02 (countdown math, EOD calculation, warm-up state machine)
- [ ] `src/pages/BookSession.test.ts` — covers AVAIL-04 (mock supabase.rpc, test slot_taken error path, test success path)
- [ ] `src/components/trainer/SleepTimerPills.test.ts` — covers AVAIL-02 (pill selection, extend-timer behavior)

---

## Sources

### Primary (HIGH confidence)
- Existing codebase — `TrainerDashboard.tsx`, `BookSession.tsx`, `auth.ts`, `useNotifications.ts` — all read directly
- Existing codebase — `BillingToggle.tsx`, `cancel-booking/index.ts` — read directly for patterns
- Existing codebase — `src/types/supabase.ts` — read directly for schema
- `22-UI-SPEC.md` — design contract read directly (colors, spacing, component inventory, animation contracts)
- `vite.config.ts` — vitest config confirmed directly
- `package.json` — all library versions confirmed directly

### Secondary (MEDIUM confidence)
- Supabase docs (training knowledge, Aug 2025 cutoff) — `postgres_changes` filter syntax, pg_cron availability by plan
- PostgreSQL documentation (training knowledge) — `SELECT ... FOR UPDATE` advisory locking behavior

### Tertiary (LOW confidence)
- pg_cron plan availability for `qecwxvvlpvrnrqyrdxrj` project — must be verified in Supabase dashboard

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed via package.json
- Architecture patterns: HIGH — all patterns derived from reading existing source files directly
- Database schema changes: HIGH — existing schema read from supabase.ts; new columns derived from locked decisions
- pg_cron availability: LOW — plan tier not confirmed from project files; must verify in Supabase console
- Pitfalls: HIGH — all derived from reading actual code and documented decisions

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (stable domain; Supabase Realtime API is mature)
