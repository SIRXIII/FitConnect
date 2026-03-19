# Phase 25: AI Trainer-Client Matching - Research

**Researched:** 2026-03-19
**Domain:** Deterministic matching algorithm, client/trainer data schema, UI carousel integration
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Primary factor: Price compatibility** — trainer's rate falls within client's preferred budget range
- **Secondary factor: Goals + specialty alignment** — client's ranked fitness goals match trainer's specialty and workout types
- **Location proximity is NOT a scoring factor** — kept as a separate filter
- Score displayed as **both percentage + label**: "87% — Great Match"
  - Tiers: Great Match (80%+), Good Match (60-79%), Fair Match (40-59%)
- Deterministic scoring (not ML) — weighted formula combining price fit and goals alignment
- **Horizontal carousel above search results** — 3-5 recommended cards above the regular grid/map
- Show **top 3** best matches only
- Carousel always visible when passport meets completeness threshold
- Each card shows: trainer photo, name, specialty, rate, match % + label, 2-3 explanation bullets
- Threshold: **3 key fields filled** — fitness level + at least 1 goal + preferred workout type
- Below threshold: **inline card where carousel would be** — "Complete your Fitness Passport to get matched" with CTA
- No partial recommendations below threshold — either full carousel or prompt card
- Explanations must reference real data: "Matches your HIIT goals", "Within your $50-80 range"
- **2-3 top reasons** per trainer card (highest-scoring factors only)
- Match results cached for 24 hours

### Claude's Discretion
- Exact scoring weights (price vs goals proportion)
- Cache implementation (Supabase table vs in-memory)
- Carousel card sizing and scroll behavior
- How to handle ties in match score
- Empty state when fewer than 3 trainers match above threshold

### Deferred Ideas (OUT OF SCOPE)
- Collaborative filtering ("Clients like you also booked") — needs 6+ months booking data
- ML model training — no training data yet
- Match score on trainer profile page — future enhancement
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AIMATCH-01 | Client sees "Recommended for You" trainers based on Fitness Passport data | Scoring function reads `client_profiles` fields; needs new `hourly_budget_max` field + Supabase RPC |
| AIMATCH-02 | Match score displays with 2-3 attribute explanation | Explanation builder function maps scoring factors to display strings using real data values |
| AIMATCH-03 | Client prompted to complete Fitness Passport if data below matching threshold | Completeness check: `fitness_level` + `goals_ranked.length >= 1` + `workout_types.length >= 1` |
| AIMATCH-04 | Match results cached for 24 hours | `match_cache` Supabase table with `client_id`, `results` JSONB, `cached_at`; RPC or hook checks staleness |
</phase_requirements>

## Summary

Phase 25 builds a deterministic trainer recommendation carousel shown above the existing `SearchSection` grid. The system reads a client's Fitness Passport (stored in `client_profiles`) and scores every active trainer against two weighted criteria: price compatibility and goals/specialty alignment. The top 3 scores are surfaced as styled cards with a percentage badge and 2-3 plain-English explanation bullets.

The most important architectural finding is that **`client_profiles` currently has no budget/price preference field**. Since price compatibility is the PRIMARY scoring factor, this phase must add an `hourly_budget_max` column (integer, nullable) to `client_profiles` via a new migration, add a corresponding UI field in `ClientPassport.tsx`, and seed it before any match score can be computed. Without this field, price scoring degrades to a neutral fallback, which defeats the intent of the feature.

A secondary finding: `trainer_profiles` stores a single `specialty` string (e.g., `strength_training`), not an array of `workout_types`. Goal alignment therefore maps the client's `goals_ranked` and `workout_types` arrays against the trainer's single `specialty` value using a lookup table. This is an imprecise but practical approach given the current DB schema — no migration to `trainer_profiles` is needed.

