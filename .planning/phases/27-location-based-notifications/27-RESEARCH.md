# Phase 27: Location-Based Notifications - Research

**Researched:** 2026-03-19
**Domain:** Supabase PostgreSQL triggers, PostGIS spatial queries, browser Geolocation API, React notification UI
**Confidence:** HIGH

## Summary

Phase 27 adds "Looking Now" mode and location-based in-app alerts for clients when nearby trainers go live. The infrastructure is almost entirely in place: PostGIS is already active (`workout_locations.geo_point` with GIST index), Supabase Realtime publishes to the `notifications` table, and `useNotifications` hook + Navbar dropdown already consume and display notifications. The goLive trigger point in `useAvailabilitySession.ts` is the clean hook for firing proximity matching.

The core engineering work is: (1) a new `client_notification_preferences` table to store area, radius, and opt-in flags per client, (2) a PostgreSQL function (called from the goLive path or a Supabase trigger) that queries the new preferences table with a PostGIS distance check against the trainer's active workout location, enforces frequency caps via timestamp filtering on the existing `notifications` table, and inserts matching notification rows, (3) a "Looking Now" toggle UI that overwrites the saved area with live GPS coordinates, (4) a Notification Preferences section on ClientDashboard (as a new tab), and (5) a notification card renderer that handles the new `trainer_live_nearby` type.

The key architectural question (Edge Function vs. database trigger) resolves clearly in favor of a PostgreSQL function called from a database trigger on `trainer_profiles`. A DB trigger is zero-latency, free-tier safe (no `pg_net` required), and consistent with the existing `handle_booking_notifications` trigger pattern. The trigger fires on `availability_status` UPDATE from `offline` to `live` and delegates immediately to a `notify_nearby_clients()` function.

