# Phase 19: Calendar Export & Buffer Times - Research

**Researched:** 2026-03-17
**Domain:** iCal export (RFC 5545), buffer time enforcement in Postgres, Supabase Edge Functions
**Confidence:** HIGH

## Summary

Phase 19 adds two distinct capabilities: (1) calendar export via iCal .ics files and live feed URLs, and (2) configurable buffer times between trainer sessions. Both features require a database migration adding columns to `trainer_profiles`, a new Edge Function for the iCal feed, and modifications to the existing `get_visible_slots` RPC and `lock_and_mark_slot_on_booking_insert` trigger.

The iCal export is straightforward -- RFC 5545 VCALENDAR/VEVENT text generation from booking data, served by a public Edge Function authenticated via an opaque `calendar_export_token` (not trainer UUID). Buffer times require careful server-side enforcement: the booking trigger must check adjacent bookings within the buffer window, and `get_visible_slots` must exclude slots that fall within a booked slot's buffer zone.

**Primary recommendation:** Build iCal as a string-builder Edge Function (no library needed for generation -- RFC 5545 format is simple enough). Use `ical.js` only if parsing .ics is needed. Buffer enforcement belongs in Postgres triggers and RPCs, not client-side.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CAL-01 | iCal .ics file export (one-time download) | Edge Function generates RFC 5545 text from bookings query; frontend triggers download via Blob + URL.createObjectURL |
| CAL-02 | Live iCal feed URL with opaque token | Same Edge Function, token-based auth via `calendar_export_token` column on `trainer_profiles`; token resettable |
| CAL-03 | Buffer time configuration UI (15/30/45/60 min) | New column `buffer_minutes` on `trainer_profiles`; radio/select UI on Calendar Settings page |
| CAL-04 | Server-side buffer enforcement | Modify `lock_and_mark_slot_on_booking_insert` trigger to check adjacent bookings within buffer window |
| CAL-05 | get_visible_slots buffer integration | Modify RPC to exclude unbooked slots that fall within buffer_minutes of any confirmed/pending booking |
| CAL-06 | Calendar settings page for trainers | New `/trainer/settings/calendar` page or new tab on TrainerDashboard with export URL display, token reset, buffer config |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| String builder (no library) | N/A | Generate RFC 5545 .ics text in Edge Function | VCALENDAR/VEVENT format is simple enough (~30 lines of template string). Adding `ical.js` for generation-only is overkill. The codebase already has `npm:` import pattern but a string builder avoids the dependency entirely. |
| Supabase Edge Function (Deno) | existing | Serve calendar-export endpoint | Matches existing pattern (cancel-booking, create-payment-intent). Uses `Deno.serve`, `createClient`, `corsHeaders`. |
| Zod | 4.3.6 (existing) | Validate buffer_minutes input, calendar token requests | Already in `src/lib/schemas.ts`. Add `bufferTimeSchema` and `calendarTokenResetSchema`. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `ical.js` | ^2.2.1 | Parse incoming .ics files | Only needed if CAL scope expands to .ics import. NOT needed for Phase 19 requirements (export only). |
| `sonner` | existing | Toast notifications for token copy, buffer save | Already used throughout the app. |
| `lucide-react` | existing | Calendar, Clock, Copy icons | Already used in TrainerDashboard, TrainerBookings. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| String builder .ics | `ical.js` npm package | Only justified if generating recurrence rules (RRULE) or parsing. Phase 19 exports flat VEVENT entries -- no recurrence. String builder is simpler, zero-dep. |
| Opaque token in URL | JWT-signed URL | JWT adds complexity and expiry management. An opaque random token stored in DB is simpler, resettable, and matches the ARCHITECTURE.md recommendation. |
| Edge Function for .ics | Client-side .ics generation | Client-side works for one-time download (CAL-01) but NOT for live feed (CAL-02) -- calendar apps poll a URL server-side. One Edge Function serves both use cases. |

## Architecture Patterns

### Recommended Project Structure

```
src/
  components/
    calendar/
      CalendarExportCard.tsx     # Display feed URL, copy button, reset token
      BufferTimeSelector.tsx     # Radio group: 0/15/30/45/60 min
  pages/
    TrainerCalendarSettings.tsx  # New page: CAL-06
  lib/
    schemas.ts                   # Add bufferTimeSchema, calendarExportTokenSchema

supabase/
  functions/
    calendar-export/
      index.ts                   # New Edge Function: serves .ics for both download and feed
  migrations/
    2026031XXXXX_calendar_buffer.sql  # Add buffer_minutes, calendar_export_token to trainer_profiles
```

### Pattern 1: iCal Feed Edge Function (Token-Based Public Access)

