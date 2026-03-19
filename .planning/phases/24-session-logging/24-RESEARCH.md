# Phase 24: Session Logging - Research

**Researched:** 2026-03-19
**Domain:** Supabase PostgreSQL schema + React component patterns (auto-save, expand/collapse, Recharts)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Expandable section on the completed booking card in TrainerBookings — no page navigation
- Plain text textarea with auto-save on blur (same pattern as ClientPassport Phase 23.1)
- Editable for 24 hours after the session, then locked
- Toast notification after marking a booking complete: "Don't forget to log session notes!" with a link to the card
- Simple: exercise name + sets x reps (no weight, RPE, or set-by-set logging)
- Freeform text input for exercise name + numeric inputs for sets/reps + "Add" button
- No predefined exercise database or categories
- No workout templates for now — each session logged fresh
- Exercises stored as JSON array in a session_logs table
- New "Progress" tab on ClientDashboard (alongside existing dashboard content)
- Timeline list of past sessions: date, trainer name, notes summary (truncated), exercise count
- Line chart (Recharts) with two lines: sessions per week AND total sets per week
- Shows training consistency and effort volume over time
- Trainers see ONLY their own notes — cannot view notes from other trainers
- Clients see ALL notes from all their trainers (full transparency)
- Clients see both the text notes AND the structured workout data (exercises, sets, reps)
- RLS enforces: trainer reads own session_logs only, client reads all their own session_logs

### Claude's Discretion
- session_logs table schema design (columns, indexes)
- Chart time range (last 4 weeks, 8 weeks, 12 weeks)
- Empty state design for clients with no sessions yet
- How truncated notes appear in the timeline list
- Toast notification timing and dismissal

### Deferred Ideas (OUT OF SCOPE)
- Rewards/Gamification system (loyalty sessions, brand partnerships, trainer ranking, trainer bonuses) — own milestone v4.1 or v5.0
- Workout templates (save exercise list for reuse) — future phase
- Exercise database with searchable preset list — future phase
- PDF/CSV export of training history — future phase
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SESSION-01 | Trainer can write post-session notes for a completed booking | Auto-save on blur pattern from ClientPassport; session_logs table; 24-hour lock via `created_at` timestamp comparison; expandable section on TrainerBookings completed card |
| SESSION-02 | Client can view session notes written by trainers | Extend MyBookings past tab to join session_logs; RLS client reads all their session_logs; read-only display in booking card |
| SESSION-03 | Trainer can log structured workout data (exercises, sets, reps) | session_logs.exercises JSONB array; freeform text + numeric inputs with Add button; immediate upsert after Add; same 24-hour lock as notes |
| SESSION-04 | Client sees a progress timeline with session history and workout trends | New Progress tab on ClientDashboard; timeline list from session_logs joined with bookings; LineChart (Recharts) for sessions/week and sets/week |
</phase_requirements>

---

## Summary

Phase 24 is entirely within the existing React + Supabase stack. No new libraries are required. The core work is: (1) a new `session_logs` table with RLS, (2) extending `TrainerBookings` to render an expandable notes + workout logger on completed bookings, (3) extending `MyBookings` to show session notes on past bookings, and (4) a new Progress tab on `ClientDashboard` with a Recharts line chart.

All four implementation areas map directly to existing patterns in the codebase. The auto-save pattern is identical to `ClientPassport.saveField()`. The expand/collapse pattern is identical to `ClientSummaryCard` with `AnimatePresence`. The chart pattern is identical to `AnalyticsTab` using `ResponsiveContainer + LineChart`. The tab pattern is identical to `TrainerDashboard`.

The most consequential design decision is the `session_logs` table schema — specifically how to structure the `exercises` JSONB column and ensure RLS correctly differentiates trainer-reads-own vs client-reads-all.

**Primary recommendation:** Build in a single migration wave (schema + RLS) followed by three UI components (SessionLogPanel for trainer, SessionNotesDisplay for client booking card, ProgressTab for ClientDashboard).

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Supabase JS | Already installed | DB read/write, RLS enforcement | Project standard |
| Recharts | Already installed | LineChart for progress visualization | Already used in AnalyticsTab |
| Framer Motion | Already installed | AnimatePresence expand/collapse | Already used in ClientSummaryCard |
| Sonner | Already installed | Toast notifications | Project standard |
| Lucide React | Already installed | Icons | Project standard |

### No New Dependencies
This phase requires zero new npm installs. All libraries are already in the project.