**Primary recommendation:** Use a PostgreSQL trigger + SECURITY DEFINER function to fire notifications on trainer go-live, with PostGIS `ST_DWithin` for radius matching and timestamp-based frequency cap queries against the `notifications` table.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- New "Notification Preferences" section on ClientDashboard (or ClientPassport)
- Toggle: Location-based alerts ON/OFF (master switch)
- Area selector: text input for neighborhood/city with Google Places Autocomplete (reuse from WorkoutLocationsManager)
- Radius slider: 1-10 miles (how far to search for trainers)
- Preferences MUST be set before any notifications fire (gate check)
- "Looking Now" toggle button in the search/map area with pulsing indicator
- When active: uses browser geolocation API for real-time position instead of saved area
- Auto-disables after 2 hours (safety cap)
- Only available on mobile (Capacitor) and desktop browsers with geolocation
- Use existing `notifications` table pattern (already exists from prior milestones)
- Notification content: "{Trainer Name} just went live at {Location} — {rate}/hr" with "View" CTA
- Triggered when a trainer calls goLive and there are clients with matching area preferences
- Edge Function or database trigger fires on trainer availability_status change to 'live'
- Max 3 location-based alerts per client per day (rolling 24hr window)
- 4-hour cooldown per trainer per client (same trainer can't re-notify within 4hrs)
- Enforced server-side in the notification trigger/function
- Caps stored as columns or checked via query on notifications table with timestamp filtering

### Claude's Discretion
- Whether to use a Supabase Edge Function or database trigger for notification creation
- Exact notification card styling (should match existing notification patterns)
- How "Looking Now" interacts with the map view (auto-center? show radius?)
- Whether radius uses Haversine or PostGIS distance (PostGIS preferred since already available)
- Notification preferences table schema vs columns on client_profiles

### Deferred Ideas (OUT OF SCOPE)
- Push notifications via FCM/APNs
- Background location tracking (iOS App Store rejection risk)
- "Notify me when X trainer goes live" (trainer-specific alerts)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| NOTIF-01 | Client can set preferred area/neighborhood for trainer availability alerts | New `client_notification_preferences` table with `area_label` (text) + `area_lat`/`area_lng` (coordinates from Places Autocomplete) |
| NOTIF-02 | Client can opt into live GPS mode when activating "looking now" toggle | Browser `navigator.geolocation.getCurrentPosition()` already used in MapView; reuse same pattern; store transient GPS coords in React state |
| NOTIF-03 | Client receives in-app alert when a nearby trainer goes live at a great rate | PostgreSQL trigger on `trainer_profiles` UPDATE → `notify_nearby_clients()` function using `ST_DWithin` → insert into `notifications` table → Realtime delivers to client |
| NOTIF-04 | Client can toggle location-based notifications on/off | `notif_enabled` boolean column on `client_notification_preferences`; gate check in `notify_nearby_clients()` |
| NOTIF-05 | Notifications are frequency-capped (max 3/day per client, 4hr cooldown per trainer) | Two COUNT queries against `notifications` table filtered by `type = 'trainer_live_nearby'` and timestamp windows; checked before insert in PG function |
| NOTIF-06 | Client can configure notification preferences before alerts begin | Preferences UI with gate: `notify_nearby_clients()` skips clients where `notif_enabled IS NOT TRUE` or no area saved |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| PostGIS (already installed) | via `extensions` schema | `ST_DWithin` radius matching in PG function | Already active from Phase 23 `workout_locations.geo_point` |
| @vis.gl/react-google-maps (already installed) | current | Places Autocomplete for area selector | Same pattern as `WorkoutLocationsManager.tsx` |
| Supabase Realtime (already active) | via `supabase` client | Push new `notifications` rows to `useNotifications` hook | `notifications` table already in realtime publication |
| Vitest (already installed) | ^4.1.0 | Unit tests for preferences hook and frequency cap logic | Project standard; configured in `vite.config.ts` |

### No New Packages Required
All required infrastructure is already installed. This phase is pure SQL + TypeScript over existing primitives.

## Architecture Patterns

### Recommended Project Structure

New files to create:

```
src/
  hooks/
    useNotificationPreferences.ts   # CRUD for client_notification_preferences
    useLookingNow.ts                # "Looking Now" GPS mode state + 2hr auto-disable
  components/
    client/
      NotificationPreferencesSection.tsx  # Area selector + radius slider + master toggle
    search/
      LookingNowToggle.tsx                # Pulsing toggle in SearchSection/MapView area
  pages/
    ClientDashboard.tsx             # Add "Alerts" tab (modify existing)

supabase/
  migrations/
    20260320100000_location_notifications.sql  # preferences table + notify_nearby_clients() + trigger
```

### Pattern 1: PostgreSQL Trigger + SECURITY DEFINER Function (Recommended)

**What:** A trigger on `trainer_profiles` detects `availability_status` change from `offline` to `live` and calls `notify_nearby_clients(trainer_id, active_location_id)`. The function does all the work inside the database — spatial query, cap checks, inserts — with no external HTTP calls.

**When to use:** Server-side, zero-latency, free-tier safe (no pg_net needed), consistent with `handle_booking_notifications` trigger already in the codebase.

**Why not Edge Function:** The existing `goLive` path is a direct Supabase `.update()` call from the frontend. An Edge Function would need to be called separately after the DB write, adding a roundtrip and complexity. A DB trigger fires atomically with the UPDATE. The `pg_net` extension is not confirmed available on the current free plan (noted in STATE.md blockers).

**Example (SQL pattern — consistent with existing triggers in codebase):**

```sql
-- Source: mirrors handle_booking_notifications pattern from 20260311143000_fitconnect_current_schema.sql

CREATE OR REPLACE FUNCTION public.notify_nearby_clients()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trainer_name  text;
  v_location_addr text;
  v_rate          numeric;
  v_trainer_lat   double precision;
  v_trainer_lng   double precision;
  v_pref          RECORD;
  v_daily_count   int;
  v_cooldown_count int;
BEGIN
  -- Only fire when transitioning to 'live'
  IF NEW.availability_status <> 'live' OR OLD.availability_status = 'live' THEN
    RETURN NEW;
  END IF;

  -- Only fire if trainer has an active location
  IF NEW.active_location_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get trainer info
  SELECT p.full_name, tp.optimized_rate
    INTO v_trainer_name, v_rate
  FROM trainer_profiles tp
  JOIN profiles p ON p.id = tp.user_id
  WHERE tp.id = NEW.id;

  -- Get active workout location
  SELECT address, latitude, longitude
    INTO v_location_addr, v_trainer_lat, v_trainer_lng
  FROM workout_locations
  WHERE id = NEW.active_location_id;

  -- Loop over opted-in clients with preferences set
  FOR v_pref IN
    SELECT cp.user_id, cp.notif_radius_miles,
           cp.area_lat, cp.area_lng
    FROM client_notification_preferences cp
    WHERE cp.notif_enabled = true
      AND cp.area_lat IS NOT NULL
      AND cp.area_lng IS NOT NULL
      -- PostGIS radius check: client area within radius of trainer location
      AND ST_DWithin(
        extensions.ST_MakePoint(v_trainer_lng, v_trainer_lat)::extensions.geography,
        extensions.ST_MakePoint(cp.area_lng, cp.area_lat)::extensions.geography,
        cp.notif_radius_miles * 1609.34  -- miles to meters
      )
  LOOP
    -- Daily cap: max 3 trainer_live_nearby notifications per client in rolling 24hr
    SELECT COUNT(*) INTO v_daily_count
    FROM notifications
    WHERE user_id = v_pref.user_id
      AND type = 'trainer_live_nearby'
      AND created_at > now() - INTERVAL '24 hours';

    IF v_daily_count >= 3 THEN CONTINUE; END IF;

    -- Trainer cooldown: same trainer cannot re-notify within 4hr
    SELECT COUNT(*) INTO v_cooldown_count
    FROM notifications
    WHERE user_id = v_pref.user_id
      AND type = 'trainer_live_nearby'
      AND link LIKE '%' || NEW.id || '%'
      AND created_at > now() - INTERVAL '4 hours';

    IF v_cooldown_count > 0 THEN CONTINUE; END IF;

    INSERT INTO notifications (user_id, type, title, message, link)
    VALUES (
      v_pref.user_id,
      'trainer_live_nearby',
      format('%s just went live nearby', coalesce(nullif(v_trainer_name,''), 'A trainer')),
      format('%s — $%s/hr', coalesce(v_location_addr, 'Nearby'), v_rate),
      '/search?trainer=' || NEW.id
    );
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trainer_went_live_notify_clients
  AFTER UPDATE ON public.trainer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.notify_nearby_clients();
```

### Pattern 2: client_notification_preferences Table Schema

**What:** Separate table (not columns on `client_profiles`) to keep concerns clean and avoid another ALTER TABLE ADD COLUMN round.

**When to use:** Preferred over adding columns to `client_profiles` — avoids cluttering a table with 15+ columns; easier to index; `client_profiles` RLS already grants trainer read access which we do NOT want for notification preferences.

```sql
CREATE TABLE public.client_notification_preferences (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  notif_enabled   boolean     NOT NULL DEFAULT false,
  area_label      text,                        -- human-readable neighborhood/city from Places
  area_lat        double precision,            -- geocoded lat of saved area
  area_lng        double precision,            -- geocoded lng of saved area
  notif_radius_miles int NOT NULL DEFAULT 5
                    CHECK (notif_radius_miles >= 1 AND notif_radius_miles <= 10),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- RLS: clients manage only their own preferences
ALTER TABLE public.client_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client manages own notif prefs"
  ON public.client_notification_preferences
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### Pattern 3: "Looking Now" State Management

**What:** `useLookingNow` hook manages GPS active state with 2-hour auto-disable timer. Overwrites `area_lat`/`area_lng` in local state only (does not persist to the preferences table — GPS mode is session-only).

```typescript
// Source: browser Geolocation API, same pattern as MapView.tsx lines 241-258

export function useLookingNow() {
  const [isActive, setIsActive] = useState(false);
  const [livePosition, setLivePosition] = useState<{ lat: number; lng: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activate = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      setLivePosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setIsActive(true);
      // Auto-disable after 2 hours
      timerRef.current = setTimeout(() => {
        setIsActive(false);
        setLivePosition(null);
      }, 2 * 60 * 60 * 1000);
    });
  }, []);

  const deactivate = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsActive(false);
    setLivePosition(null);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return { isActive, livePosition, activate, deactivate };
}
```

### Pattern 4: Places Autocomplete for Area Selector (Reuse WorkoutLocationsManager)

The existing `WorkoutLocationsManager.tsx` already uses `placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions()` and resolves coordinates via `PlacesService.getDetails()`. The `NotificationPreferencesSection` must be wrapped in `<APIProvider>` with `libraries={['places']}` if not already in the parent tree. If rendered inside `ClientDashboard` which is not currently inside an `APIProvider`, add a wrapping provider scoped to that component.

### Anti-Patterns to Avoid

- **Haversine in TypeScript:** PostGIS `ST_DWithin` is already installed and indexed. Never compute distance in application code for server-side matching.
- **Storing GPS coordinates in the preferences table:** "Looking Now" is session-only. The persistent area should be from Places Autocomplete (user-selected neighborhood), not transient GPS. Mixing them would cause stale GPS coordinates to fire notifications after the user left the area.
- **Using `pg_net` or calling an Edge Function from the trigger:** `pg_net` is not confirmed available (STATE.md blocker). Calling HTTP from a trigger also adds latency inside a transaction.
- **Client-side frequency cap checks:** Any client can bypass these. All frequency cap logic must live inside `notify_nearby_clients()` in the database.
- **Adding columns to `client_profiles`:** That table is readable by trainers (for booked trainers RLS policy). Notification preferences should NOT be visible to trainers.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Distance calculation | Haversine in TypeScript / application-side math | PostGIS `ST_DWithin` with `geography` type | Already indexed; handles edge cases near poles/antimeridian; consistent with `trainers_in_view` RPC pattern |
| Address geocoding | Custom geocoder | `placesLib.AutocompleteSuggestion` + `PlacesService.getDetails()` | Already built in WorkoutLocationsManager; returns coordinates for free |
| Real-time notification delivery | Polling loop | Supabase Realtime (already active) | `notifications` table already published; `useNotifications` hook already subscribes via INSERT event |
| Notification display | New component | Extend existing Navbar notification dropdown | Already renders `notif.title`, `notif.message`, `notif.link` — add icon/styling for `type === 'trainer_live_nearby'` |

**Key insight:** The only net-new infrastructure is the `client_notification_preferences` table and the `notify_nearby_clients()` trigger function. Everything else (Realtime delivery, display, Autocomplete, PostGIS, geolocation) already exists and needs only minimal extension.

## Common Pitfalls

### Pitfall 1: Trigger Fires During Warm-Up Phase (Going Live)
**What goes wrong:** The goLive flow in `useAvailabilitySession.ts` has a 5-second warm-up before writing `availability_status = 'live'` to the DB. The trigger fires when the DB UPDATE commits, which is correct — but if the warm-up is cancelled (`cancelWarmup`), no DB write happens and no trigger fires. This is the correct behavior.
**Why it happens:** The trigger fires on `AFTER UPDATE`, so timing is correctly tied to the committed DB state.
**How to avoid:** No change needed. The 5-second delay is on the frontend; the trigger fires on the actual DB commit.
**Warning signs:** If testing manually, be aware of the 5-second delay.

### Pitfall 2: `ST_DWithin` Geography Units
**What goes wrong:** `ST_DWithin` with `geometry` type uses degrees, not meters. With `geography` type (which `workout_locations.geo_point` uses), it uses meters.
**Why it happens:** PostGIS has two type systems. `geo_point` is `extensions.geography(POINT, 4326)`.
**How to avoid:** Cast inputs to `geography` explicitly in the function: `ST_MakePoint(lng, lat)::extensions.geography`. Convert miles to meters: `radius_miles * 1609.34`.

### Pitfall 3: `notify_nearby_clients` Must Use Fully-Qualified Schema Names
**What goes wrong:** The function uses `SET search_path = public` which means `extensions` schema is not in scope.
**Why it happens:** Security-hardened functions strip the search path.
**How to avoid:** Use `extensions.ST_DWithin`, `extensions.ST_MakePoint`, etc. — exactly as done in `trainers_in_view` RPC. Reference: `20260319100000_map_trainer_locations.sql` line 72.

### Pitfall 4: RLS on `client_notification_preferences` Blocks Trigger
**What goes wrong:** The `notify_nearby_clients()` function runs as `SECURITY DEFINER` (same uid as the defining user). If the trigger function is owned by a role without access to `client_notification_preferences`, the SELECT will fail silently.
**Why it happens:** SECURITY DEFINER runs as the function owner. All existing notification triggers are `SECURITY DEFINER SET search_path = public` and owned by `postgres` (supabase superuser).
**How to avoid:** Define `notify_nearby_clients()` as `SECURITY DEFINER` and grant SELECT on `client_notification_preferences` to `authenticated` and to the function owner. Match the ownership pattern of `handle_booking_notifications`.

### Pitfall 5: Client Preference TS Types Not Regenerated Mid-Phase
**What goes wrong:** Supabase TypeScript types in `src/types/supabase.ts` won't include the new `client_notification_preferences` table unless regenerated.
**Why it happens:** Project convention: "Supabase TS types not regenerated mid-phase — use `(supabase as any)` cast." (STATE.md multiple entries)
**How to avoid:** Use `(supabase as any).from('client_notification_preferences')` in `useNotificationPreferences.ts`. Add a manual type definition inline.

### Pitfall 6: `APIProvider` Not Available in ClientDashboard
**What goes wrong:** `NotificationPreferencesSection` uses `useMapsLibrary('places')` which requires an `<APIProvider>` ancestor. ClientDashboard currently has no map context.
**Why it happens:** WorkoutLocationsManager wraps itself in `<APIProvider>`, but ClientDashboard does not.
**How to avoid:** Wrap `NotificationPreferencesSection` in its own `<APIProvider apiKey={...} libraries={['places']}>` inside the component. Check `WorkoutLocationsManager.tsx` for the exact pattern.

### Pitfall 7: Cooldown Check Uses `link LIKE` Pattern
**What goes wrong:** The trainer cooldown check in the PG function uses `link LIKE '%' || trainer_id || '%'` which is a string scan. This is fine for current scale but won't scale to millions of rows.
**Why it happens:** `notifications` table doesn't have a `trainer_id` column.
**How to avoid:** For this phase, the LIKE pattern is acceptable (small user base). Alternative: add a `related_entity_id` column to `notifications` table for this and future feature types. Document as a known limitation.

## Code Examples

Verified patterns from existing codebase:

### Geolocation API (from MapView.tsx lines 241-258)
```typescript
// Source: Cenlar demand gt 1-17/src/components/search/MapView.tsx
navigator.geolocation.getCurrentPosition(
  (pos) => {
    setClientPosition({
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
    });
  },
  () => {
    setGeolocationDenied(true);
  }
);
```

### Supabase Realtime INSERT subscription (from useNotifications.ts)
```typescript
// Source: src/hooks/useNotifications.ts
const channel = supabase
  .channel('notifications')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'notifications',
    filter: `user_id=eq.${user.id}`,
  }, (payload) => {
    const newNotif = payload.new as Notification;
    setNotifications((prev) => [newNotif, ...prev].slice(0, 20));
    setUnreadCount((prev) => prev + 1);
  })
  .subscribe();
