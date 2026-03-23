# Phase 38: Client Workout Log & Exercise Diagrams - Research

**Researched:** 2026-03-23
**Domain:** Workout logging UI, Supabase JSONB data model, static exercise illustrations, client/trainer read access
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Exercise Illustrations
- Static SVG exercise illustrations bundled in the app (no external API)
- Library of 40-60 common exercises covering major muscle groups
- Each exercise has a key (e.g., "bench_press", "squat", "deadlift") mapped to an SVG illustration
- Illustrations are clean line-art style matching FitRush editorial aesthetic
- Fallback: generic muscle group icon when no specific illustration exists

#### Log Entry UX
- Post-session quick-add form accessible from completed booking and standalone from client dashboard
- Exercise selection from predefined searchable list with "Add custom exercise" option
- Per exercise: multiple sets, each set has reps and weight (lbs/kg toggle)
- Quick-add pattern: tap exercise, enter sets inline, save
- Optional session notes field (free text)
- Mobile-first input design, minimal taps

#### Trainer View
- Read-only summary of client's recent workout logs
- Visible on: booking detail page (before/during session) and client's Fitness Passport
- Shows last 5 sessions grouped by date with trainer name
- Each session expandable to show exercises, sets, reps, weight
- Trainer sees this automatically when viewing a client's upcoming booking

#### Data Model
- `workout_logs` table: id, client_id, booking_id (nullable for standalone logs), logged_at, notes, created_at
- `workout_exercises` table: id, log_id, exercise_name, exercise_key (for illustration lookup), sort_order, sets (JSONB array of {reps: number, weight: number, unit: 'lbs'|'kg'})
- RLS: client can CRUD own logs, trainer can SELECT logs for their booked clients
- Client dashboard shows workout history with pagination

### Claude's Discretion
- Exact SVG illustration style and sourcing approach
- Exercise list curation (which 40-60 exercises to include)
- Animation on log entry (Framer Motion transitions)
- Pagination approach for workout history
- How to handle unit conversion (lbs/kg)

### Deferred Ideas (OUT OF SCOPE)
- AI-powered workout suggestions based on log history
- Trainer can create workout plans and assign to clients
- Progress charts (weight progression over time per exercise)
- Social sharing of workout achievements
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| LOG-01 | Client can log a workout session (exercises, sets, reps, weight) from client dashboard or post-booking | New `workout_logs` + `workout_exercises` tables; WorkoutTab in ClientDashboard; WorkoutLogForm component |
| LOG-02 | Exercise selection from predefined searchable list with Add Custom option | exerciseList.ts constant file; combobox/search-filter pattern; custom fallback path |
| LOG-03 | Each exercise entry supports multiple sets with reps and weight (lbs/kg toggle) | JSONB sets array per exercise_entry row; unit toggle state stored in component; conversion utility |
| LOG-04 | Exercise illustrations display for recognized exercises; generic muscle-group icon fallback | SVG assets in `public/assets/exercises/`; key-to-file map; InlineExerciseDiagram component |
| LOG-05 | Workout logs persist across trainers -- trainer sees client's last 5 sessions on booking detail and Fitness Passport | RLS SELECT policy for trainers; ClientWorkoutSummary component reused in TrainerBookings + ClientPassport |
| LOG-06 | Client dashboard shows paginated workout history with expandable sessions | WorkoutTab in ClientDashboard; cursor-based or offset pagination; AnimatePresence accordion |
</phase_requirements>

---

## Summary

Phase 38 adds a client-owned workout log system on top of an existing session logging foundation from Phase 24. The key distinction: Phase 24 built `session_logs` for *trainer* post-session notes (trainer CRUD, client read-only). Phase 38 builds `workout_logs` + `workout_exercises` for *client* self-logging (client CRUD, trainer read-only). These are separate tables serving distinct purposes and should not be merged.

The exercise illustration decision (static SVGs bundled in `public/assets/exercises/`) is locked. The best source for base illustrations is the **free-exercise-db** public domain dataset (Unlicense), which provides 800+ exercises with JPG images and a full JSON index. Since the decision specifies SVGs with a specific line-art aesthetic, the workflow is: use free-exercise-db as the exercise name/key catalog, then create or trace 40-60 clean SVG line-art files matching the FitRush editorial style. The JPGs from free-exercise-db serve as reference. This is entirely offline/static -- no API calls at runtime.