**Primary recommendation:** Add `hourly_budget_max` to `client_profiles`, build a `useMatchedTrainers` hook with client-side scoring + 24hr local cache (localStorage or Supabase table), insert a `RecommendedCarousel` component above the existing results block in `SearchSection`.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React + TypeScript | 19 / 5.x | Component and hook authoring | Already in project |
| Zustand | current | Access `useAuthStore` for `user.id` and `profile` | Already in project |
| Supabase JS | current | Read `client_profiles`, `trainer_profiles`; write cache | Already in project |
| Framer Motion | current | Carousel reveal animation (matches existing patterns) | Already in project |
| Lucide React | current | Icons in recommendation cards | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest | current | Unit tests for scoring function | Test pure logic, no DOM required |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Client-side scoring | Supabase RPC (Postgres function) | RPC centralizes logic but requires Postgres migration + harder to test. Client-side is faster to iterate and correct for this data volume. |
| Supabase table cache | localStorage | Table persists across devices; localStorage is simpler and sufficient for a single-client cache. Either works — see Open Questions. |

**Installation:** No new packages required.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── hooks/
│   └── useMatchedTrainers.ts    # Fetches trainers + client profile, runs scoring, caches
├── lib/
│   └── matchScoring.ts          # Pure scoring function + explanation builder (unit-testable)
├── components/
│   └── recommendations/
│       ├── RecommendedCarousel.tsx     # Wrapper: gate check → carousel or prompt card
│       ├── RecommendedTrainerCard.tsx  # Individual card: photo, name, score badge, bullets
│       └── PassportPromptCard.tsx      # Inline CTA when passport incomplete
└── pages/
    └── ClientPassport.tsx        # Add hourly_budget_max field (already the edit page)
```

### Pattern 1: Pure Scoring Function
**What:** All scoring math lives in `matchScoring.ts` as a pure function, fully testable without mocks.
**When to use:** Any time business logic needs to be unit-tested independently of React.
**Example:**
```typescript
// src/lib/matchScoring.ts
export interface ClientMatchInput {
  hourly_budget_max: number | null;   // NEW field — may be null if not set
  goals_ranked: string[];              // e.g. ["weight_loss", "hiit"]
  workout_types: string[];             // e.g. ["hiit", "strength_training"]
  fitness_level: string | null;
}

export interface TrainerMatchInput {
  id: string;
  optimized_rate: number;              // effective rate (post-discount if applicable)
  specialty: string;                   // single value: 'strength_training', 'cardio_hiit', etc.
  profiles: { full_name: string; avatar_url: string | null };
}

export interface MatchResult {
  trainer: TrainerMatchInput;
  score: number;          // 0-100
  label: string;          // "Great Match" | "Good Match" | "Fair Match"
  reasons: string[];      // ["Matches your HIIT goals", "Within your $50-80 range"]
}

export function scoreTrainer(
  client: ClientMatchInput,
  trainer: TrainerMatchInput
): MatchResult {
  // Price score (primary, 60 points max)
  let priceScore = 0;
  let priceReason: string | null = null;
  if (client.hourly_budget_max !== null) {
    if (trainer.optimized_rate <= client.hourly_budget_max) {
      priceScore = 60;
      priceReason = `Within your $${client.hourly_budget_max}/hr budget`;
    } else {
      // Partial credit for close-but-over
      const overage = (trainer.optimized_rate - client.hourly_budget_max) / client.hourly_budget_max;
      priceScore = Math.max(0, Math.round(60 * (1 - overage)));
    }
  } else {
    priceScore = 30; // neutral when no budget set
  }

  // Goals + specialty score (secondary, 40 points max)
  let goalScore = 0;
  let goalReason: string | null = null;
  const specialtyToWorkoutTypes: Record<string, string[]> = {
    strength_training: ['strength_training'],
    cardio_hiit: ['cardio', 'hiit'],
    yoga_pilates: ['yoga', 'pilates'],
    nutrition_coaching: ['general_fitness', 'weight_loss'],
    injury_rehabilitation: ['rehabilitation'],
  };
  const trainerWorkouts = specialtyToWorkoutTypes[trainer.specialty] ?? [];
  const clientGoals = [...client.goals_ranked, ...client.workout_types];
  const matches = trainerWorkouts.filter(w => clientGoals.includes(w));
  if (matches.length > 0) {
    goalScore = Math.min(40, matches.length * 20);
    const label = matches[0].replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    goalReason = `Matches your ${label} goals`;
  }

  const raw = priceScore + goalScore;
  const score = Math.min(100, raw);
  const label = score >= 80 ? 'Great Match' : score >= 60 ? 'Good Match' : 'Fair Match';

  const reasons: string[] = [];
  if (priceReason) reasons.push(priceReason);
  if (goalReason) reasons.push(goalReason);

  return { trainer, score, label, reasons };
}