**What:** A single Edge Function handles both CAL-01 (download) and CAL-02 (feed). It accepts a `token` query parameter, looks up the trainer via `calendar_export_token`, queries their confirmed bookings, and returns RFC 5545 text.

**When to use:** For any calendar subscription URL that external apps (Google Calendar, Apple Calendar) poll.

**Example:**
```typescript
// supabase/functions/calendar-export/index.ts
// GET /functions/v1/calendar-export?token={opaque_token}
// Returns text/calendar -- RFC 5545

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  if (!token) {
    return new Response('Missing token', { status: 400 });
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Look up trainer by opaque token (not UUID)
  const { data: trainer } = await adminClient
    .from('trainer_profiles')
    .select('id, profiles!trainer_profiles_user_id_fkey(full_name)')
    .eq('calendar_export_token', token)
    .maybeSingle();

  if (!trainer) {
    return new Response('Invalid token', { status: 404 });
  }

  // Fetch confirmed/pending bookings with slot times
  const { data: bookings } = await adminClient
    .from('bookings')
    .select('id, notes, status, availability_slots(start_time, end_time), profiles!bookings_client_id_fkey(full_name)')
    .eq('trainer_id', trainer.id)
    .in('status', ['confirmed', 'pending'])
    .gte('availability_slots.start_time', new Date(Date.now() - 7 * 86400000).toISOString());

  const ics = buildICS(trainer, bookings);

  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="fitrush-schedule.ics"',
      'Cache-Control': 'public, max-age=300',
    },
  });
});
```

### Pattern 2: RFC 5545 .ics String Builder

**What:** A simple function that generates valid iCal text from booking data.

**Example:**
```typescript
function buildICS(trainer: { id: string; profiles: { full_name: string } }, bookings: any[]): string {
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  let ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FitRush//Calendar Export//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:FitRush - ${trainer.profiles.full_name}`,
  ];

  for (const b of bookings || []) {
    const slot = b.availability_slots;
    if (!slot) continue;
    const dtstart = new Date(slot.start_time).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const dtend = new Date(slot.end_time).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const clientName = b.profiles?.full_name || 'Client';

    ics.push(
      'BEGIN:VEVENT',
      `UID:${b.id}@fitrush.app`,
      `DTSTAMP:${now}`,
      `DTSTART:${dtstart}`,
      `DTEND:${dtend}`,
      `SUMMARY:FitRush Session - ${clientName}`,
      `DESCRIPTION:Status: ${b.status}${b.notes ? '\\n' + b.notes : ''}`,
      `STATUS:${b.status === 'confirmed' ? 'CONFIRMED' : 'TENTATIVE'}`,
      'END:VEVENT',
    );
  }

  ics.push('END:VCALENDAR');
  return ics.join('\r\n');
}
```

### Pattern 3: Buffer Time Enforcement in Postgres

**What:** Modify the existing `lock_and_mark_slot_on_booking_insert` trigger to check if the slot being booked falls within `buffer_minutes` of any existing active booking for the same trainer.

**Example:**
```sql
-- Inside lock_and_mark_slot_on_booking_insert(), after existing checks:

-- Buffer time enforcement
DECLARE
  v_buffer interval;
  v_conflict_count int;
BEGIN
  -- ... existing checks ...

  -- Get trainer's buffer_minutes (default 0 = no buffer)
  SELECT COALESCE(tp.buffer_minutes, 0) * interval '1 minute'
  INTO v_buffer
  FROM trainer_profiles tp
  WHERE tp.id = locked_slot.trainer_id;

  IF v_buffer > interval '0' THEN
    SELECT COUNT(*) INTO v_conflict_count
    FROM bookings b
    JOIN availability_slots s ON s.id = b.slot_id
    WHERE b.trainer_id = NEW.trainer_id
      AND b.status IN ('pending', 'confirmed')
      AND b.id IS DISTINCT FROM NEW.id
      AND (
        -- New slot starts within buffer of existing booking's end
        (locked_slot.start_time < s.end_time + v_buffer AND locked_slot.start_time >= s.end_time)
        OR
        -- New slot ends within buffer of existing booking's start
        (locked_slot.end_time > s.start_time - v_buffer AND locked_slot.end_time <= s.start_time)
      );

    IF v_conflict_count > 0 THEN
      RAISE EXCEPTION 'This slot conflicts with buffer time between sessions. The trainer requires % minutes between bookings.',
        EXTRACT(EPOCH FROM v_buffer) / 60;
    END IF;
  END IF;