The trainer view integrates cleanly into two existing surfaces: `TrainerBookings.tsx` (already has the booking detail expansion pattern and `SessionLogPanel`) and `ClientPassport.tsx` (already shows client fitness data). A new shared `ClientWorkoutSummary` component handles both insertion points.

**Primary recommendation:** Build in 3 plans -- (1) DB migration + exercise data constants, (2) client workout log UI in ClientDashboard, (3) trainer read-only view in TrainerBookings and ClientPassport.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | ^2.99.0 | DB queries, RLS enforcement | Already in project |
| framer-motion | ^12.35.2 | Accordion expand/collapse, form transitions | Already used throughout |
| lucide-react | ^0.555.0 | Dumbbell, Weight, ChevronDown icons | Already used throughout |
| sonner | ^2.0.7 | Success/error toast feedback | Already used throughout |
| zod | ^4.3.6 | Input validation for workout log form | Already used for all form schemas |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | ^4.1.0 | Unit tests for pure utility functions | exerciseList, unit conversion, JSONB helpers |
| @testing-library/react | ^16.3.2 | Component render tests | WorkoutLogForm, ClientWorkoutSummary |

### No New Dependencies Required
All needed libraries are already installed. No new npm installs for this phase.

**Exercise data source:** [yuhonas/free-exercise-db](https://github.com/yuhonas/free-exercise-db) (public domain, Unlicense). Use its JSON catalog (`dist/exercises.json`) to pick the 40-60 exercise names and keys. Images from that repo are JPGs; hand-trace as SVG line-art for the FitRush aesthetic.

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   ├── client/
│   │   ├── WorkoutTab.tsx           # Full workout history + "Log Workout" CTA for client dashboard
│   │   └── WorkoutLogForm.tsx       # Inline quick-add form (exercise search, sets entry, save)
│   └── shared/
│       ├── ClientWorkoutSummary.tsx  # Read-only last-5-sessions; used in TrainerBookings + ClientPassport
│       └── ExerciseDiagram.tsx       # SVG illustration lookup with muscle-group fallback
├── lib/
│   ├── exerciseList.ts              # Curated 40-60 exercises with key, name, muscleGroup
│   └── workoutUtils.ts             # lbs/kg conversion, set formatting helpers
├── types/
│   └── workout.ts                  # WorkoutLog, WorkoutExercise, SetEntry interfaces
public/
└── assets/
    └── exercises/                   # SVG files: bench_press.svg, squat.svg, etc.
        └── _fallback/
            ├── chest.svg
            ├── back.svg
            ├── legs.svg
            ├── shoulders.svg
            ├── arms.svg
            └── core.svg
supabase/
└── migrations/
    └── 20260323_workout_logs.sql    # workout_logs + workout_exercises tables + RLS
```

### Pattern 1: JSONB Sets Array per Exercise Row
**What:** Each row in `workout_exercises` stores sets as a JSONB array `[{reps: 10, weight: 135, unit: 'lbs'}, ...]` rather than a normalized third table. This matches how the existing `session_logs.exercises` column works (also JSONB).

**When to use:** When set count varies per exercise, ordered, and never queried individually (only read/written as a whole).

**Example:**
```typescript
// src/types/workout.ts
export interface SetEntry {
  reps: number;
  weight: number;
  unit: 'lbs' | 'kg';
}

export interface WorkoutExerciseRow {
  id: string;
  log_id: string;
  exercise_name: string;
  exercise_key: string | null;  // null for custom exercises
  sort_order: number;
  sets: SetEntry[];
}

export interface WorkoutLogRow {
  id: string;
  client_id: string;
  booking_id: string | null;
  logged_at: string;
  notes: string | null;
  created_at: string;
}
```

### Pattern 2: `(supabase as any)` for Untyped Tables
**What:** New tables (`workout_logs`, `workout_exercises`) are not in the generated TypeScript types. Use `(supabase as any)` with a local interface cast. This is the established project pattern.

**Example:**
```typescript
// Matches existing pattern in ClientPassport.tsx, SessionLogPanel.tsx
const { data } = await (supabase as any)
  .from('workout_logs')
  .select('id, logged_at, notes, workout_exercises(*)')
  .eq('client_id', userId)
  .order('logged_at', { ascending: false })
  .limit(5) as unknown as { data: WorkoutLogRow[] | null };
```

### Pattern 3: Exercise List Constant (No API)
**What:** A static TypeScript array exported from `src/lib/exerciseList.ts` with the curated 40-60 exercises. Client-side search via `.filter()` on name. No runtime fetching.

**Example:**
```typescript
// src/lib/exerciseList.ts
export interface ExerciseDefinition {
  key: string;         // 'bench_press' -- matches SVG filename
  name: string;        // 'Barbell Bench Press'
  muscleGroup: 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'core';
}

export const EXERCISES: ExerciseDefinition[] = [
  { key: 'bench_press',     name: 'Barbell Bench Press',  muscleGroup: 'chest' },
  { key: 'squat',           name: 'Back Squat',           muscleGroup: 'legs' },
  { key: 'deadlift',        name: 'Conventional Deadlift',muscleGroup: 'back' },
  { key: 'overhead_press',  name: 'Overhead Press',       muscleGroup: 'shoulders' },
  { key: 'pull_up',         name: 'Pull-Up',              muscleGroup: 'back' },
  // ... 35-55 more
];

// Search helper
export function searchExercises(query: string): ExerciseDefinition[] {
  if (!query.trim()) return EXERCISES;
  const q = query.toLowerCase();
  return EXERCISES.filter(e => e.name.toLowerCase().includes(q));
}
```

### Pattern 4: ExerciseDiagram Component
**What:** Renders the SVG for a known `exercise_key`; falls back to muscle-group SVG for custom exercises.

**Example:**
```typescript
// src/components/shared/ExerciseDiagram.tsx
interface ExerciseDiagramProps {
  exerciseKey: string | null;
  muscleGroup?: string;
  size?: number;
  className?: string;
}

const ExerciseDiagram: React.FC<ExerciseDiagramProps> = ({
  exerciseKey, muscleGroup = 'core', size = 48, className
}) => {
  const src = exerciseKey
    ? `/assets/exercises/${exerciseKey}.svg`
    : `/assets/exercises/_fallback/${muscleGroup}.svg`;

  return (
    <img
      src={src}
      width={size}
      height={size}
      className={className}
      alt=""
      aria-hidden="true"
      onError={(e) => {
        // If specific SVG missing, fall back to muscle group
        const target = e.currentTarget;
        if (!target.src.includes('_fallback')) {
          target.src = `/assets/exercises/_fallback/${muscleGroup}.svg`;
        }
      }}
    />
  );
};
```

### Pattern 5: Unit Conversion (lbs/kg Toggle)
**What:** Store in the unit the user entered (preserve original input). Display with optional conversion. The toggle is a UI state; conversion is view-only math.

**Example:**
```typescript
// src/lib/workoutUtils.ts
export function convertWeight(weight: number, from: 'lbs' | 'kg', to: 'lbs' | 'kg'): number {
  if (from === to) return weight;
  return from === 'lbs'
    ? Math.round(weight * 0.453592 * 10) / 10   // lbs -> kg, 1 decimal
    : Math.round(weight * 2.20462);               // kg -> lbs, integer
}

export function formatSet(set: SetEntry): string {
  return `${set.reps} reps @ ${set.weight}${set.unit}`;
}
```

### Pattern 6: Trainer RLS Using Booking Relationship
**What:** Trainer can SELECT workout logs only for clients they have a booking with. Uses a subquery against the `bookings` table.

**Example (SQL):**
```sql
-- Trainer can read workout logs for clients they have booked
CREATE POLICY "Trainer can read workout logs for their clients"
  ON public.workout_logs
  FOR SELECT
  USING (
    client_id IN (
      SELECT b.client_id
      FROM public.bookings b
      JOIN public.trainer_profiles tp ON tp.id = b.trainer_id
      WHERE tp.user_id = auth.uid()
    )
  );
```

### Pattern 7: ClientDashboard Tab Extension
**What:** Add 'workouts' to the `TabId` union type and the TABS array. Render `<WorkoutTab userId={user.id} />` in the tab body block.

**Example:**
```typescript
// In ClientDashboard.tsx
type TabId = 'overview' | 'profile' | 'progress' | 'workouts' | 'alerts' | 'settings' | 'support';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'profile', label: 'Fitness Profile' },
  { id: 'workouts', label: 'Workouts' },   // NEW
  { id: 'settings', label: 'Settings', icon: <User size={11} /> },
  { id: 'progress', label: 'Progress' },
  { id: 'alerts', label: 'Alerts', icon: <Bell size={11} /> },
  { id: 'support', label: 'Support', icon: <LifeBuoy size={11} /> },
];
```

### Anti-Patterns to Avoid
- **Normalizing sets into a third table:** Three-table join for a simple log read is over-engineered. JSONB sets array per exercise row is the right pattern (matches existing `session_logs.exercises`).
- **External API for exercise images at runtime:** Locked decision. All assets must be static/bundled.
- **Modifying `session_logs`:** That table is trainer-owned (trainer writes, client reads). Do not add client-side fields to it. Use separate `workout_logs` table.
- **Storing unit preference only in the set:** Consider also persisting a per-log preferred unit for display, or accept that each set stores its own unit. The latter is simpler and already specified.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Exercise name/data catalog | Custom scraper or external API | `exerciseList.ts` constant derived from free-exercise-db JSON | No runtime dependency, no API key, public domain |
| Accordion expand/collapse animation | CSS max-height hack | `framer-motion AnimatePresence + motion.div height: 'auto'` | Already used in SessionNotesDisplay; handles 0->auto cleanly |
| Toast feedback on save | Custom modal or banner | `sonner` toast | Already wired app-wide |
| Form input validation | Ad hoc if statements | `zod` schema for `WorkoutLogFormData` | Consistent with all other forms in the project |
| SVG fallback on broken image | JS error catching DIY | `onError` on `<img>` tag (Pattern 4 above) | Simple, native, zero-dependency |

**Key insight:** The exercise data problem is a catalog management problem, not a data fetching problem. A static TypeScript constant is faster, more reliable, and simpler than any API integration for 40-60 exercises.

---

## Common Pitfalls

### Pitfall 1: Confusing workout_logs with session_logs
**What goes wrong:** Developer writes client workout data into `session_logs` or expects `workout_logs` entries to appear in the ProgressTab (which reads `session_logs`).
**Why it happens:** Both involve exercises and sessions. Phase 24 already exists.
**How to avoid:** Clearly distinguish: `session_logs` = trainer-written post-session notes (linked to booking, has trainer_id). `workout_logs` = client-written standalone log (booking_id nullable, no trainer_id). Document this in code comments.
**Warning signs:** ProgressTab chart shows unexpected new entries, or SessionLogPanel tries to read workout_logs.

### Pitfall 2: RLS policy for trainer access missing the join path
**What goes wrong:** Trainer cannot see client workout logs on booking detail because the RLS SELECT policy is wrong or missing.
**Why it happens:** The `workout_logs` table has `client_id` but no direct `trainer_id` column. The join goes through `bookings` -> `trainer_profiles` -> `auth.uid()`.
**How to avoid:** Test the exact RLS subquery pattern in Supabase SQL editor before writing the migration. See Pattern 6.
**Warning signs:** Empty array returned for trainer even when client has logs.

### Pitfall 3: SVG file not found causes broken image flash
**What goes wrong:** A newly added exercise key has no matching SVG yet, causing a broken image before the `onError` fallback fires.
**Why it happens:** The SVG files must be created before they are referenced.
**How to avoid:** Implement `onError` fallback as shown in Pattern 4. Treat all exercises without a matching SVG as "custom" until their SVG is added. This is graceful degradation.
**Warning signs:** Brief broken-image flicker before fallback renders.

### Pitfall 4: JSONB sets array type mismatch
**What goes wrong:** Sets data saved as `[{reps: "10", weight: "135"}]` (strings from form input) instead of `[{reps: 10, weight: 135}]` (numbers).
**Why it happens:** HTML input values are always strings. Forgetting to `parseInt` / `parseFloat` before inserting.
**How to avoid:** Validate with a Zod schema before upsert. The schema should coerce or require numbers.
**Warning signs:** `NaN` displayed in set summaries, type errors in `formatSet()`.

### Pitfall 5: Pagination approach incompatible with real-time updates
**What goes wrong:** Offset pagination (`limit X offset Y`) shows duplicate entries if new logs are added between pages.
**Why it happens:** New rows shift offsets.
**How to avoid:** Use cursor-based pagination with `logged_at` timestamp as cursor (`lt` / `gt` filter). For 5-item trainer preview, no pagination needed -- just `limit(5) order('logged_at', { ascending: false })`.
**Warning signs:** Duplicate log entries when paginating to older records.

### Pitfall 6: Tab label/icon overflow on mobile
**What goes wrong:** Adding "Workouts" as a new tab causes the ClientDashboard tab row to overflow or wrap awkwardly on small screens.
**Why it happens:** There are already 6 tabs; adding a 7th exceeds the safe width at 375px.
**How to avoid:** Check the current tab overflow behavior (`overflow-x-auto` or `flex-wrap`). The existing pattern uses `overflow-x-auto` horizontal scroll. The new tab fits in horizontal scroll -- no layout changes needed.
**Warning signs:** Tab bar wraps to two rows on mobile preview.

---

## Code Examples

Verified patterns from existing codebase:

### Supabase upsert with onConflict (from SessionLogPanel.tsx)
```typescript
// Source: src/components/session/SessionLogPanel.tsx (existing pattern)
const { error } = await (supabase as any)
  .from('session_logs')
  .upsert(
    {
      booking_id: bookingId,
      trainer_id: trainerId,
      client_id: clientId,
      notes: notes.trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'booking_id' }
  );