export function rankAndFilter(
  client: ClientMatchInput,
  trainers: TrainerMatchInput[],
  topN = 3
): MatchResult[] {
  return trainers
    .map(t => scoreTrainer(client, t))
    .filter(r => r.score >= 40)           // Floor: don't show terrible matches
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}
```

### Pattern 2: useMatchedTrainers Hook
**What:** Custom hook that reads client profile + trainers, runs scoring, applies 24hr cache.
**When to use:** The hook is consumed only by `RecommendedCarousel`.
**Example:**
```typescript
// src/hooks/useMatchedTrainers.ts
// Source: project pattern from useTrainers.ts and useWorkoutLocations.ts

const CACHE_KEY = (userId: string) => `match_cache_${userId}`;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export function useMatchedTrainers() {
  const { user } = useAuthStore();
  const [results, setResults] = useState<MatchResult[]>([]);
  const [passportReady, setPassportReady] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    const run = async () => {
      // 1. Check localStorage cache
      const cached = localStorage.getItem(CACHE_KEY(user.id));
      if (cached) {
        const { data, ts } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL_MS) {
          setResults(data);
          setPassportReady(true);
          setLoading(false);
          return;
        }
      }

      // 2. Fetch client profile
      const { data: cp } = await (supabase as any)
        .from('client_profiles')
        .select('fitness_level, goals_ranked, workout_types, hourly_budget_max')
        .eq('user_id', user.id)
        .single();

      // 3. Completeness gate
      const ready = !!(cp?.fitness_level && cp?.goals_ranked?.length && cp?.workout_types?.length);
      setPassportReady(ready);
      if (!ready) { setLoading(false); return; }

      // 4. Fetch all trainers (reuse trainer_profiles query)
      const { data: trainers } = await supabase
        .from('trainer_profiles')
        .select('id, optimized_rate, specialty, profiles!trainer_profiles_user_id_fkey(full_name, avatar_url)');

      // 5. Score and cache
      const ranked = rankAndFilter(cp, trainers ?? []);
      localStorage.setItem(CACHE_KEY(user.id), JSON.stringify({ data: ranked, ts: Date.now() }));
      setResults(ranked);
      setLoading(false);
    };

    run();
  }, [user]);

  return { results, passportReady, loading };
}
```

### Pattern 3: Carousel with Snap Scrolling
**What:** Horizontal scroll with `overflow-x-auto snap-x snap-mandatory` — same structural pattern as project conventions.
**When to use:** Mobile-first horizontal card list.
**Example:**
```typescript
// src/components/recommendations/RecommendedCarousel.tsx
<div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 -mx-6 px-6">
  {results.map(r => (
    <RecommendedTrainerCard key={r.trainer.id} result={r} />
  ))}
