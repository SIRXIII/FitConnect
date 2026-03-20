# Phase 26: AI Discount Analytics - Research

**Researched:** 2026-03-19
**Domain:** Slot utilization analytics, heatmap visualization, deterministic discount recommendations
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Heatmap:** Day/hour grid (7 days x visible hours), green-to-red color intensity, last 4 weeks of booking data, clickable cells, integrated as sub-section within existing AnalyticsTab (not a separate tab)
- **Discount cards:** Card format "5 idle Tuesday 9am slots in last 4 weeks — try 20-30% off", top 3-5 worst-performing time blocks, each card has "Set Discount" CTA, deterministic fill-rate algorithm, sorted by idle count worst first
- **Optimization score:** Single 0-100 number, formula `(booked / total available) * 100` over last 4 weeks, color: green 80%+, amber 50-79%, red below 50%, updates on tab focus

### Claude's Discretion
- Exact heatmap cell sizing and spacing
- Whether to use an existing Recharts heatmap or custom grid component
- Recommendation card layout details
- Score gauge implementation (SVG ring reuse from ProfileProgressRing or plain number)
- How to handle trainers with fewer than 2 weeks of data (show partial or "Not enough data" message)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AIANALYTICS-01 | Trainer sees idle slot pattern analysis as a day/hour heatmap | New `get_trainer_idle_heatmap` RPC reading `availability_slots` + `bookings`; custom CSS grid component (Recharts has no built-in heatmap); renders in AnalyticsTab Optimization section |
| AIANALYTICS-02 | Trainer receives actionable discount recommendation cards for empty slots | Pure-TS `computeDiscountRecommendations()` function grouping idle slot counts by (day_of_week, hour) from the same RPC data; renders 3-5 sorted cards with "Set Discount" CTA to TrainerDashboard discount settings |
| AIANALYTICS-03 | Trainer sees an optimization score based on slot utilization | `get_trainer_slot_utilization` RPC returning `(booked_count, total_count)`; score = Math.round(booked/total * 100); SVG ring gauge adapted from ProfileProgressRing |
</phase_requirements>

## Summary

Phase 26 adds an "Optimization" section inside the existing `AnalyticsTab` component. All three requirements are purely frontend + Postgres RPC — no new tables, no edge functions, no new npm packages. The section shows: (1) a day/hour heatmap of idle slot patterns, (2) discount recommendation cards for the worst time blocks, and (3) a circular optimization score gauge.

The key architectural finding is that **the data source is `availability_slots`, not `bookings` alone**. The existing `get_trainer_peak_hours` RPC counts *booked* slots by time block; what's needed for idle analysis is the *total* created slots minus booked ones per time block. This requires a new RPC (`get_trainer_idle_heatmap`) that joins `availability_slots LEFT JOIN bookings` to separately return total vs booked counts per day/hour. The optimization score also needs its own RPC returning aggregate counts over a fixed 4-week window (independent of the existing time range selector).

The existing `AnalyticsTab` already has a custom CSS grid heatmap implementation (Section D) — this is the correct pattern to extend. Recharts has no built-in heatmap primitive; the project has correctly avoided third-party heatmap libraries in favor of inline CSS grid with `rgba` opacity fills. The new "idle heatmap" uses the same approach but with red-family color intensity instead of dark ink opacity.

**Primary recommendation:** Two new Postgres RPCs (idle heatmap + utilization score), one new pure-TS lib function (`computeDiscountRecommendations`), one new `OptimizationSection` component added below the existing peak-hours heatmap in `AnalyticsTab`.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React + TypeScript | 19 / 5.x | Component authoring | Already in project |
| Supabase JS | ^2.99.0 | RPC calls for heatmap + utilization data | Already in project |
| Framer Motion | ^12.35.2 | Section reveal animation (matches existing patterns) | Already in project |
| Lucide React | ^0.555.0 | Icons on recommendation cards | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest | ^4.1.0 | Unit tests for `computeDiscountRecommendations` pure function | Test scoring logic in isolation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom CSS grid heatmap | Recharts custom component | Recharts has no heatmap primitive; custom grid is simpler and already established in codebase |
| SVG ring gauge (reuse ProfileProgressRing) | Simple large number + color text | Ring is more visually polished; ProfileProgressRing pattern already proven in project |
| New Postgres RPCs | Client-side aggregation from raw slot data | RPC keeps heavy date/group-by logic off the frontend; consistent with existing analytics patterns |