```

### AnimatePresence accordion (from SessionNotesDisplay.tsx)
```typescript
// Source: src/components/session/SessionNotesDisplay.tsx (existing pattern)
<AnimatePresence>
  {expanded && (
    <motion.div
      key="session-notes"
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

### useCallback + useEffect fetch hook (from useAvailability.ts)
```typescript
// Source: src/hooks/useAvailability.ts (existing pattern)
const fetchData = useCallback(async () => {
  if (!userId) return;
  setLoading(true);
  const { data } = await (supabase as any)
    .from('workout_logs')
    .select('id, logged_at, notes, workout_exercises(id, exercise_name, exercise_key, sort_order, sets)')
    .eq('client_id', userId)
    .order('logged_at', { ascending: false })
    .limit(20) as unknown as { data: WorkoutLogRow[] | null };
  setLogs(data ?? []);
  setLoading(false);
}, [userId]);

useEffect(() => { fetchData(); }, [fetchData]);
```

### Exercise search filter (pure function, testable)
```typescript
// src/lib/exerciseList.ts
export function searchExercises(query: string, exercises = EXERCISES): ExerciseDefinition[] {
  if (!query.trim()) return exercises;
  const q = query.toLowerCase();
  return exercises.filter(e => e.name.toLowerCase().includes(q));
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Trainer writes post-session notes (Phase 24) | Client writes own workout log (Phase 38) | Phase 38 | Separate tables; different RLS ownership model |
| ExerciseEntry: `{name, sets, reps}` (Phase 24, no weight) | SetEntry: `{reps, weight, unit}` per set in JSONB array | Phase 38 | Richer data; weight and unit captured per set |
| No exercise illustrations | Static SVG line-art per exercise key | Phase 38 | Visual exercise identification without external API |

**Deprecated/outdated:**
- Phase 24 `ExerciseEntry` shape `{name: string, sets: number, reps: number}` is for trainer session notes (aggregate). Phase 38 uses a richer per-set shape with weight. These coexist in separate tables.

---

## Open Questions

1. **SVG Creation Workflow**
   - What we know: Decision is locked to static SVGs in `public/assets/exercises/`. The free-exercise-db provides JPG references and exercise names/keys.
   - What's unclear: How the SVG files get created. Options: (a) use an AI image-to-vector tool to trace the JPGs, (b) source pre-existing line-art SVGs from a compatible license (Creative Commons), (c) have a designer draw them.
   - Recommendation: For Wave 0 of this phase, create 10-15 SVGs for the most common exercises (squat, deadlift, bench press, overhead press, pull-up, row, lunge, plank, push-up, curl, tricep pushdown, hip hinge). The `onError` fallback covers the rest. Add more SVGs incrementally.

2. **Cursor Pagination vs Offset for Workout History**
   - What we know: Client dashboard needs paginated workout history. The CONTEXT says "pagination approach" is Claude's discretion.
   - What's unclear: Whether clients will have enough logs for pagination to matter in v1.
   - Recommendation: Implement simple offset pagination (load 10 logs, "Load More" button adds 10 more). A single `useState(page)` + `range()` query is sufficient. Cursor pagination is over-engineering for this feature scope.

3. **Standalone Log vs Booking-Linked Log Entry Point**
   - What we know: booking_id is nullable for standalone logs.
   - What's unclear: Whether there should be a "Log Workout from booking" deep link from MyBookings.tsx after a session completes.
   - Recommendation: The WorkoutLogForm accepts an optional `bookingId` prop. When rendered from ClientDashboard Workouts tab with no booking context, `bookingId` is undefined. When linked from a completed booking card in MyBookings, pass the bookingId. This does not require changes to the booking flow itself -- just a link to the dashboard workouts tab with a query param.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.0 |
| Config file | `Cenlar demand gt 1-17/vite.config.ts` (inline `test` block) |
| Quick run command | `cd "Cenlar demand gt 1-17" && npx vitest run --reporter=verbose` |
| Full suite command | `cd "Cenlar demand gt 1-17" && npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LOG-01 | workout_logs insert/fetch roundtrip | unit (pure utils) | `npx vitest run src/lib/workoutUtils.test.ts` | Wave 0 |
| LOG-02 | searchExercises filters by name substring | unit | `npx vitest run src/lib/exerciseList.test.ts` | Wave 0 |
| LOG-03 | convertWeight(135, 'lbs', 'kg') == 61.2 | unit | `npx vitest run src/lib/workoutUtils.test.ts` | Wave 0 |
| LOG-04 | ExerciseDiagram renders img with correct src | component | `npx vitest run src/components/shared/ExerciseDiagram.test.tsx` | Wave 0 |
| LOG-05 | Trainer RLS subquery -- manual Supabase SQL test | manual-only | n/a -- RLS tested via Supabase dashboard SQL editor | n/a |
| LOG-06 | WorkoutTab renders log list with no crashes | component smoke | `npx vitest run src/components/client/WorkoutTab.test.tsx` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/lib/workoutUtils.test.ts src/lib/exerciseList.test.ts`
- **Per wave merge:** `npx vitest run` (full suite)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/workoutUtils.test.ts` -- covers LOG-01, LOG-03 (convertWeight, formatSet)
- [ ] `src/lib/exerciseList.test.ts` -- covers LOG-02 (searchExercises pure function)
- [ ] `src/components/shared/ExerciseDiagram.test.tsx` -- covers LOG-04 (src attribute, onError fallback)
- [ ] `src/components/client/WorkoutTab.test.tsx` -- covers LOG-06 (smoke render with empty logs)

---

## Sources

### Primary (HIGH confidence)
- Direct read of `src/pages/ClientDashboard.tsx` -- tab system, TabId union, fetch pattern confirmed
- Direct read of `src/pages/ClientPassport.tsx` -- existing fitness data display pattern confirmed
- Direct read of `src/pages/TrainerBookings.tsx` -- booking detail expansion, SessionLogPanel import confirmed
- Direct read of `src/components/session/SessionLogPanel.tsx` -- upsert pattern, exercise entry shape confirmed
- Direct read of `src/components/session/SessionNotesDisplay.tsx` -- AnimatePresence accordion confirmed
- Direct read of `src/hooks/useAvailability.ts` -- useCallback+useEffect fetch pattern confirmed
- Direct read of `src/lib/sessionAggregation.ts` -- ExerciseEntry type, JSONB array pattern confirmed
- Direct read of `src/types/session.ts` -- existing ExerciseEntry interface confirmed
- Direct read of `supabase/migrations/20260319300000_session_logs.sql` -- existing session_logs schema, RLS patterns confirmed
- Direct read of `vite.config.ts` -- Vitest config (globals: true, environment: jsdom) confirmed
- Direct read of `package.json` -- all dependencies confirmed, no test script alias (run via `npx vitest run`)

### Secondary (MEDIUM confidence)
- [yuhonas/free-exercise-db](https://github.com/yuhonas/free-exercise-db) -- public domain (Unlicense) exercise dataset, 800+ exercises, JSON index confirmed via WebFetch
- [ExerciseDB API](https://github.com/ExerciseDB/exercisedb-api) -- evaluated but not used (locked decision: no external API)

### Tertiary (LOW confidence)
- wger project API -- evaluated for exercise image assets, not chosen (AGPL license, external dependency)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in project, versions confirmed from package.json
- Architecture: HIGH -- patterns derived directly from existing codebase
- Data model: HIGH -- confirmed no existing workout_logs/workout_exercises tables; session_logs schema provides migration template
- Exercise illustrations: MEDIUM -- SVG creation workflow is Claude's discretion; free-exercise-db license confirmed but SVG conversion process is an open question
- Pitfalls: HIGH -- confirmed from reading existing code patterns and RLS policies

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (stable stack, no fast-moving dependencies)
