# Phase 14: Feature Gates + Search — Research

**Researched:** 2026-03-16
**Domain:** Subscription tier enforcement (DB + UI), trainer search ranking, landing page featured section
**Confidence:** HIGH — all findings grounded in existing codebase inspection + verified patterns from prior research

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TIER-01 | Free trainer: maximum 3 availability slots visible to clients in search and booking | `get_visible_slots` RPC already live (Phase 12); client-facing booking view must call it; `useTrainers` currently bypasses it |
| TIER-02 | Pro trainer ($9/mo): maximum 10 availability slots visible to clients | Same RPC handles this (CASE v_tier='pro' THEN 10); no new DB work |
| TIER-03 | Elite trainer ($29/mo): all availability slots visible to clients | Same RPC (2147483647 limit); no new DB work |
| TIER-04 | Pro and Elite trainers: extended custom bio up to 1000 chars; Free limited to 280 | Bio column exists (`bio text | null`); requires validation in update-bio Edge Function + frontend form; no new migration needed |
| TIER-05 | Advanced earnings analytics gated to Pro/Elite only; hidden for Free | `AnalyticsTab` already built and rendered unconditionally in TrainerDashboard; gate requires `useTier` hook + conditional render |
| TIER-06 | On downgrade, data preserved; only visibility and access revert to new tier limits | `get_visible_slots` RPC already soft-hides by tier; no delete logic needed; dashboard should show "N of M slots visible" hint |
| SRCH-01 | Pro trainers ranked above equivalent Free in trainer search results | `rankTrainers()` in `useTrainers.ts` uses weighted blend (discount 40%, rating 25%, proximity 20%, availability 15%); needs tier weight injected |
| SRCH-02 | Elite trainers in dedicated "Featured Trainers" section on landing page above standard list | `BestDeals.tsx` is on the landing page; new `FeaturedTrainers` component queries `subscription_tier = 'elite'`; placed above BestDeals |
| SRCH-03 | Featured Trainers section hidden entirely when no Elite trainers exist | Conditional render on data; no placeholder, no Pro fallback |
</phase_requirements>

---

## Summary

Phase 14 is almost entirely a **wiring phase** — the heavy infrastructure was laid in Phases 12 and 13. The `subscription_tier` column is live on `trainer_profiles`, written reliably by the billing webhook, and indexed. The `get_visible_slots` RPC is already deployed and correctly enforces tier limits at the Postgres level. The `AnalyticsTab` component is fully built. No new migrations are strictly required.

What Phase 14 actually does: (1) route client-facing slot queries through `get_visible_slots` instead of direct table reads, (2) inject a tier priority signal into the existing `rankTrainers` weighted-blend function, (3) add bio character limit enforcement in both the Edge Function and the UI form, (4) gate `AnalyticsTab` visibility using a `useTier` hook, (5) add a `FeaturedTrainers` component to the landing page that queries Elite trainers and self-hides when none exist.

The only genuinely new DB work is an optional but strongly recommended `get_featured_trainers` RPC to keep the featured query maintainable alongside any future RLS changes. All bio validation can be enforced server-side via the existing Edge Function pattern and client-side via the existing form.

**Primary recommendation:** Wire `get_visible_slots` into the client booking view, add a thin `useTier` hook reading from the already-populated `trainerProfile.subscription_tier`, inject tier rank into `rankTrainers`, add the `FeaturedTrainers` component, and gate `AnalyticsTab`. Total surface area is modest.

---

## What Already Exists (Do Not Re-Implement)

| Asset | Location | Phase Built | Status |
|-------|----------|-------------|--------|
| `get_visible_slots` RPC | Supabase (migration 20260316100000) | Phase 12 | LIVE — enforces free=3, pro=10, elite=unlimited |
| `subscription_tier` column | `trainer_profiles.subscription_tier` | Phase 12 | LIVE — indexed, CHECK constraint, written by webhook |
| `subscription_status` column | `trainer_profiles.subscription_status` | Phase 12 | LIVE — trialing / active / canceled etc. |
| `trial_ends_at` column | `trainer_profiles.trial_ends_at` | Phase 12 | LIVE |
| Subscription billing columns in TypeScript types | `src/types/supabase.ts` | Phase 12 | LIVE — `subscription_tier`, `subscription_status`, `trial_ends_at`, `current_period_end`, `cancel_at_period_end` |
| `AnalyticsTab` component | `src/components/trainer/AnalyticsTab.tsx` | Phase 10 | Built; not gated |
| `rankTrainers` function | `src/hooks/useTrainers.ts` lines 23–49 | v1 | In production; needs tier weight added |
| `trainerProfile` in Zustand store | `src/stores/auth.ts` | v1 | Available in every component via `useAuthStore()` |
| `guard_subscription_tier_write` trigger | Supabase | Phase 12 | LIVE — blocks direct client writes to billing columns |