```

### PostGIS Spatial Query Pattern (from trainers_in_view migration)
```sql
-- Source: 20260319100000_map_trainer_locations.sql
-- All PostGIS calls must use extensions. prefix when search_path = ''
wl.geo_point OPERATOR(extensions.&&)
    extensions.ST_SetSRID(
      extensions.ST_MakeBox2D(
        extensions.ST_Point(min_lng, min_lat),
        extensions.ST_Point(max_lng, max_lat)
      ), 4326
    )
```

### Notification Insert Pattern (from handle_booking_notifications)
```sql
-- Source: 20260311143000_fitconnect_current_schema.sql
INSERT INTO public.notifications (user_id, type, title, message, link)
VALUES (
  target_user_id,
  'trainer_live_nearby',          -- new type for this phase
  'Trainer Name just went live nearby',
  'Location Name — $75/hr',
  '/search?trainer=uuid'
);
```

### Existing notification dropdown rendering (from Navbar.tsx)
```tsx
// Source: src/components/layout/Navbar.tsx lines 122-155
// Existing: renders notif.title, notif.message, notif.link, notif.read
// This phase: add icon/badge when notif.type === 'trainer_live_nearby'
notifications.map((notif) => (
  <button key={notif.id} onClick={() => { if (!notif.read) markAsRead(notif.id); if (notif.link) navigate(notif.link); }}>
    <p className="text-xs font-medium text-ink">{notif.title}</p>
    <p className="text-[10px] text-ink/40 mt-0.5">{notif.message}</p>
  </button>
))
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| pg_net for DB→Edge HTTP calls | Direct PG trigger function (no HTTP) | Phase 27 decision | Free-tier safe; zero external latency |
| Haversine in application code | PostGIS `ST_DWithin` | Phase 23 (PostGIS installed) | Server-side, indexed, accurate |
| Push notifications (FCM) | In-app Realtime only | Explicitly deferred | Avoids iOS complexity |