</div>
```

### Pattern 4: SearchSection Insertion Point
**What:** Insert `<RecommendedCarousel />` above the `<AnimatePresence>` results block in `SearchSection.tsx`. Only show in list view.
**When to use:** Carousel is not relevant in map view.
**Example:**
```typescript
// In SearchSection.tsx — after search bar block, before AnimatePresence
{viewMode === 'list' && <RecommendedCarousel />}
```

### Anti-Patterns to Avoid
- **Scoring inside the component:** Never put the scoring math inside React render — it must live in `matchScoring.ts` (pure, testable).
- **Fetching trainers separately in carousel hook:** Reuse the same `trainer_profiles` query shape already in `useTrainers.ts` to avoid a second full-table scan.
- **Blocking SearchSection load:** The carousel must render independently with its own loading state — do NOT block the main search results.
- **Cache invalidation on every render:** Only invalidate cache when the client explicitly updates their passport (add a `bust` flag on save) or after 24hr TTL.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Carousel snap scrolling | Custom drag handler | CSS `overflow-x-auto snap-x snap-mandatory` | Native browser behavior, zero JS |
| Score display badge | Custom % display component | Inline styled `<span>` | Trivial markup, no library needed |
| Budget range UI | Custom range slider | Simple number input or 3-button pill (same pattern as LEVELS/FREQUENCIES in ClientPassport) | Matches existing UI system |
| Animation | Custom transition | Framer Motion `motion.div` (already installed) | Consistent with rest of app |

**Key insight:** This phase's complexity is entirely in the scoring logic and schema gap — not the UI. The UI should be treated as assembled from existing patterns.

## Common Pitfalls

### Pitfall 1: No Budget Field in client_profiles
**What goes wrong:** The primary scoring factor (price compatibility) cannot be computed without a client budget preference. The feature silently degrades or must use a proxy.
**Why it happens:** `client_profiles` was designed for fitness data, not price data. The budget field was never added.
**How to avoid:** Add `hourly_budget_max integer` column via migration in Wave 1. Add a UI picker in `ClientPassport.tsx` alongside the other preference fields. Until a client sets this, price score defaults to 30/60 (neutral).
**Warning signs:** If scoring function receives `hourly_budget_max: null` for all clients — the feature is working but the primary factor is inert.

### Pitfall 2: trainer_profiles Has No workout_types Array
**What goes wrong:** Goals alignment scoring cannot directly compare `client.workout_types` to `trainer.workout_types` because trainer profiles store only a single `specialty` value.
**Why it happens:** Trainer onboarding was simplified to a single specialty dropdown. No `workout_types` array exists on `trainer_profiles`.
**How to avoid:** Use the `specialtyToWorkoutTypes` lookup table (see Pattern 1 above) to expand trainer specialty to a set of comparable workout type strings. This is approximate but sufficient.
**Warning signs:** If `goalScore` is always 0 — the specialty-to-workout-type mapping is wrong or the client workout_types values don't match the map keys.

### Pitfall 3: supabase as any Cast for client_profiles
**What goes wrong:** TypeScript errors on `client_profiles` query because the table is not in the generated `supabase.ts` types file.
**Why it happens:** Project convention is NOT to regenerate Supabase TS types mid-phase (established in multiple prior phases).
**How to avoid:** Use `(supabase as any)` for all `client_profiles` queries, consistent with Phase 23.1 and Phase 24 conventions. Document the cast in a comment.
**Warning signs:** TypeScript error on `.from('client_profiles')` — expected, use the cast.

### Pitfall 4: Carousel Blocking Main Search
**What goes wrong:** If `useMatchedTrainers` is slow (network latency), the entire `SearchSection` hangs while waiting for match results.
**Why it happens:** Fetching client profile + all trainers is a second parallel network request.
**How to avoid:** `RecommendedCarousel` must have its own loading skeleton (3 shimmer cards). It renders independently — `SearchSection` does not wait for it.

### Pitfall 5: Cache Not Invalidated After Passport Update
**What goes wrong:** Client updates fitness goals, but carousel still shows stale results from yesterday's cache.
**Why it happens:** 24hr TTL only — no event-based invalidation.
**How to avoid:** When `ClientPassport.tsx` saves any of the 3 gating fields (fitness_level, goals_ranked, workout_types) or `hourly_budget_max`, call `localStorage.removeItem(CACHE_KEY(userId))` to bust the cache. Match will recompute on next search page visit.

### Pitfall 6: Empty State with Fewer Than 3 Matches
**What goes wrong:** Only 1-2 trainers score above the 40-point floor — carousel shows awkward 1-2 card layout.
**How to avoid:** If `results.length > 0 && results.length < 3`, show all available results (don't hide the carousel). Only hide the carousel if `results.length === 0` — in that case, either show nothing or a "No matches yet — try updating your passport" state.

## Code Examples

Verified patterns from project codebase:

### Completeness Gate Check (3-field threshold)
```typescript
// Derived from ClientPassport.tsx COMPLETION_FIELDS pattern
function isPassportReady(cp: {
  fitness_level: string | null;
  goals_ranked: string[];
  workout_types: string[];
}): boolean {
  return !!(
    cp.fitness_level &&
    cp.goals_ranked?.length >= 1 &&
    cp.workout_types?.length >= 1
  );
}
```

### Accessing client_profiles (project convention)
```typescript
// Source: TrainerBookings.tsx line 118, ClientPassport.tsx line 77
// (supabase as any) cast — client_profiles not in generated TS types
const { data: cp } = await (supabase as any)
  .from('client_profiles')
  .select('fitness_level, goals_ranked, workout_types, hourly_budget_max')
  .eq('user_id', user.id)
  .single();