END;
```

### Pattern 4: get_visible_slots with Buffer Integration

**What:** Modify the existing `get_visible_slots` RPC to exclude slots that fall within the trainer's buffer window of any active booking.

**Example:**
```sql
CREATE OR REPLACE FUNCTION public.get_visible_slots(p_trainer_id uuid)
RETURNS SETOF public.availability_slots
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_tier  text;
  v_limit int;
  v_buffer interval;
BEGIN
  SELECT subscription_tier, COALESCE(buffer_minutes, 0) * interval '1 minute'
  INTO   v_tier, v_buffer
  FROM   public.trainer_profiles
  WHERE  id = p_trainer_id;

  v_limit := CASE v_tier
    WHEN 'elite' THEN 2147483647
    WHEN 'pro'   THEN 10
    ELSE              3
  END;

  RETURN QUERY
    SELECT s.*
    FROM   public.availability_slots s
    WHERE  s.trainer_id  = p_trainer_id
      AND  s.is_booked   = false
      AND  s.deleted_at  IS NULL
      AND  s.start_time  > now()
      -- Exclude slots within buffer window of any active booking
      AND  (v_buffer = interval '0' OR NOT EXISTS (
        SELECT 1
        FROM public.bookings b
        JOIN public.availability_slots bs ON bs.id = b.slot_id
        WHERE b.trainer_id = p_trainer_id
          AND b.status IN ('pending', 'confirmed')
          AND (
            s.start_time < bs.end_time + v_buffer
            AND s.end_time > bs.start_time - v_buffer
          )
      ))
    ORDER  BY s.start_time
    LIMIT  v_limit;
END;
$$;
```

### Anti-Patterns to Avoid

- **Client-side-only buffer enforcement:** Buffer checks in React are bypassable. The trigger and RPC must enforce server-side. Client UI is supplementary -- hide slots that would be rejected, but the DB is the authority.
- **Using trainer UUID in feed URL:** UUIDs are guessable/leakable. Use `calendar_export_token` (opaque random string). See ARCHITECTURE.md anti-pattern #2.
- **Generating .ics per-download via Storage:** Do not write .ics files to Supabase Storage. Generate on-the-fly in the Edge Function. Files in Storage would go stale; the Edge Function always returns current data.
- **Hardcoding buffer time:** Buffer must be configurable per-trainer. Some trainers need 15 min to travel; others need 60 min. The 2-hour `BUFFER_WINDOW_MS` in `scheduling.ts` is a separate concept (last-minute slot classification for discounting) -- do not conflate the two.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| iCal date formatting | Date-to-iCal converter | Simple `.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'` | iCal uses `YYYYMMDDTHHMMSSZ` format. One-liner, no library. |
| Token generation | Custom random string | `gen_random_uuid()::text` in Postgres DEFAULT | UUIDs are cryptographically random and unique. No need for custom token generation. |
| Copy-to-clipboard | Custom clipboard API wrapper | `navigator.clipboard.writeText()` + sonner toast | Built into all modern browsers. |

## Common Pitfalls

### Pitfall 1: CRLF Line Endings in iCal

**What goes wrong:** .ics files with `\n` (LF) instead of `\r\n` (CRLF) are silently rejected or misread by Apple Calendar and Outlook.
**Why it happens:** JavaScript template strings use LF. Developers join with `\n` by default.
**How to avoid:** Join .ics lines with `\r\n`. RFC 5545 Section 3.1 mandates CRLF.
**Warning signs:** Google Calendar parses fine (lenient), but Apple Calendar shows 0 events.

### Pitfall 2: Buffer Enforcement Ignoring Cancelled Bookings

**What goes wrong:** Buffer check looks at ALL bookings including cancelled ones, blocking valid slots.
**Why it happens:** Missing `status IN ('pending', 'confirmed')` filter in buffer query.
**How to avoid:** Always filter by active statuses. Completed bookings in the past are also irrelevant for future buffer checks.

### Pitfall 3: Timezone Issues in VEVENT

**What goes wrong:** Events show at wrong times in Google Calendar.
**Why it happens:** Using local time format without TZID, or mixing UTC and local formats.
**How to avoid:** Always use UTC format (`YYYYMMDDTHHMMSSZ` with trailing `Z`). The `availability_slots.start_time` column is `timestamptz` -- already stored in UTC. Convert directly.

### Pitfall 4: Calendar Subscription Caching

**What goes wrong:** Trainer adds a new booking but Google Calendar shows stale data for 24 hours.
**Why it happens:** Google Calendar caches subscription feeds aggressively (up to 24h). Apple Calendar is configurable (5 min to 1 week).
**How to avoid:** Set `Cache-Control: public, max-age=300` (5 min) on the Edge Function response. Document to trainers that Google Calendar has its own refresh schedule. Cannot be controlled server-side.