**Deprecated/outdated:**
- Polling for new notifications: Replaced by Supabase Realtime INSERT subscription in `useNotifications.ts` since prior phases.

## Open Questions

1. **pg_net availability on Supabase free plan**
   - What we know: STATE.md explicitly flags "Confirm pg_net extension availability on current Supabase plan before designing notification trigger (free tier requires pg_cron polling fallback)"
   - What's unclear: Whether pg_net is available
   - Recommendation: Use PostgreSQL trigger (no pg_net needed). This resolves the blocker entirely — no HTTP calls from the database.

2. **`related_entity_id` column on notifications**
   - What we know: The trainer cooldown check needs to identify which trainer sent a notification. Currently the only linkage is via the `link` column.
   - What's unclear: Whether to add `related_entity_id uuid` to `notifications` now vs. using `LIKE '%trainer_id%'` pattern.
   - Recommendation: For this phase, use `link LIKE '%' || trainer_id || '%'`. Document as tech debt. Adding a new column is a migration that could be done in a follow-on phase.

3. **"Looking Now" + MapView interaction**
   - What we know: CONTEXT.md marks this as Claude's discretion.
   - Recommendation: When "Looking Now" is active, pass `livePosition` to the existing MapView `defaultCenter` prop and show a `RadiusCircle` around the client's position using the selected radius. Use the existing `ClientLocationDot.tsx` component that's already in the map component directory. This makes the live position visible without new infrastructure.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.0 |