---

## Standard Stack

### Core (No New Libraries Needed)

This phase uses the project's existing stack exclusively. No new npm packages are required.

| Tool | Version | Purpose |
|------|---------|---------|
| Zustand | existing | Auth state + trainerProfile (subscription_tier lives here) |
| Supabase JS client | existing | RPC calls (`get_visible_slots`) + direct queries |
| React | existing | Hook-based gate logic |
| TypeScript | existing | Tier type safety (`'free' | 'pro' | 'elite'`) |
| Tailwind CSS | existing | Gate UI styling (locked banners, slot count hints) |

### New Files to Create

| File | Purpose |
|------|---------|
| `src/lib/tierGates.ts` | Feature registry: `TIER_GATES` map + `Tier` type |
| `src/hooks/useTier.ts` | `useTier()` + `useCan()` hooks reading from trainerProfile |
| `src/components/landing/FeaturedTrainers.tsx` | Elite trainer featured section |
| `src/components/shared/LockedFeatureBanner.tsx` | Reusable gated-feature banner (analytics tab lock) |

---

## Architecture Patterns

### Recommended Project Structure Addition

```
src/
├── lib/
│   └── tierGates.ts          # TIER_GATES registry + Tier type (NEW)
├── hooks/
│   └── useTier.ts            # useTier() + useCan() hooks (NEW)
├── components/
│   ├── landing/
│   │   └── FeaturedTrainers.tsx   # Elite featured section (NEW)
│   └── shared/
│       └── LockedFeatureBanner.tsx # Reusable gate banner (NEW)
```

### Pattern 1: Tier Gate Hook

**What:** `useTier()` reads `trainerProfile.subscription_tier` from the Zustand store. `useCan(feature)` checks the feature registry.

**When to use:** Any component that conditionally renders or blocks based on tier.

**Key detail:** During `trialing` status, all features are accessible — a trialing Free trainer has Pro-level access. `useCan` must account for this.

```typescript
// src/lib/tierGates.ts
export type Tier = 'free' | 'pro' | 'elite';

export type TierFeature =
  | 'slots_ten'
  | 'slots_unlimited'
  | 'extended_bio'
  | 'analytics_advanced'
  | 'priority_search'
  | 'featured_landing';

export const TIER_GATES: Record<TierFeature, Tier[]> = {
  slots_ten:          ['pro', 'elite'],
  slots_unlimited:    ['elite'],
  extended_bio:       ['pro', 'elite'],
  analytics_advanced: ['pro', 'elite'],
  priority_search:    ['pro', 'elite'],
  featured_landing:   ['elite'],
};
```

```typescript
// src/hooks/useTier.ts
import { useAuthStore } from '@/stores/auth';
import { TIER_GATES, type Tier, type TierFeature } from '@/lib/tierGates';

export function useTier() {
  const { trainerProfile } = useAuthStore();
  const tier = (trainerProfile?.subscription_tier ?? 'free') as Tier;
  const isTrialing = trainerProfile?.subscription_status === 'trialing';
  const trialEndsAt = trainerProfile?.trial_ends_at ?? null;
  return { tier, isTrialing, trialEndsAt };
}

export function useCan(feature: TierFeature): boolean {
  const { tier, isTrialing } = useTier();
  if (isTrialing) return true;  // trial = full Pro access
  return TIER_GATES[feature].includes(tier);
}
```

### Pattern 2: Slot Visibility — Wire get_visible_slots

**What:** The client booking view (TrainerProfile page) currently reads `availability_slots` directly. It must call `get_visible_slots` RPC instead. `useTrainers.ts` fetches all slots for ranking; this is acceptable because ranking is internal, but the count displayed to the client on a trainer's profile page must come from the RPC.

**Two distinct use cases:**