---

## Architecture Patterns

### Recommended New Files
```
src/
├── components/
│   ├── session/
│   │   ├── SessionLogPanel.tsx       # Trainer-facing: notes textarea + workout logger
│   │   └── SessionNotesDisplay.tsx   # Client-facing: read-only notes + exercise list
│   └── client/
│       └── ProgressTab.tsx           # Client progress timeline + Recharts line chart
supabase/
└── migrations/
    └── 20260319300000_session_logs.sql  # New table + RLS
```

### Pattern 1: Auto-Save on Blur (from ClientPassport)
**What:** Upsert to Supabase on `onBlur`, toast with deduplication ID, no submit button.
**When to use:** session notes textarea — same as bio field in ClientPassport.
**Example (existing):**
```typescript
// Source: src/pages/ClientPassport.tsx
const saveField = async (updates: Record<string, unknown>) => {
  if (!user) return;
  const { error } = await (supabase as any)
    .from('client_profiles')
    .upsert({ user_id: user.id, ...updates }, { onConflict: 'user_id' });
  if (!error) toast.success('Saved', { duration: 1200, id: 'profile-save' });
  else toast.error('Save failed');
};
// Usage: onBlur={() => saveField({ bio: bio.trim() || null })}
```
For session_logs, the equivalent is upsert on `booking_id` conflict.

### Pattern 2: Expand/Collapse with AnimatePresence (from ClientSummaryCard)
**What:** Local `expanded` boolean state, AnimatePresence wraps a `motion.div` with `height: 0 → auto`.
**When to use:** The session log expandable section on the booking card.
**Example (existing):**
```typescript
// Source: src/components/client/ClientSummaryCard.tsx
const [expanded, setExpanded] = useState(false);
// ...
<AnimatePresence>
  {expanded && (
    <motion.div
      key="expanded"
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="overflow-hidden"
    >
      {/* content */}
    </motion.div>
  )}
</AnimatePresence>
```

### Pattern 3: LineChart with Two Lines (Recharts, new for this phase)
**What:** `LineChart` with two `<Line>` elements sharing one XAxis (week label). Use `ResponsiveContainer`. Minimal styling matching AnalyticsTab conventions.
**When to use:** sessions/week + sets/week on the Progress tab.
**Example (adapted from AnalyticsTab conventions):**
```typescript
// Source: src/components/trainer/AnalyticsTab.tsx (AreaChart → LineChart adaptation)
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const chartColors = {
  sessions: '#2d2d2d',   // ink
  sets: '#a0a0a0',       // muted
  grid: 'rgba(0,0,0,0.05)',
};

<ResponsiveContainer width="100%" height={220}>
  <LineChart data={weeklyData}>
    <CartesianGrid stroke={chartColors.grid} vertical={false} />
    <XAxis dataKey="week" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
    <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
    <Tooltip />
    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 9 }} />
    <Line type="monotone" dataKey="sessions" stroke={chartColors.sessions} strokeWidth={1.5} dot={false} name="Sessions / week" />
    <Line type="monotone" dataKey="sets" stroke={chartColors.sets} strokeWidth={1.5} dot={false} name="Sets / week" />
  </LineChart>
</ResponsiveContainer>
```

### Pattern 4: Tab Extension on ClientDashboard
**What:** Add a tab row to ClientDashboard with local `activeTab` state. The existing page has no tabs, so the tab row is new, matching the style from TrainerBookings/AnalyticsTab.
**When to use:** Adding the "Progress" tab alongside the existing dashboard content (which becomes the "Overview" tab).

### Pattern 5: Secondary Query Pattern (from TrainerBookings)
**What:** Fetch main data first, then a secondary query to join session_logs, build a map, and merge. Avoids the `(supabase as any)` type error on new tables by using the same cast convention.
**When to use:** Loading session log data alongside bookings without regenerating TS types mid-phase.
**Key note from STATE.md:** Use `(supabase as any)` cast for new tables — project convention is to NOT regenerate Supabase TS types mid-phase.

### Anti-Patterns to Avoid
- **Separate page for session logging:** Locked decision requires in-card expansion, no navigation.
- **Blocking toast:** The "don't forget" nudge must be dismissable — it must not block the mark-complete action.
- **Client writing to session_logs:** RLS INSERT policy must be trainer-only. Clients are read-only.
- **Showing other trainers' data to trainers:** Trainer SELECT policy must filter by `trainer_id = (SELECT id FROM trainer_profiles WHERE user_id = auth.uid())`.
- **Regenerating Supabase TS types mid-phase:** Project convention — use `(supabase as any)` cast instead.