**No new packages required.**

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   └── slotOptimization.ts        # Pure: computeDiscountRecommendations(), idle heatmap transforms
│   └── slotOptimization.test.ts   # Vitest unit tests
├── components/
│   └── trainer/
│       ├── AnalyticsTab.tsx       # Extended: add OptimizationSection below Section D
│       └── OptimizationSection.tsx  # New: contains heatmap + cards + score gauge
supabase/
└── migrations/
    └── 20260319500000_slot_optimization_rpcs.sql  # New: 2 RPCs
```

### Pattern 1: New RPCs — Idle Heatmap and Utilization Score

The existing `get_trainer_peak_hours` only counts *booked* slots. Phase 26 needs *created-but-not-booked* counts. Two new functions:

**`get_trainer_idle_heatmap`** — Returns day/hour grid with total slots and booked count. The idle count is computed client-side: `idle = total - booked`. Uses `availability_slots` as the left table, filtered to the trainer's own slots in the last 4 weeks.

**`get_trainer_slot_utilization`** — Returns a single `{ booked_count: number, total_count: number }` object. Used by the score gauge. Fixed 4-week window, independent of the existing time range selector.

Both functions use SECURITY INVOKER (same as `get_trainer_peak_hours`) with a `trainer_id` WHERE clause for implicit scoping — matching the established project pattern.

```sql
-- Source: supabase/migrations/20260319500000_slot_optimization_rpcs.sql (new)

CREATE OR REPLACE FUNCTION public.get_trainer_idle_heatmap(
  p_trainer_id uuid,
  p_start      timestamptz,
  p_end        timestamptz
)
RETURNS TABLE(day_of_week int, hour int, total_count bigint, booked_count bigint)
LANGUAGE sql
SECURITY INVOKER
AS $$
  SELECT
    EXTRACT(DOW  FROM s.start_time)::int   AS day_of_week,
    EXTRACT(HOUR FROM s.start_time)::int   AS hour,
    COUNT(*)                               AS total_count,
    COUNT(b.id)                            AS booked_count
  FROM public.availability_slots s
  LEFT JOIN public.bookings b
    ON b.slot_id = s.id
    AND b.status IN ('confirmed', 'completed')
  WHERE s.trainer_id = p_trainer_id
    AND s.start_time BETWEEN p_start AND p_end
    AND s.deleted_at IS NULL
  GROUP BY day_of_week, hour
  ORDER BY day_of_week, hour;
$$;