| Config file | `vite.config.ts` (test section: `globals: true, environment: 'jsdom'`) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NOTIF-01 | `useNotificationPreferences` saves area label + coords to Supabase | unit | `npx vitest run src/hooks/useNotificationPreferences.test.ts` | ❌ Wave 0 |
| NOTIF-02 | `useLookingNow` activates GPS, auto-disables after 2hr timer | unit | `npx vitest run src/hooks/useLookingNow.test.ts` | ❌ Wave 0 |
| NOTIF-03 | `notify_nearby_clients()` inserts notification row for matching client | manual-only | SQL function; test via `supabase db reset` + direct UPDATE in migration test | N/A |
| NOTIF-04 | `useNotificationPreferences` toggles `notif_enabled` flag | unit | `npx vitest run src/hooks/useNotificationPreferences.test.ts` | ❌ Wave 0 |
| NOTIF-05 | Frequency cap: 4th notification in 24hr is blocked | manual-only | PG function logic; integration test via `INSERT` simulation in SQL | N/A |
| NOTIF-06 | `NotificationPreferencesSection` renders form; gate blocks save when no area set | unit | `npx vitest run src/components/client/NotificationPreferencesSection.test.tsx` | ❌ Wave 0 |

**Note on NOTIF-03 and NOTIF-05:** These are PostgreSQL trigger/function behaviors. They can only be tested meaningfully against a real Supabase instance or local `supabase start` environment. Mark as manual-only; not automated in Vitest.