---

## Recommended session_logs Schema

```sql
-- Migration: 20260319300000_session_logs.sql
CREATE TABLE public.session_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  trainer_id  uuid NOT NULL REFERENCES trainer_profiles(id) ON DELETE CASCADE,
  client_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  notes       text,
  exercises   jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id)  -- one log per booking
);

-- Exercise array item shape (enforced by app, not DB constraint):
-- { name: string, sets: number, reps: number }

ALTER TABLE public.session_logs ENABLE ROW LEVEL SECURITY;

-- Trainer: can INSERT and UPDATE their own logs
CREATE POLICY "Trainer can manage their session logs"
  ON public.session_logs
  FOR ALL
  USING (
    trainer_id IN (
      SELECT id FROM public.trainer_profiles WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    trainer_id IN (
      SELECT id FROM public.trainer_profiles WHERE user_id = auth.uid()
    )
  );

-- Client: can SELECT all logs for their own bookings (read-only, all trainers)
CREATE POLICY "Client can read their session logs"
  ON public.session_logs
  FOR SELECT
  USING (client_id = auth.uid());

-- Index for common queries
CREATE INDEX idx_session_logs_booking ON public.session_logs(booking_id);
CREATE INDEX idx_session_logs_client  ON public.session_logs(client_id);
CREATE INDEX idx_session_logs_trainer ON public.session_logs(trainer_id);
```