### Pitfall 5: guard_subscription_tier_write Trigger Blocking buffer_minutes

**What goes wrong:** Trainer cannot save buffer_minutes because the existing trigger blocks writes to new columns.
**Why it happens:** The `guard_subscription_tier_write` trigger fires on ALL updates to `trainer_profiles`. If the trigger only checks subscription fields (which it does -- current implementation is safe), new columns pass through. But if someone modifies the trigger to whitelist columns, `buffer_minutes` would need to be included.
**How to avoid:** Verify that `buffer_minutes` updates pass through the existing guard trigger. The current trigger only checks IS DISTINCT FROM on specific subscription columns -- `buffer_minutes` is not in that list, so it passes through safely.

### Pitfall 6: Overlapping Buffer Window Logic

**What goes wrong:** Buffer check allows booking when slot ends exactly at another slot's start (edge case at buffer boundary).
**Why it happens:** Using `<` instead of `<=` or vice versa in time comparisons.
**How to avoid:** Use strict overlap detection: slot A conflicts with slot B's buffer if `A.start < B.end + buffer AND A.end > B.start - buffer`. Test boundary cases explicitly.

## Code Examples

### Database Migration

```sql
-- Migration: calendar_buffer_times
-- Phase 19: Add calendar export token and buffer minutes to trainer_profiles

-- Calendar export: opaque token for feed URL (CAL-02, CAL-03)
ALTER TABLE public.trainer_profiles
  ADD COLUMN IF NOT EXISTS calendar_export_token text
    UNIQUE DEFAULT gen_random_uuid()::text;

-- Buffer times: minutes between sessions (CAL-03, CAL-04, CAL-05)
ALTER TABLE public.trainer_profiles
  ADD COLUMN IF NOT EXISTS buffer_minutes smallint
    NOT NULL DEFAULT 0
    CHECK (buffer_minutes IN (0, 15, 30, 45, 60));

-- Index for token lookup (used by calendar-export Edge Function)
CREATE UNIQUE INDEX IF NOT EXISTS idx_trainer_profiles_calendar_token
  ON public.trainer_profiles(calendar_export_token)
  WHERE calendar_export_token IS NOT NULL;

-- Backfill: generate tokens for existing trainers (all already have DEFAULT)
-- No explicit backfill needed -- DEFAULT gen_random_uuid() handles new rows;
-- existing rows get NULL. Use UPDATE to backfill:
UPDATE public.trainer_profiles
SET calendar_export_token = gen_random_uuid()::text
WHERE calendar_export_token IS NULL;
```

### Token Reset RPC

```sql
-- Trainer can reset their calendar export token (invalidates existing subscriptions)
CREATE OR REPLACE FUNCTION public.reset_calendar_export_token()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_token text;
BEGIN
  v_new_token := gen_random_uuid()::text;

  UPDATE public.trainer_profiles
  SET calendar_export_token = v_new_token
  WHERE user_id = auth.uid();

  RETURN v_new_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_calendar_export_token() TO authenticated;
```

### Zod Schema Addition

```typescript
// Add to src/lib/schemas.ts
export const bufferTimeSchema = z.object({
  buffer_minutes: z.number().int().refine(
    (v) => [0, 15, 30, 45, 60].includes(v),
    { message: 'Buffer must be 0, 15, 30, 45, or 60 minutes' }
  ),
});

export type BufferTimeInput = z.infer<typeof bufferTimeSchema>;
```

### Frontend: Download .ics File