```

### BestDeals horizontal grid (carousel reference)
```typescript
// Source: BestDeals.tsx line 154 — adapt to snap-scroll for mobile
<div className="grid grid-cols-1 md:grid-cols-3 gap-8">
  {deals.map((deal) => <DealCard key={deal.id} deal={deal} />)}
</div>
// For mobile horizontal scroll, adapt to:
<div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2">
  {results.map(r => <RecommendedTrainerCard key={r.trainer.id} result={r} />)}
</div>
```

### Match tier label mapping
```typescript
function getMatchLabel(score: number): string {
  if (score >= 80) return 'Great Match';
  if (score >= 60) return 'Good Match';
  return 'Fair Match';
}
// Display: `${score}% — ${label}` e.g. "87% — Great Match"
```

### localStorage cache pattern (24hr)
```typescript
// Source: project 24hr lock pattern (session_logs, Phase 24)
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function getCachedMatches(userId: string): MatchResult[] | null {
  const raw = localStorage.getItem(`match_cache_${userId}`);
  if (!raw) return null;
  const { data, ts } = JSON.parse(raw);
  if (Date.now() - ts > CACHE_TTL_MS) return null;
  return data;
}

function setCachedMatches(userId: string, results: MatchResult[]): void {
  localStorage.setItem(`match_cache_${userId}`, JSON.stringify({
    data: results,
    ts: Date.now(),
  }));
}
```

### Vitest unit test pattern for scoring (project convention)
```typescript
// Source: useTrainers.test.ts — pure function test, no mocks
import { describe, it, expect } from 'vitest';
import { scoreTrainer, rankAndFilter } from '@/lib/matchScoring';