### Sampling Rate
- **Per task commit:** `npx vitest run src/hooks/useNotificationPreferences.test.ts src/hooks/useLookingNow.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/hooks/useNotificationPreferences.test.ts` — covers NOTIF-01, NOTIF-04, NOTIF-06
- [ ] `src/hooks/useLookingNow.test.ts` — covers NOTIF-02 (mock geolocation + fake timers)
- [ ] `src/components/client/NotificationPreferencesSection.test.tsx` — covers NOTIF-06 render/gate

*(Existing test infrastructure: Vitest configured, jsdom environment, @testing-library/react installed. No new framework setup needed. Convention: `.toBeTruthy()` not `.toBeInTheDocument()` per Phase 23.1-02 decision.)*

## Sources

### Primary (HIGH confidence)
- Codebase: `src/hooks/useNotifications.ts` — Realtime subscription pattern, notifications table schema
- Codebase: `src/hooks/useAvailabilitySession.ts` — goLive trigger point, DB write pattern
- Codebase: `supabase/migrations/20260319100000_map_trainer_locations.sql` — PostGIS schema, ST_DWithin/geography pattern
- Codebase: `supabase/migrations/20260311143000_fitconnect_current_schema.sql` — notifications table DDL, `handle_booking_notifications` trigger pattern
- Codebase: `src/components/search/MapView.tsx` — browser geolocation usage
- Codebase: `src/components/trainer/WorkoutLocationsManager.tsx` — Places Autocomplete pattern
- Codebase: `src/components/layout/Navbar.tsx` — notification dropdown rendering
- `.planning/STATE.md` — project decisions: `(supabase as any)` cast convention, PostGIS geography type overrides, pg_net blocker note
- `.planning/config.json` — `nyquist_validation: true`

### Secondary (MEDIUM confidence)
- PostGIS docs: `ST_DWithin` with `geography` type uses meters as distance unit (consistent with project's `extensions.geography(POINT, 4326)` usage)

### Tertiary (LOW confidence)
- None — all critical claims verified against codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all tools already installed and in use
- Architecture: HIGH — trigger pattern directly mirrors existing `handle_booking_notifications` in the same migration file
- Pitfalls: HIGH — derived from actual project decisions documented in STATE.md (SECURITY DEFINER, search_path, supabase as any cast, APIProvider wrapping)
- Frequency cap SQL: HIGH — pattern is standard SQL COUNT with WHERE clause; no external dependencies

**Research date:** 2026-03-19
**Valid until:** 2026-04-18 (stable stack; 30-day window)