| Context | Query to Use | Reason |
|---------|-------------|--------|
| Client views trainer profile / booking page | `supabase.rpc('get_visible_slots', { p_trainer_id })` | Enforced tier limit; SECURITY DEFINER bypasses anon RLS |
| `useTrainers` ranking computation (internal) | Direct `availability_slots` query | Ranking is not client-facing data; all slots needed for scoring |
| Trainer's own dashboard | Direct query (no limit) | Trainer sees all their own slots |

**Pattern for the client booking page:**

```typescript
// Replace: supabase.from('availability_slots').select(...)...eq('trainer_id', id)
// With:
const { data: visibleSlots } = await supabase
  .rpc('get_visible_slots', { p_trainer_id: trainerId });
```

**The RPC already exists and is GRANTED to `anon` and `authenticated`.** No migration needed.

### Pattern 3: Tier-Ranked Search

**What:** Inject a tier rank signal into the existing `rankTrainers` weighted blend in `useTrainers.ts`.

**Current weights:** discount 40%, rating 25%, proximity 20%, availability 15%.

**New weights:** discount 35%, rating 20%, proximity 15%, availability 10%, tier 20%.

The tier signal should be a simple normalized score: elite=1.0, pro=0.67, free=0.0.

```typescript
// Modification to rankTrainers() in useTrainers.ts
// trainer_profiles already has subscription_tier; it's included in SELECT *

const tierScore = (tier: string | null | undefined): number => {
  if (tier === 'elite') return 1.0;
  if (tier === 'pro') return 0.67;
  return 0.0; // free or undefined
};

// Inside the .map():
const score =
  0.35 * discountScore +
  0.20 * ratingScore +
  0.15 * proximityScore +
  0.10 * availabilityScore +
  0.20 * tierScore(t.subscription_tier);
```

**No DB migration needed.** `subscription_tier` is already on `trainer_profiles` and included in `SELECT *`. The `trainer_profiles_tier_rating_idx` index (`subscription_tier, rating DESC`) is already created and will benefit Supabase queries that filter by tier.

**Note on `TrainerWithProfile` type:** `TrainerProfile` (from `Tables<'trainer_profiles'>`) already has `subscription_tier` as a typed field after the Phase 12 types update. The `TrainerWithProfile` interface extends `TrainerProfile`, so `t.subscription_tier` is available without type casting.

### Pattern 4: Bio Character Limit Enforcement

**What:** Free trainers are limited to 280-character bios; Pro/Elite can have up to 1000 characters.

**Two enforcement points required:**

1. **Edge Function (server-side, authoritative):** The existing `update-bio` or profile update Edge Function must read the trainer's tier and enforce the character limit. If none exists, the Supabase JS client updates `trainer_profiles.bio` directly — in that case, validation must be added to the client.

2. **UI Form (client-side, UX):** The bio textarea in the trainer profile/onboarding page must enforce `maxLength` based on tier, and show a live character counter.

**Validation logic:**

```typescript
const BIO_LIMITS: Record<Tier, number> = {
  free: 280,
  pro: 1000,
  elite: 1000,
};

// Server-side (Edge Function or RLS trigger)
const bioLimit = tier === 'free' ? 280 : 1000;
if (bio.length > bioLimit) {
  return new Response(JSON.stringify({
    error: `Bio must be ${bioLimit} characters or fewer for ${tier} tier`,
  }), { status: 400 });
}
```

**TIER-06 alignment:** When a trainer downgrades from Pro to Free, their existing long bio is preserved in the DB. The 280-char limit is only enforced on new saves. A banner in the profile editor should indicate "Your bio is hidden from clients (exceeds Free limit). Upgrade to show your full bio." — but this is a Phase 15 UI concern; Phase 14 only gates the save action.

### Pattern 5: Analytics Gate

**What:** Hide `AnalyticsTab` for Free trainers (unless trialing).

**Current code in `TrainerDashboard.tsx`:**

```tsx
// Current (ungated):
{activeTab === 'analytics' && <AnalyticsTab />}
```

**After gate:**

```tsx
// Gate using useCan:
const canAnalytics = useCan('analytics_advanced');

{(['overview', 'payouts', canAnalytics ? 'analytics' : null] as const)
  .filter(Boolean)
  .map((tab) => (
    <button key={tab} onClick={() => setActiveTab(tab as any)}>
      {tab}
    </button>
  ))}

{activeTab === 'analytics' && canAnalytics && <AnalyticsTab />}
```

