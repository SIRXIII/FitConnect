# Phase 16 Research — Admin Subscription Visibility

> Synthesized from plan file context and codebase exploration. Research skipped per `--skip-research` flag.

## Requirements
- ADMN-01: Admin user list displays subscription tier (Free / Pro / Elite / trial) and status per trainer
- ADMN-02: Admin can manually grant or revoke a tier override for any trainer without requiring a Stripe subscription
- ADMN-03: Admin analytics tab displays MRR and active subscriber count broken down by tier (Pro and Elite) + active trial count

---

## Codebase Context

### Existing `AdminDashboard.tsx` Structure

- **Location:** `Cenlar demand gt 1-17/src/pages/AdminDashboard.tsx`
- **Tabs:** `analytics`, `users`, `reviews`, `settings`
- **Analytics tab:** Uses `get_admin_analytics` RPC — already returns `mrr`, `pro_subscriber_count`, `elite_subscriber_count` (Phase 13)
- **Users tab:** Queries `profiles` table with `id, full_name, role, is_suspended, created_at`
  - Does NOT join `trainer_profiles` — no tier data available yet
- **State:** `adminTotals` holds `total_revenue`, `total_platform_fee`, `total_payouts`, `booking_volume` — does NOT include subscription metrics yet

### `get_admin_analytics` RPC (Phase 13 migration: `20260316200000_admin_mrr.sql`)

Returns:
```jsonb
{
  totals: { total_revenue, total_platform_fee, total_payouts, booking_volume },
  top_earners: [...],
  mrr: number,
  pro_subscriber_count: number,
  elite_subscriber_count: number
}
```

**Missing:** `active_trial_count` — needs a new migration to add it.

### `trainer_profiles` schema (from `src/types/supabase.ts`)

Relevant columns already exist:
- `subscription_tier: 'free' | 'pro' | 'elite'`
- `subscription_status: 'inactive' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'paused' | 'incomplete'`
- `tier_overridden_by: string | null`
- `tier_overridden_at: string | null`

### `guard_subscription_tier_write` trigger

Blocks auth-role writes to `subscription_tier` on `trainer_profiles` (Phase 12). The `admin-set-tier-override` Edge Function must use the service_role key to bypass this trigger.

### Existing Edge Function patterns

- `create-subscription/index.ts` — JWT auth pattern: `supabase.auth.getUser(token)` + user lookup
- `_shared/cors.ts` — `corsHeaders` export used by all functions
- All functions use `Deno.serve` and `@supabase/supabase-js` Deno import

---

## Implementation Plan

### Plan 16-01 (Wave 1): DB Migration — `active_trial_count`

**File:** `supabase/migrations/20260317100000_admin_trial_count.sql`

Extend `get_admin_analytics` to add `active_trial_count`:
```sql
-- In subscription_stats CTE, add:
COUNT(*) FILTER (WHERE subscription_status = 'trialing') AS active_trial_count
-- In jsonb_build_object, add:
'active_trial_count', (SELECT active_trial_count FROM subscription_stats)
```

Use `CREATE OR REPLACE FUNCTION` (same pattern as Phase 13 migration). Wrap in `BEGIN; ... COMMIT;`.

### Plan 16-02 (Wave 2, depends on 16-01): AdminDashboard — Analytics metrics + Tier badges

**Task 1 — Analytics subscription metrics (ADMN-03):**
- Add `mrr`, `pro_subscriber_count`, `elite_subscriber_count`, `active_trial_count` fields to `adminTotals` state type
- Extract these from `data.mrr`, `data.pro_subscriber_count`, `data.elite_subscriber_count`, `data.active_trial_count`
- Add 4 new StatCard components below existing 4: "MRR", "Pro Subscribers", "Elite Subscribers", "Active Trials"
- MRR shows `$X.XX` format; subscriber/trial counts show integer

**Task 2 — Users tab tier badges (ADMN-01):**
- Update users query:
  ```typescript
  supabase.from('profiles')
    .select('id, full_name, role, is_suspended, created_at, trainer_profiles(subscription_tier, subscription_status, tier_overridden_by, tier_overridden_at)')
  ```
- Update `UserRow` interface to add optional `trainer_profiles` field
- Add `TierBadge` sub-component with badge label logic:
  - "Free" (ink/40), "Pro" (accent), "Elite" (ink), "Pro — Trialing" (accent/70), "Elite — Trialing" (ink/70), "Pro — Past Due" (amber), "Elite — Past Due" (amber)
- Show badge in user row — trainers only (role === 'trainer')

### Plan 16-03 (Wave 3, depends on 16-02): Manual Tier Override

**Task 1 — Edge Function `admin-set-tier-override` (ADMN-02):**
- File: `supabase/functions/admin-set-tier-override/index.ts`
- Accepts: `{ trainerId: string, tier: 'free' | 'pro' | 'elite' }`
- Auth flow: JWT → `supabase.auth.getUser(token)` → verify `profiles.role === 'admin'`
- Write: use `adminClient` (service_role) to bypass trigger:
  ```typescript
  await adminClient.from('trainer_profiles').update({
    subscription_tier: tier,
    tier_overridden_by: userId,
    tier_overridden_at: new Date().toISOString(),
  }).eq('id', trainerId)
  ```
- Returns: 200 `{ success: true }`, 403 if not admin, 400 if invalid tier/missing params

**Task 2 — Override UI in AdminDashboard:**
- Update table header columns to include "Tier" column for trainer rows
- Each trainer row: existing tier badge + "Override" button (small, ink/30 color)
- Override: opens a 3-option inline selector (or simple prompt-style row expansion): Free / Pro / Elite
- On confirm: calls `callEdgeFunction('admin-set-tier-override', { trainerId, tier })`, shows toast, calls `fetchUsers()` to refetch
- Show `tier_overridden_at` as tooltip/subtext when override exists: "Override: Mar 17"

---

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| `active_trial_count` as separate migration | Consistent with Phase 13 pattern; single RPC for all analytics |
| Join trainer_profiles in users query | Single query, no N+1; Supabase handles embedded join |
| service_role for admin override | `guard_subscription_tier_write` blocks auth-role writes; bypass required |
| Serialize 16-02 → 16-03 for AdminDashboard.tsx | Prevents parallel file write conflict |
| Override UI as inline selector (not modal) | Simpler, faster — admin workflow doesn't need confirmation overhead |
| Use `callEdgeFunction` from `subscription.ts` | Reuse existing helper instead of reimplementing fetch pattern |

---

## Validation Architecture

### Test Infrastructure
- **Framework:** Vitest 4.1.x (configured in `vite.config.ts`)
- **Test runner:** `npx vitest run --reporter=verbose`

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Method |
|--------|----------|-----------|--------|
| ADMN-01 | Tier badge renders correct label for each tier/status combo | Unit | Check AdminDashboard users tab renders TierBadge |
| ADMN-02 | Override calls admin-set-tier-override, updates badge | Integration | Check Edge Function accepts admin JWT, updates trainer_profiles |
| ADMN-03 | Analytics tab shows MRR, Pro count, Elite count, Trial count | Unit | Check adminTotals state type includes new fields |