**Schema decisions (Claude's Discretion):**
- `UNIQUE (booking_id)` — one log per booking; upsert on conflict is the right save pattern
- `trainer_id` and `client_id` are denormalized alongside `booking_id` to enable efficient RLS without joins in every query
- `exercises` as JSONB array — simple, no FK complexity, matches the "no exercise database" decision
- No `locked_at` column needed — lock is computed: `created_at < now() - interval '24 hours'` (or use `booking.availability_slots.start_time + 24h` for precision)

**24-hour lock logic:** The editable window should be 24 hours after the *session end time* (not the log's `created_at`), so a trainer who logs immediately still has 24 hours. The UI computes `isLocked = new Date(slot.end_time).getTime() + 24*60*60*1000 < Date.now()`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Expand/collapse animation | CSS height transition or custom hook | Framer Motion AnimatePresence (already in app) | Height-to-auto is notoriously broken with CSS transitions; Framer Motion handles it correctly |
| Toast deduplication | Custom dedup flag | Sonner `id` option on `toast.success()` | Already used in ClientPassport — `id: 'session-save'` prevents toast spam on rapid blurs |
| Chart data aggregation by week | Custom bucketing logic | Simple `reduce()` with ISO week key | Week bucketing is straightforward with `date-fns` or even raw `Date` math; no charting library helper needed |
| Auto-save debounce | setTimeout-based debounce | onBlur trigger (project pattern) | Project has standardized on blur-not-debounce; simpler, no race conditions |

---

## Common Pitfalls

### Pitfall 1: Height-to-auto animation with overflow-hidden
**What goes wrong:** Setting `overflow-hidden` on the animated div clips content before animation completes.
**Why it happens:** CSS can't animate to `height: auto`.
**How to avoid:** Use `className="overflow-hidden"` on the Framer Motion `motion.div` itself — Framer Motion sets `overflow: visible` at the end of the animation automatically when using `height: 'auto'` target.
**Reference:** This is the exact pattern in ClientSummaryCard which works correctly.

### Pitfall 2: RLS policy allows client to INSERT
**What goes wrong:** If the client policy is `FOR ALL` instead of `FOR SELECT`, clients could write fake session data.
**How to avoid:** Client RLS policy must be `FOR SELECT` only. Trainer policy handles INSERT/UPDATE/DELETE.

### Pitfall 3: 24-hour lock based on wrong timestamp
**What goes wrong:** Computing lock from `session_logs.created_at` means a trainer who logs 23 hours after the session only has 1 hour to edit.
**How to avoid:** Lock based on `availability_slots.end_time + 24 hours`. The UI already has `booking.availability_slots.end_time` available in TrainerBookings state.
**Code:** `const isLocked = booking.availability_slots?.end_time ? new Date(booking.availability_slots.end_time).getTime() + 86400000 < Date.now() : false;`

### Pitfall 4: Toast after marking complete fires before state update
**What goes wrong:** The toast nudge fires but the booking card hasn't re-rendered as "completed" yet, so the link in the toast scrolls to the wrong card.
**How to avoid:** Fire the nudge toast inside the `updateStatus` success branch after `setBookings` state update. Since the link just scrolls to the card's DOM id, this is fine as long as the id is stable.

### Pitfall 5: Recharts LineChart with zero data
**What goes wrong:** An empty `data` array causes Recharts to render a blank chart with no error, which looks broken.
**How to avoid:** Show the empty state component (not the chart) when `weeklyData.length === 0`. This is the same pattern used in AnalyticsTab: the metrics null check shows a "No bookings in this period" message.

### Pitfall 6: JSONB exercises array type safety
**What goes wrong:** TypeScript has no type for the JSONB column; `(supabase as any)` returns `unknown` for exercises.
**How to avoid:** Define a local `ExerciseEntry = { name: string; sets: number; reps: number }` type and cast: `(log.exercises as ExerciseEntry[]) ?? []`.

### Pitfall 7: Booking card is in "history" tab but notes expansion state is lost on tab switch
**What goes wrong:** If `expanded` state lives in the booking map rendered inside TrainerBookings, switching tabs destroys and re-mounts the cards, collapsing expanded logs.
**How to avoid:** Track expanded state as `Map<bookingId, boolean>` at the TrainerBookings level (or use a `Set<string>`), not inside a per-card component. This is a minor UX issue but worth knowing.

---

## Code Examples

### Session log upsert (trainer notes save)
```typescript
// Pattern: adapt from ClientPassport.saveField()
const saveSessionNotes = async (bookingId: string, notes: string) => {
  const { error } = await (supabase as any)
    .from('session_logs')
    .upsert(
      {
        booking_id: bookingId,
        trainer_id: trainerProfile.id,
        client_id: booking.profiles.id,  // from booking data already loaded
        notes: notes.trim() || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'booking_id' }
    );
  if (!error) toast.success('Notes saved', { duration: 1200, id: 'session-notes-save' });
  else toast.error('Save failed');
};
```

### Exercise add (append to JSONB array)
```typescript
// Client-side append then full upsert — simpler than Postgres jsonb_insert for this scale
const addExercise = async (bookingId: string, currentExercises: ExerciseEntry[], newEntry: ExerciseEntry) => {
  const updated = [...currentExercises, newEntry];
  const { error } = await (supabase as any)
    .from('session_logs')
    .upsert(
      {
        booking_id: bookingId,
        trainer_id: trainerProfile.id,
        client_id: booking.profiles.id,
        exercises: updated,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'booking_id' }
    );
  if (!error) setLocalExercises(updated);
  else toast.error('Failed to add exercise');
};
```

### Weekly aggregation for Progress tab
```typescript
// Compute sessions/week and sets/week from session_logs array
type WeeklyPoint = { week: string; sessions: number; sets: number };

function aggregateByWeek(logs: SessionLogWithSlot[]): WeeklyPoint[] {
  const map = new Map<string, WeeklyPoint>();
  for (const log of logs) {
    const d = new Date(log.slot_start);
    // ISO week key: YYYY-WXX
    const year = d.getFullYear();
    const week = getISOWeek(d);  // simple implementation below
    const key = `${year}-W${String(week).padStart(2, '0')}`;
    const existing = map.get(key) ?? { week: key, sessions: 0, sets: 0 };
    const totalSets = (log.exercises as ExerciseEntry[]).reduce((acc, e) => acc + e.sets, 0);
    map.set(key, { ...existing, sessions: existing.sessions + 1, sets: existing.sets + totalSets });
  }
  return Array.from(map.values()).sort((a, b) => a.week.localeCompare(b.week));
}

// Simple ISO week number (no external dependency)
function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
```

### Toast nudge after marking complete (in TrainerBookings updateStatus)
```typescript
// Add inside the existing updateStatus success branch, after setBookings update
if (status === 'completed') {
  toast('Don\'t forget to log session notes!', {
    duration: 6000,
    action: {
      label: 'Log now',
      onClick: () => {
        // expand the card — set expandedLogs to include bookingId
        setExpandedLogs(prev => new Set(prev).add(bookingId));
        document.getElementById(`booking-${bookingId}`)?.scrollIntoView({ behavior: 'smooth' });
      },
    },
  });
}
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Separate "session notes" page | In-card expandable section | Zero page navigation; trainer stays in context |
| Submit button for saves | Auto-save on blur | No "did I save?" anxiety; matches ClientPassport UX |
| Area/Bar chart for progress | Line chart with two lines | Shows trend over time more clearly than snapshots |

---

## Open Questions

1. **Chart time range default**
   - What we know: Claude's Discretion — no locked decision
   - Recommendation: Default to **8 weeks** (shows meaningful trend without overwhelming sparse data; 4 weeks is too short for new clients, 12 weeks too long for default view). Add no UI toggle for MVP — just show last 8 weeks always.

2. **Notes truncation in Progress tab timeline**
   - What we know: Claude's Discretion — "truncated" but no length specified
   - Recommendation: Truncate at 120 characters with "..." using a simple `notes.slice(0, 120) + (notes.length > 120 ? '...' : '')`.

3. **Empty state for Progress tab with no sessions**
   - Recommendation: Simple dashed border card with serif italic "No sessions logged yet" and a link to Browse Trainers — matching the empty state pattern in MyBookings.

4. **Booking id in DOM for scroll-to**
   - Confirmed: `id={`booking-${booking.id}`}` on the booking card div. Not currently present in TrainerBookings. Needs to be added.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.0 |
| Config file | `vite.config.ts` — `test: { globals: true, environment: 'jsdom' }` |
| Quick run command | `npx vitest run src/components/session/ src/components/client/ProgressTab.tsx` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SESSION-01 | Trainer notes textarea is editable when within 24h window | unit | `npx vitest run src/components/session/SessionLogPanel.test.tsx` | Wave 0 |
| SESSION-01 | Trainer notes textarea is disabled/locked after 24h | unit | `npx vitest run src/components/session/SessionLogPanel.test.tsx` | Wave 0 |
| SESSION-03 | addExercise appends entry to local exercises array | unit | `npx vitest run src/components/session/SessionLogPanel.test.tsx` | Wave 0 |
| SESSION-04 | aggregateByWeek correctly buckets sessions and sums sets | unit | `npx vitest run src/lib/sessionAggregation.test.ts` | Wave 0 |
| SESSION-04 | Progress tab shows empty state when logs array is empty | unit | `npx vitest run src/components/client/ProgressTab.test.tsx` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/components/session/ src/components/client/ProgressTab.tsx`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/components/session/SessionLogPanel.test.tsx` — covers SESSION-01 (lock logic) and SESSION-03 (add exercise)
- [ ] `src/lib/sessionAggregation.test.ts` — covers SESSION-04 (weekly bucketing pure function)
- [ ] `src/components/client/ProgressTab.test.tsx` — covers SESSION-04 (empty state render)

*(SessionNotesDisplay is read-only display logic with no branching worth unit testing separately — covered by the integration of the above.)*

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection: `src/pages/ClientPassport.tsx` — auto-save on blur pattern
- Direct code inspection: `src/components/client/ClientSummaryCard.tsx` — AnimatePresence expand/collapse pattern
- Direct code inspection: `src/components/trainer/AnalyticsTab.tsx` — Recharts ResponsiveContainer + chart conventions
- Direct code inspection: `src/pages/TrainerBookings.tsx` — booking card structure, `(supabase as any)` cast convention, updateStatus flow
- Direct code inspection: `src/pages/MyBookings.tsx` — client booking card structure, secondary query pattern
- Direct code inspection: `supabase/migrations/20260319000000_availability_toggle.sql` — RLS policy pattern, SECURITY DEFINER convention
- Direct code inspection: `supabase/migrations/20260319200000_client_profile_enhancement.sql` — migration style, JSONB column pattern
- Direct code inspection: `.planning/phases/24-session-logging/24-CONTEXT.md` — locked decisions

### Secondary (MEDIUM confidence)
- Recharts LineChart API: standard two-line pattern verified against existing AreaChart usage in AnalyticsTab (same import set, same ResponsiveContainer wrapper)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and in use; no new dependencies
- Architecture: HIGH — all patterns traced to existing working code in the same codebase
- DB schema: HIGH — follows exact migration conventions from Phases 22 and 23.1
- Pitfalls: HIGH — identified from actual code patterns already in use (ClientSummaryCard, ClientPassport)
- Chart specifics: MEDIUM — LineChart adapted from existing AreaChart pattern; same import structure, slightly different component

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable stack, 30-day window)