**Alternative (show tab, gate content):** Show the analytics tab for all tiers but render a `LockedFeatureBanner` for Free trainers instead of the `AnalyticsTab` content. This approach is better UX (trainer can see the tab exists, understands what they're missing) and matches FEATURES.md Pattern 3 recommendations.

```tsx
{activeTab === 'analytics' && (
  canAnalytics
    ? <AnalyticsTab />
    : <LockedFeatureBanner feature="analytics_advanced" tier={tier} />
)}
```

**Recommended approach:** Show tab + `LockedFeatureBanner` (option 2). Consistent with the "allow read, gate write/view" principle from FEATURES.md.

### Pattern 6: Featured Trainers Section

**What:** A new section on the landing page that shows Elite trainers. Self-hides when none exist (SRCH-03).

**Landing page placement:** Above `BestDeals` (the "Best Deals Now" section). Elite trainers are the premium placement.

**Query pattern:**

```typescript
// src/components/landing/FeaturedTrainers.tsx
const fetchFeaturedTrainers = async () => {
  const { data } = await supabase
    .from('trainer_profiles')
    .select(`
      id, specialty, rating, review_count, location, subscription_tier,
      profiles!trainer_profiles_user_id_fkey (full_name, avatar_url)
    `)
    .eq('subscription_tier', 'elite')
    .eq('verified', true)
    .order('rating', { ascending: false })
    .limit(6);

  return data ?? [];
};
```

**No RPC required** — direct query with `.eq('subscription_tier', 'elite')` is sufficient. The `trainer_profiles_subscription_tier_idx` index is already created. The trainer's `verified` status is an appropriate quality filter.

**Conditional render (SRCH-03):**

```tsx
// In the landing page component tree (e.g., src/pages/Landing.tsx):
{featuredTrainers.length > 0 && (
  <FeaturedTrainers trainers={featuredTrainers} />
)}
```

**Do not use a fallback to Pro trainers.** SRCH-03 is explicit: "hidden entirely when no Elite trainers exist; no placeholder or fallback to Pro." Showing Pro trainers as a fallback dilutes the Elite value proposition.

**Visual treatment:** Must be visually distinct from BestDeals. BestDeals uses a dark `bg-ink` background. FeaturedTrainers should use `bg-paper` or a subtle gold accent treatment to signal premium. Header uses "Featured Trainers" or "Elite Trainers" label. A "Crown" or "Star" icon from Lucide is appropriate.

### Anti-Patterns to Avoid

- **Never enforce slot limits in the UI only.** A user can call the Supabase API directly. `get_visible_slots` is the authoritative limit; the UI just renders what the RPC returns.
- **Never string-compare tier in components.** Use `useCan('feature')` exclusively. String comparisons scattered through components become unmaintainable when tier definitions change.
- **Do not delete slots or bio on downgrade.** TIER-06 is explicit: data is preserved. Only visibility reverts. Never write a `DELETE FROM availability_slots WHERE...` in a downgrade handler.
- **Do not gate the analytics tab by hiding the tab label entirely without UI indication.** Per the research: blocking without discovery is a UX failure. Show the tab, show the lock, explain the upgrade path.
- **Do not block the landing page render while waiting for the Elite trainer query.** Show nothing for the featured section until data arrives — do not show a spinner in the hero area.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Slot count enforcement | Custom row-count middleware or RLS filter | `get_visible_slots` RPC (already live) | RPC is SECURITY DEFINER, handles anon access, already handles all tier cases |
| Feature registry | String comparisons inline in every component | `TIER_GATES` map + `useCan` hook | Single source of truth; one-line change when a feature moves tiers |
| Search ranking | New RPC or backend rerank job | Extend existing `rankTrainers()` in `useTrainers.ts` | Already called in the right place; adding a weight is a 3-line change |
| Bio limit migration | New column `max_bio_chars` | Use trainer's `subscription_tier` to derive limit at validation time | Limit is deterministic from tier; storing it separately creates sync problems |

---

## Common Pitfalls

### Pitfall 1: useTrainers Fetches All Slots — Do Not Gate This

**What goes wrong:** Developer assumes `useTrainers` should call `get_visible_slots` and limits the slot counts used for ranking.

**Why it happens:** The RPC name "get_visible_slots" suggests it should be used everywhere.

**How to avoid:** `useTrainers` uses slot counts for the internal `rankTrainers` scoring (availability weight 15%). This scoring should see real slot counts, not tier-limited counts — otherwise a Free trainer with 10 slots would rank as if they had 3. The tier signal is already being added separately. Only the **client-facing booking view** must call the RPC.

**Warning signs:** `useTrainers` calling `supabase.rpc('get_visible_slots')` in a loop per trainer.

### Pitfall 2: trainerProfile May Be null on First Render

**What goes wrong:** `useTier()` returns `tier = 'free'` while the profile is still loading, causing a momentary "free" flash before the real tier is revealed.

**Why it happens:** `useAuthStore` loads profile async; components render before `fetchProfile` completes.

**How to avoid:** The `loading` flag from `useAuthStore` should gate tier-sensitive renders. Use:

```typescript
const { trainerProfile, loading } = useAuthStore();
if (loading) return <DashboardSkeleton />;
```

Do not render tier-gated content until `loading === false`.

### Pitfall 3: Bio Validation Bypassed via Direct Supabase Update

**What goes wrong:** The trainer profile update goes through `supabase.from('trainer_profiles').update({ bio })` directly from the client, bypassing any Edge Function.

**Why it happens:** There may not be a dedicated `update-bio` Edge Function; the profile editor may write directly.

**How to avoid:** Check whether bio is currently saved via direct client call or Edge Function. If direct: add the tier-based validation in a `BEFORE UPDATE` trigger OR add a server-side check in the profile update Edge Function. Do NOT rely solely on the frontend `maxLength` attribute.

**Check existing update path:** Look at how `TrainerProfile.tsx` or the onboarding page saves the bio. If via `supabase.from('trainer_profiles').update(...)`, the guard trigger (`guard_subscription_tier_write`) only blocks subscription columns, not bio. A separate validation hook or trigger is needed for bio.

### Pitfall 4: Featured Section Causes Landing Page Layout Shift

**What goes wrong:** On first load, the featured section doesn't exist yet (loading), then appears and pushes BestDeals down — jarring layout shift.

**Why it happens:** Async data fetch with no loading state coordination.

**How to avoid:** Initialize `featuredTrainers` as `null` (not `[]`) and only render the section when `featuredTrainers !== null && featuredTrainers.length > 0`. The section is absent during loading (no shift) and absent when empty (no placeholder shift).

### Pitfall 5: Tier Rank Changes Without Updating Both SQL and JS

**What goes wrong:** The Supabase search query in some places uses an RPC with a `CASE` for tier ranking, while `rankTrainers()` uses the JS-side scoring. They diverge when someone updates one but not the other.

**How to avoid:** In this codebase, `rankTrainers` is the authoritative ranker (client-side, post-fetch). There is no server-side ORDER BY tier in the current query. Adding tier rank only to `rankTrainers` is the correct single-source approach. Do NOT add a separate `ORDER BY CASE subscription_tier` to the Supabase query unless you remove the JS-side reranking — having both creates unpredictable ordering.

---

## Code Examples

### Inject Tier into rankTrainers

```typescript
// Source: src/hooks/useTrainers.ts (existing function, minimal diff)
// Add inside the .map() block, update score formula

const tierScore = (() => {
  const t = t.subscription_tier as string | null | undefined;
  if (t === 'elite') return 1.0;
  if (t === 'pro')   return 0.67;
  return 0;
})();

const score =
  0.35 * discountScore +    // was 0.40
  0.20 * ratingScore +      // was 0.25
  0.15 * proximityScore +   // was 0.20
  0.10 * availabilityScore +// was 0.15
  0.20 * tierScore;         // NEW
```

### Client Booking Page Slot Fetch

```typescript
// Source: Supabase RPC — deployed in Phase 12
// Replaces: supabase.from('availability_slots').select('*').eq('trainer_id', id)
const { data: slots, error } = await supabase
  .rpc('get_visible_slots', { p_trainer_id: trainerId });
```

### Featured Trainers Self-Hiding Pattern

```typescript
// src/components/landing/FeaturedTrainers.tsx
const [trainers, setTrainers] = useState<FeaturedTrainer[] | null>(null);

useEffect(() => {
  supabase
    .from('trainer_profiles')
    .select(`id, specialty, rating, review_count,
             profiles!trainer_profiles_user_id_fkey(full_name, avatar_url)`)
    .eq('subscription_tier', 'elite')
    .eq('verified', true)
    .order('rating', { ascending: false })
    .limit(6)
    .then(({ data }) => setTrainers(data ?? []));
}, []);

// Renders nothing until data resolves; renders nothing if empty
if (!trainers || trainers.length === 0) return null;
```

### LockedFeatureBanner Usage in TrainerDashboard

```tsx
// TrainerDashboard.tsx analytics tab section (after gate)
const canAnalytics = useCan('analytics_advanced');

{activeTab === 'analytics' && (
  canAnalytics
    ? <AnalyticsTab />
    : (
      <div className="border border-ink/10 p-12 text-center space-y-4">
        <p className="text-xs uppercase tracking-[0.3em] text-ink/30">Pro Feature</p>
        <p className="serif text-2xl font-light text-ink">Advanced Analytics</p>
        <p className="text-sm text-ink/50">
          Time-range charts, booking heatmap, and CSV export are available on Pro and Elite.
        </p>
        {/* Upgrade CTA goes here — Phase 15 */}
      </div>
    )
)}
```

---

## DB Work Required in Phase 14

No new migrations are strictly required for the core gating and search requirements. However, one migration is recommended:

### Optional but Recommended: get_ranked_trainers RPC

The current `useTrainers` hook fetches all trainers and reranksin JS. For correctness and future DB-level filtering, a `get_ranked_trainers(specialty, location, limit, offset)` RPC that includes the `ORDER BY CASE subscription_tier` would be the right long-term pattern. However, since the existing JS-side `rankTrainers` is already the pattern and works correctly for the current scale, this is a planner decision. Research recommends adding it if the planner wants DB-authoritative ordering; otherwise extend `rankTrainers`.

### Bio Validation: Assess Update Path First

Before writing a migration for bio validation, the planner must determine how the trainer's bio is currently saved:

- If saved via Edge Function: add bio length check there.
- If saved via direct Supabase client call: either add a Postgres `CHECK` constraint (`CHAR_LENGTH(bio) <= 1000`) or a `BEFORE UPDATE` trigger that enforces tier-based limits. A `CHECK` constraint cannot be tier-aware; a trigger is required for tier-based limits.

**Recommended trigger approach for bio gating:**

```sql
-- Bio length trigger (new migration needed ONLY if direct-client update path is used)
CREATE OR REPLACE FUNCTION public.enforce_bio_tier_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_tier text;
BEGIN
  v_tier := NEW.subscription_tier;
  IF NEW.bio IS DISTINCT FROM OLD.bio THEN
    IF v_tier = 'free' AND CHAR_LENGTH(NEW.bio) > 280 THEN
      RAISE EXCEPTION 'Free tier bio limit is 280 characters';
    END IF;
    IF CHAR_LENGTH(NEW.bio) > 1000 THEN
      RAISE EXCEPTION 'Bio limit is 1000 characters';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
```

---

## State of the Art

| Old Approach | Current Approach | Impact for Phase 14 |
|--------------|------------------|---------------------|
| Slot limits in UI only (`slice(0, 3)`) | SECURITY DEFINER RPC enforced at Postgres level | Phase 14 must call the RPC; UI limit is not acceptable |
| Tier stored externally (e.g., JWT claim) | Denormalized `subscription_tier` column on `trainer_profiles` | `trainerProfile.subscription_tier` is directly readable from existing Zustand store |
| Feature flags via boolean DB columns | Single `TIER_GATES` registry + `useCan` hook | New pattern to introduce in Phase 14 |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (inferred from Vite project; no config file detected) |
| Config file | None found — Wave 0 must add `vitest.config.ts` or inline in `vite.config.ts` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements — Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TIER-01 | Free trainer sees exactly 3 slots via `get_visible_slots` | smoke (Supabase RPC integration) | manual-only — requires live DB | N/A |
| TIER-02 | Pro trainer sees exactly 10 slots via RPC | smoke | manual-only | N/A |
| TIER-03 | Elite trainer sees all slots | smoke | manual-only | N/A |
| TIER-04 | Bio > 280 chars returns 400 for Free trainer | unit | `npx vitest run src/lib/tierGates.test.ts` | ❌ Wave 0 |
| TIER-05 | Analytics tab absent from Free trainer render | unit | `npx vitest run src/hooks/useTier.test.ts` | ❌ Wave 0 |
| TIER-06 | Downgrade does not mutate slots or bio in DB | manual-only — DB state verification | manual | N/A |
| SRCH-01 | Elite/Pro trainers sort before Free in rankTrainers output | unit | `npx vitest run src/hooks/useTrainers.test.ts` | ❌ Wave 0 |
| SRCH-02 | FeaturedTrainers renders when Elite trainers exist | unit | `npx vitest run src/components/landing/FeaturedTrainers.test.tsx` | ❌ Wave 0 |
| SRCH-03 | FeaturedTrainers returns null when no Elite trainers | unit | same file | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run --reporter=verbose` (unit tests only, < 10s)
- **Per wave merge:** `npx vitest run` (full suite)
- **Phase gate:** Full suite green + manual smoke of `get_visible_slots` via Supabase Studio before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/lib/tierGates.test.ts` — covers TIER-04 (bio limit validation), `useCan` logic
- [ ] `src/hooks/useTier.test.ts` — covers TIER-05 (`useCan('analytics_advanced')` returns false for free)
- [ ] `src/hooks/useTrainers.test.ts` — covers SRCH-01 (`rankTrainers` with tier signal)
- [ ] `src/components/landing/FeaturedTrainers.test.tsx` — covers SRCH-02, SRCH-03
- [ ] `vitest.config.ts` or `vite.config.ts` test config block — framework install

---

## Open Questions

1. **How is the trainer bio currently saved?**
   - What we know: `trainer_profiles.bio` column exists. The `guard_subscription_tier_write` trigger only blocks billing columns, not bio.
   - What's unclear: Is there a dedicated `update-bio` Edge Function, or does the profile editor call `supabase.from('trainer_profiles').update({ bio })` directly?
   - Recommendation: Planner should inspect `TrainerProfile.tsx` and `TrainerOnboarding.tsx` for the bio save path before writing the bio validation task. If direct client write: trigger required. If Edge Function: add server-side validation there.

2. **Where is the trainer profile page that clients see for booking?**
   - What we know: `useTrainerById` in `useTrainers.ts` fetches trainer data for individual profile views. The current slot fetch is via direct `availability_slots` query (not the RPC).
   - What's unclear: Exactly which file renders the booking view and makes the slot query.
   - Recommendation: Planner should locate `TrainerProfile.tsx` (referenced in `BestDeals` Link `to={/trainers/${id}}`). This is where `get_visible_slots` must be wired in.

3. **Is the landing page one component or composed?**
   - What we know: `BestDeals.tsx` is a standalone section component. The landing page likely imports it.
   - Recommendation: Planner should inspect `src/pages/` for `Landing.tsx` or `Home.tsx` to understand where to insert the `FeaturedTrainers` component above `BestDeals`.

---

## Sources

### Primary (HIGH confidence)

- `Cenlar demand gt 1-17/supabase/migrations/20260316100000_subscription_foundation.sql` — authoritative schema for all subscription columns, RPC, trigger
- `Cenlar demand gt 1-17/src/hooks/useTrainers.ts` — `rankTrainers` function; exact weight values confirmed by inspection
- `Cenlar demand gt 1-17/src/components/landing/BestDeals.tsx` — landing page pattern for self-hiding sections
- `Cenlar demand gt 1-17/src/pages/TrainerDashboard.tsx` — tab structure, analytics tab render location
- `Cenlar demand gt 1-17/src/stores/auth.ts` — confirms `trainerProfile` in Zustand store, `TrainerProfile` type
- `.planning/phases/12-subscription-foundation/12-01-SUMMARY.md` — confirms get_visible_slots live, GRANT to anon/authenticated
- `.planning/research/FEATURES.md` Patterns 3, 4, 5, 6 — hook design, slot gating, search ranking, featured section

### Secondary (MEDIUM confidence)

- `.planning/REQUIREMENTS.md` TIER-01 through TIER-06, SRCH-01 through SRCH-03 — requirement text and intent
- `.planning/research/FEATURES.md` "Anti-Features" section — do not delete on downgrade, do not auto-upgrade

### Tertiary (LOW confidence — not needed; all requirements mappable from codebase inspection)

- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; existing code inspected directly
- Architecture: HIGH — patterns from FEATURES.md research (pre-verified) + direct codebase inspection
- Pitfalls: HIGH — identified from direct reading of `useTrainers.ts`, `TrainerDashboard.tsx`, `BestDeals.tsx`
- Validation: MEDIUM — Vitest assumed from Vite project; no vitest.config.ts found to confirm

**Research date:** 2026-03-16
**Valid until:** 2026-04-15 (stable stack; subscription columns are locked by trigger)