describe('scoreTrainer', () => {
  it('gives full price score when trainer rate within budget', () => {
    const client = { hourly_budget_max: 60, goals_ranked: [], workout_types: [], fitness_level: 'beginner' };
    const trainer = { id: 't1', optimized_rate: 55, specialty: 'strength_training', profiles: { full_name: 'T', avatar_url: null } };
    const result = scoreTrainer(client, trainer);
    expect(result.score).toBeGreaterThanOrEqual(60);
    expect(result.label).toBe('Great Match');
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate Supabase types for new tables | `(supabase as any)` cast convention | Phase 23.1 | No TS regeneration needed mid-phase |
| Full page re-fetch on every load | Zustand + local cache for 24hr windows | Phase 22-24 | Reuse existing auth store, add localStorage cache |
| Grid-only trainer display | Horizontal carousel (from BestDeals pattern) | This phase | Requires adapting BestDeals snap-scroll for 3-card max |

**Note:** The project does NOT currently use React Query or SWR — all data fetching is manual `useEffect` + `useState`. The new hook must follow this pattern.

## Open Questions

1. **Cache location: localStorage vs Supabase table**
   - What we know: `client_profiles` is a small table, trainer count is low, localStorage is zero-infrastructure
   - What's unclear: If the user logs in on multiple devices, localStorage won't sync
   - Recommendation: Use localStorage for MVP (matches project complexity level). A Supabase `match_cache` table is a valid upgrade path but adds a migration + RLS policy for no current user benefit.

2. **Budget field: single max or range**
   - What we know: The CONTEXT.md example says "Within your $50-80 range" (implying min+max), but client_profiles has no such fields
   - What's unclear: Whether to add `hourly_budget_min` + `hourly_budget_max`, or just `hourly_budget_max`
   - Recommendation: Single `hourly_budget_max` integer is sufficient. Price scoring awards full points for trainer rate <= budget max. Explanation text can still say "Within your budget" without a range. The UI can be a simple number input ("Max hourly rate: $____").

3. **What to show when passport meets threshold but zero trainers score >= 40**
   - What we know: This is possible if client has niche goals not served by current trainers
   - Recommendation: Hide carousel entirely (don't show empty state) — the main search grid still works. Log this case for future tuning.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (vite.config.ts `test: { globals: true, environment: 'jsdom' }`) |
| Config file | `vite.config.ts` (inline test config) |
| Quick run command | `npx vitest run src/lib/matchScoring.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AIMATCH-01 | scoreTrainer returns correct score for price+goals inputs | unit | `npx vitest run src/lib/matchScoring.test.ts` | Wave 0 |
| AIMATCH-01 | rankAndFilter returns top 3 in score order | unit | `npx vitest run src/lib/matchScoring.test.ts` | Wave 0 |
| AIMATCH-02 | reasons array contains price reason when budget set | unit | `npx vitest run src/lib/matchScoring.test.ts` | Wave 0 |
| AIMATCH-02 | reasons array contains goal reason when specialty matches | unit | `npx vitest run src/lib/matchScoring.test.ts` | Wave 0 |
| AIMATCH-03 | isPassportReady returns false when fitness_level null | unit | `npx vitest run src/lib/matchScoring.test.ts` | Wave 0 |
| AIMATCH-03 | isPassportReady returns false when goals_ranked empty | unit | `npx vitest run src/lib/matchScoring.test.ts` | Wave 0 |
| AIMATCH-04 | getCachedMatches returns null after 24hr TTL | unit | `npx vitest run src/lib/matchScoring.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/lib/matchScoring.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/matchScoring.test.ts` — covers AIMATCH-01, AIMATCH-02, AIMATCH-03, AIMATCH-04
- [ ] DB migration: `hourly_budget_max integer` column on `client_profiles`

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — `src/types/supabase.ts` (trainer_profiles schema confirmed: no workout_types array, single specialty string)
- Direct codebase inspection — `src/pages/ClientPassport.tsx` (client_profiles columns: fitness_level, goals_ranked, workout_types; NO budget field)
- Direct codebase inspection — `src/hooks/useTrainers.ts` (rankTrainers pattern for pure scoring function)
- Direct codebase inspection — `vite.config.ts` (Vitest config: globals+jsdom)
- Direct codebase inspection — `src/hooks/useTrainers.test.ts` (test pattern for pure functions)
- Direct codebase inspection — `src/components/landing/BestDeals.tsx` (horizontal card UI pattern)
- Direct codebase inspection — `.planning/config.json` (nyquist_validation: true)
- `.planning/STATE.md` decisions table (project conventions: `(supabase as any)` cast, no type regen mid-phase)

### Secondary (MEDIUM confidence)
- CONTEXT.md canonical refs — BestDeals.tsx carousel pattern recommended for adaptation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in project, no new dependencies
- Architecture: HIGH — scoring function pattern directly derived from existing `rankTrainers` in `useTrainers.ts`; carousel pattern from `BestDeals.tsx`
- Pitfalls: HIGH — schema gap (no budget field, no trainer workout_types array) confirmed by direct inspection of `supabase.ts` and `ClientPassport.tsx`

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable schema — barring migrations in Phases 26-28)