CREATE OR REPLACE FUNCTION public.get_trainer_slot_utilization(
  p_trainer_id uuid,
  p_start      timestamptz,
  p_end        timestamptz
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
AS $$
  SELECT jsonb_build_object(
    'total_count',  COUNT(*),
    'booked_count', COUNT(b.id)
  )
  FROM public.availability_slots s
  LEFT JOIN public.bookings b
    ON b.slot_id = s.id
    AND b.status IN ('confirmed', 'completed')
  WHERE s.trainer_id = p_trainer_id
    AND s.start_time BETWEEN p_start AND p_end
    AND s.deleted_at IS NULL;
$$;
```

### Pattern 2: Idle Heatmap CSS Grid

The existing peak-hours heatmap in `AnalyticsTab` Section D uses an inline CSS grid with `rgba(45,45,45,intensity)` opacity. The idle heatmap inverts the logic: **intensity = idle proportion**, and uses red-family color to signal underutilization. This avoids any new library dependency.

```typescript
// Source: adapted from existing AnalyticsTab.tsx Section D pattern

// idle intensity: how empty is this cell?
const idleIntensity = totalCount > 0 ? (totalCount - bookedCount) / totalCount : 0;

// Color: red at full idle, transparent at full booked
backgroundColor: `rgba(220, 80, 60, ${(idleIntensity * 0.8).toFixed(2)})`
```

Cells with zero total slots (no availability ever scheduled) render as a subtle neutral background (`rgba(0,0,0,0.03)`) to distinguish "no data" from "100% idle".

### Pattern 3: Discount Recommendation Computation (Pure TS)

A pure function in `src/lib/slotOptimization.ts` consumes the RPC output and returns the top N worst-performing time blocks. This keeps business logic testable in isolation — matching the project's established pattern for `matchScoring.ts`.

```typescript
// Source: project pattern — see src/lib/matchScoring.ts for reference

export interface IdleHeatmapRow {
  day_of_week: number; // 0-6 (Sun-Sat)
  hour: number;        // 0-23
  total_count: number;
  booked_count: number;
}

export interface DiscountRecommendation {
  day_of_week: number;
  hour: number;
  idle_count: number;
  fill_rate_pct: number;  // 0-100
  suggested_discount_min: number; // e.g. 20
  suggested_discount_max: number; // e.g. 30
}

export function computeDiscountRecommendations(
  rows: IdleHeatmapRow[],
  topN = 5
): DiscountRecommendation[] {
  return rows
    .filter(r => r.total_count > 0)
    .map(r => {
      const idle = r.total_count - r.booked_count;
      const fillRate = Math.round((r.booked_count / r.total_count) * 100);
      // Discount scale: low fill rate → higher suggested discount
      const discountMin = fillRate < 20 ? 25 : fillRate < 50 ? 20 : 10;
      const discountMax = discountMin + 10;
      return { day_of_week: r.day_of_week, hour: r.hour, idle_count: idle, fill_rate_pct: fillRate, suggested_discount_min: discountMin, suggested_discount_max: discountMax };
    })
    .filter(r => r.idle_count > 0)
    .sort((a, b) => b.idle_count - a.idle_count)
    .slice(0, topN);
}
```

### Pattern 4: Optimization Score Gauge (SVG Ring Reuse)

`ProfileProgressRing.tsx` already implements a clean SVG ring with animated `strokeDashoffset`. The score gauge for Phase 26 is a simplified variant: accepts a 0-100 score, no "missing fields" label, color-coded stroke based on score tier.

```typescript
// Reuse: CIRCUMFERENCE = 2 * Math.PI * 36 (~226.2) from ProfileProgressRing.tsx
// Color logic:
const strokeColor = score >= 80 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';
// Green (80+), Amber (50-79), Red (<50)
```

### Pattern 5: "Set Discount" CTA Routing

The CONTEXT.md specifies the CTA links to the trainer's rate/discount settings. In `TrainerDashboard.tsx`, the discount slider lives in the `overview` tab (rendered as `DiscountSlider` at the top of the overview section). The CTA should navigate by setting URL search params, not by routing away from the page:

```typescript
// Navigate to overview tab where DiscountSlider lives
// TrainerDashboard reads: const tabParam = searchParams.get('tab');
const [, setSearchParams] = useSearchParams();
const handleSetDiscount = () => setSearchParams({ tab: 'overview' });
```

### Anti-Patterns to Avoid
- **Rendering OptimizationSection inside the existing useEffect fetch:** Add a separate `useEffect` with `visibilitychange` listener for tab-focus refetch — don't couple it to the time range selector which controls a different 4-week-fixed window
- **Computing idle counts in SQL as `total - booked`:** Return both columns from the RPC and let the frontend do the subtraction — simpler SQL and more flexible for future display logic
- **Using Recharts for the heatmap:** Recharts has no heatmap type; custom CSS grid (already in use) is the right approach
- **Fetching slot data through the existing `get_trainer_analytics` RPC:** That RPC scopes to `bookings` only (completed status); slot utilization needs ALL slots including unbooked ones

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Heatmap component | Third-party heatmap lib | CSS grid with `rgba` opacity | Already established in codebase; no new dependency needed |
| Score ring | Build new SVG gauge from scratch | Adapt ProfileProgressRing | Pattern already proven; only needs color logic change |
| Date bounds for 4-week window | New date utility | `getDateBounds('month')` from `analytics.ts` | Existing utility returns correct ISO bounds |

**Key insight:** All three features are data-transformation + display problems. The "AI" label is marketing; the logic is deterministic fill-rate math, not ML. Zero new dependencies are needed.

## Common Pitfalls

### Pitfall 1: Conflating the Time Range Selector with the 4-Week Window
**What goes wrong:** The existing time range selector (week/month/quarter/year) drives the earnings charts. If the Optimization section respects the same selector, the score and recommendations become inconsistent with CONTEXT.md's "last 4 weeks" requirement.
**Why it happens:** The `range` state and `getDateBounds(range)` call is already in scope — easy to pass down.
**How to avoid:** Compute the 4-week window independently inside `OptimizationSection` using a fixed `getDateBounds('month')` call. Do NOT wire `OptimizationSection` to the `range` state.
**Warning signs:** Score number changes when user switches time range tabs.

### Pitfall 2: `availability_slots.deleted_at` Filter Missing
**What goes wrong:** Soft-deleted slots (from Phase 13 `availability_soft_delete` migration) are still in the table with `deleted_at IS NOT NULL`. Counting them inflates total_count, deflating the score.
**Why it happens:** The schema has soft deletes; forgetting the filter is easy.
**How to avoid:** Always include `AND s.deleted_at IS NULL` in the RPCs.
**Warning signs:** Score is unexpectedly low for trainers with deleted slots.

### Pitfall 3: Booking Status Scope in LEFT JOIN
**What goes wrong:** Including `cancelled` or `no_show` bookings in the booked_count inflates utilization score.
**Why it happens:** The `bookings.status` column has 5 values: pending, confirmed, completed, cancelled, no_show. A bare LEFT JOIN without status filter counts all.
**How to avoid:** Filter `b.status IN ('confirmed', 'completed')` in the LEFT JOIN ON clause (not WHERE, which would turn it into an inner join).
**Warning signs:** Score is higher than expected; cancelled sessions count as filled.

### Pitfall 4: Zero Slots Edge Case
**What goes wrong:** Trainer has never created any availability slots — `total_count = 0`, score formula divides by zero.
**Why it happens:** New trainers or inactive trainers.
**How to avoid:** Guard `total_count > 0` before computing score; show "Not enough data" below 2 weeks of slot history.
**Warning signs:** NaN or Infinity score in the gauge.

### Pitfall 5: Supabase TypeScript Cast
**What goes wrong:** `(supabase as any).rpc('get_trainer_idle_heatmap', ...)` needed for the two new RPCs since project does NOT regenerate Supabase TS types mid-phase.
**Why it happens:** Established project convention (see STATE.md: "project convention not to regenerate TS types mid-phase").
**How to avoid:** Use `(supabase as any).rpc(...)` and cast the return type explicitly to the local TypeScript interface.
**Warning signs:** TypeScript errors on `.rpc()` calls for the new function names.

### Pitfall 6: "Set Discount" CTA Not Working
**What goes wrong:** CTA opens a new page or does nothing if linked incorrectly.
**Why it happens:** `DiscountSlider` lives in the `overview` tab of `TrainerDashboard`, not a separate route. The tabs are controlled by `?tab=` search param.
**How to avoid:** Use `setSearchParams({ tab: 'overview' })` from `react-router-dom`'s `useSearchParams` to programmatically switch tabs.

## Code Examples

### 4-Week Fixed Date Bounds
```typescript
// Source: existing analytics.ts getDateBounds utility
import { getDateBounds } from '@/lib/analytics';

// Inside OptimizationSection — independent of the time range selector
const FOUR_WEEKS = getDateBounds('month'); // start: 1 month ago, end: now
```

### RPC Call Pattern with (supabase as any) Cast
```typescript
// Source: established project convention (STATE.md Phase 24 notes)
const { data, error } = await (supabase as any).rpc('get_trainer_idle_heatmap', {
  p_trainer_id: trainerProfile.id,
  p_start: FOUR_WEEKS.start,
  p_end: FOUR_WEEKS.end,
}) as { data: IdleHeatmapRow[] | null; error: unknown };
```

### Score Color Logic
```typescript
// Source: CONTEXT.md locked decisions
const scoreColor =
  score >= 80 ? 'text-green-500' :
  score >= 50 ? 'text-amber-500' :
  'text-red-500';
```

### Heatmap Cell Render (Red Idle Intensity)
```typescript
// Source: adapted from existing AnalyticsTab.tsx Section D
const idleCell = (day: number, hour: number) => {
  const row = idleData.find(r => r.day_of_week === day && r.hour === hour);
  if (!row || row.total_count === 0) return { bg: 'rgba(0,0,0,0.03)', title: 'No slots' };
  const idle = row.total_count - row.booked_count;
  const intensity = idle / row.total_count;
  return {
    bg: `rgba(220,80,60,${(intensity * 0.85).toFixed(2)})`,
    title: `${DAYS[day]} ${hour}:00 — ${idle} idle / ${row.total_count} total`,
  };
};
```

### Tab Focus Refetch Pattern
```typescript
// Re-fetch optimization data when trainer returns to analytics tab
useEffect(() => {
  const handleFocus = () => fetchOptimizationData();
  document.addEventListener('visibilitychange', handleFocus);
  return () => document.removeEventListener('visibilitychange', handleFocus);
}, [trainerProfile?.id]);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| React 18 patterns | React 19 (concurrent) | v4.0 | No behavioral change for this feature |
| Recharts v2 | Recharts v3.5.1 | Current | API stable; no impact |

**Deprecated/outdated:**
- None relevant to this phase

## Open Questions

1. **Hour range in heatmap (0-23 vs 6am-10pm subset)**
   - What we know: CONTEXT.md says "7 days x 24 hours or reasonable subset like 6am-10pm"
   - What's unclear: Whether to default to 24h or trim for fitness context
   - Recommendation: Default to 6am-10pm (hours 6-22) — fitness trainers almost never schedule at 2am; eliminates visual noise in empty early-morning columns. Configurable in the component constant.

2. **Minimum data threshold**
   - What we know: CONTEXT.md says show partial or "Not enough data" — Claude's discretion
   - Recommendation: Show "Not enough data" message when `total_count < 10` slots total in the 4-week window. Below this threshold the percentage is statistically meaningless.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | vite.config.ts (`test: { globals: true, environment: 'jsdom' }`) |
| Quick run command | `npx vitest run src/lib/slotOptimization.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AIANALYTICS-01 | Idle heatmap renders cells with correct red intensity | unit | `npx vitest run src/lib/slotOptimization.test.ts` | ❌ Wave 0 |
| AIANALYTICS-02 | `computeDiscountRecommendations` sorts by idle count, returns top N, computes correct discount range | unit | `npx vitest run src/lib/slotOptimization.test.ts` | ❌ Wave 0 |
| AIANALYTICS-03 | Score = `Math.round(booked/total * 100)`; guards divide-by-zero; returns 0 when total=0 | unit | `npx vitest run src/lib/slotOptimization.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/lib/slotOptimization.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/slotOptimization.ts` — pure functions: `computeDiscountRecommendations`, `computeOptimizationScore`, `buildIdleCellMap`
- [ ] `src/lib/slotOptimization.test.ts` — covers AIANALYTICS-01, 02, 03 scoring logic
- [ ] `supabase/migrations/20260319500000_slot_optimization_rpcs.sql` — new RPCs

## Sources

### Primary (HIGH confidence)
- Direct code inspection of `src/components/trainer/AnalyticsTab.tsx` — existing heatmap pattern, chart colors, fetch lifecycle
- Direct code inspection of `src/lib/analytics.ts` — `getDateBounds`, `TimeRange` utilities
- Direct code inspection of `src/components/client/ProfileProgressRing.tsx` — SVG ring gauge pattern
- Direct code inspection of `supabase/migrations/20260315000000_analytics_rpc.sql` — existing RPC conventions (SECURITY INVOKER, grant patterns)
- Direct code inspection of `supabase/migrations/20260311143000_fitconnect_current_schema.sql` — `availability_slots` schema (columns: trainer_id, start_time, end_time, is_booked, deleted_at)
- Direct code inspection of `supabase/migrations/20260313100001_availability_soft_delete.sql` (filename inferred from listing) — soft delete column confirmed
- Direct code inspection of `src/lib/matchScoring.ts` / `matchScoring.test.ts` — pure-TS lib + Vitest test pattern (Phase 25 precedent)
- `.planning/phases/26-ai-discount-analytics/26-CONTEXT.md` — all locked decisions

### Secondary (MEDIUM confidence)
- STATE.md project decisions — confirmed `(supabase as any)` cast convention for new RPCs mid-phase
- `vite.config.ts` — confirmed Vitest config location and test environment settings

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in project; no new installs
- Architecture: HIGH — directly verified against existing code patterns in AnalyticsTab, ProfileProgressRing, matchScoring
- Pitfalls: HIGH — all derived from direct inspection of schema migrations and established project conventions
- RPCs: HIGH — modeled on `get_trainer_peak_hours` which is an exact structural precedent

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable domain, no fast-moving dependencies)