```typescript
// Triggered by "Export Calendar" button
async function downloadICS(token: string) {
  const url = `${SUPABASE_URL}/functions/v1/calendar-export?token=${token}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Export failed');

  const blob = await res.blob();
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'fitrush-schedule.ics';
  link.click();
  URL.revokeObjectURL(link.href);
}
```

### Frontend: Copy Feed URL

```typescript
// Copy subscription URL for pasting into Google Calendar
async function copyFeedURL(token: string) {
  const url = `${SUPABASE_URL}/functions/v1/calendar-export?token=${token}`;
  await navigator.clipboard.writeText(url);
  toast.success('Calendar feed URL copied to clipboard');
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Google Calendar OAuth for sync | iCal subscription feed (one-way export) | Industry standard since iCal inception | 95% less complexity. No OAuth, no token management, no channel renewal. |
| Library for .ics generation | String builder | N/A | RFC 5545 VEVENT is trivial to generate. Libraries needed only for parsing or RRULE. |
| Fixed buffer time | Per-trainer configurable | This phase | Each trainer chooses their own prep time between sessions. |

**Note on existing `BUFFER_WINDOW_MS` in `scheduling.ts`:** This is a 2-hour "last-minute slot" classification for the AI scheduling / discount feature. It classifies slots starting within 2 hours as `'buffer'` (hard to fill). This is UNRELATED to the new configurable buffer time between sessions. The two concepts coexist. The existing `classifySlot` function does NOT need modification for Phase 19.

## Open Questions

1. **Should the calendar feed include past bookings?**
   - What we know: Google Calendar subscription feeds typically show future events only. Including past events inflates response size.
   - What's unclear: Should we include recently completed sessions (last 7 days) for record-keeping?
   - Recommendation: Include bookings from 7 days ago onward (past confirmed + future pending/confirmed). Small cost, useful for trainers reviewing recent schedule.

2. **Should buffer time apply symmetrically?**
   - What we know: A 30-min buffer means 30 min AFTER one session ends and BEFORE the next starts.
   - What's unclear: Should the buffer apply before the first session of the day and after the last?
   - Recommendation: Buffer applies only BETWEEN sessions (not before first / after last). This matches trainer expectations -- "I need 30 min to travel between clients."

3. **Where does the Calendar Settings page live?**
   - What we know: No `/trainer/settings` page exists. TrainerDashboard has tabs: overview, payouts, analytics, subscription.
   - What's unclear: New tab on TrainerDashboard or new standalone page?
   - Recommendation: Add a "Calendar" tab to TrainerDashboard (consistent with existing tab pattern). Avoids new routing.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | No vitest.config.ts found -- inline in vite.config.ts or default |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CAL-01 | .ics download generates valid RFC 5545 | unit | `npx vitest run src/lib/ical.test.ts -t "buildICS"` | No -- Wave 0 |
| CAL-02 | Feed URL uses opaque token, returns text/calendar | integration | Manual: `curl` the deployed function | N/A (Edge Function) |
| CAL-03 | Buffer time UI saves 0/15/30/45/60 to trainer_profiles | unit | `npx vitest run src/components/calendar/BufferTimeSelector.test.ts` | No -- Wave 0 |
| CAL-04 | Server rejects booking within buffer window | unit (SQL) | `supabase test db` | No -- Wave 0 |
| CAL-05 | get_visible_slots hides buffered slots | unit (SQL) | `supabase test db` | No -- Wave 0 |
| CAL-06 | Calendar settings page renders, saves | unit | `npx vitest run src/pages/TrainerCalendarSettings.test.ts` | No -- Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run && supabase test db` (if SQL tests exist)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/lib/ical.test.ts` -- covers CAL-01 (RFC 5545 generation)
- [ ] `src/components/calendar/BufferTimeSelector.test.ts` -- covers CAL-03
- [ ] SQL test for buffer enforcement in `supabase/tests/` -- covers CAL-04, CAL-05
- [ ] Vitest config -- may need explicit `vitest.config.ts` if not configured in `vite.config.ts`

## Sources

### Primary (HIGH confidence)

- Existing codebase: `20260316100000_subscription_foundation.sql` -- `get_visible_slots` RPC, `guard_subscription_tier_write` trigger pattern
- Existing codebase: `20260311143000_fitconnect_current_schema.sql` -- `lock_and_mark_slot_on_booking_insert` trigger, `availability_slots` and `bookings` schema
- Existing codebase: `src/lib/scheduling.ts` -- `classifySlot` with existing `BUFFER_WINDOW_MS` (2h for discount classification, unrelated to between-session buffer)
- Existing codebase: `supabase/functions/cancel-booking/index.ts` -- Edge Function pattern (Deno.serve, createClient, corsHeaders, auth pattern)
- `.planning/research/ARCHITECTURE.md` -- iCal subscription feed pattern, `calendar_export_token` column design, anti-pattern on public UUID URLs
- `.planning/research/STACK.md` -- `ical.js` library evaluation, Deno `npm:` import pattern

### Secondary (MEDIUM confidence)

- RFC 5545 (iCalendar specification) -- VCALENDAR, VEVENT, DTSTART/DTEND format, CRLF requirement
- Google Calendar subscription feed behavior -- 24h polling cache, `max-age` header hints

### Tertiary (LOW confidence)

- None -- all findings verified against codebase or RFC standards

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries needed; string builder for .ics, existing Supabase patterns
- Architecture: HIGH -- patterns verified against existing Edge Functions and migration patterns in codebase
- Pitfalls: HIGH -- CRLF, timezone, caching issues are well-documented RFC 5545 gotchas; buffer enforcement edge cases identified from trigger code analysis

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (stable domain -- RFC 5545 unchanged since 2009)
