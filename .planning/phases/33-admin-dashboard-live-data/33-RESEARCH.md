# Phase 33: Admin Dashboard Live Data — Research

**Researched:** 2026-03-23
**Domain:** Supabase RLS, PostgreSQL RPCs, React admin dashboard wiring
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Analytics Tab:** Pull real data from Supabase: total bookings (count from `bookings`), total revenue (sum from `bookings.amount`), active users (count from `profiles` where role is set), platform fees (sum from `bookings.platform_fee`). Wire existing `adminRange` state to real queries. Remove DEMO_STATS fallback entirely. Revenue chart uses Recharts (already installed) with real monthly data.
- **Transactions Tab (NEW):** New tab showing all payments: date, client name, trainer name, amount, platform fee, status (succeeded/pending/refunded). Pull from `bookings` joined with profiles. Sortable by date, filterable by status. No Stripe API calls — all data is in Supabase from webhook events.
- **Payouts Tab (NEW):** Show trainer payout balances. Per-trainer: approve payout, reject, or hold. Payout history with date, amount, status. Uses existing `payout_transactions` table. Manual payout triggers call the existing `create-payout` edge function.
- **Users Tab:** Replace demo users with real query from `profiles` joined with trainer_profiles. Show: name, email, role, status (active/suspended), member since, last login. Filter by role and status. Search by name or email. Suspend/unsuspend kept as-is.
- **Cert Approval Fix:** Verify and fix remaining RLS issues on `trainer_certifications`.
- **No Stripe API calls** from the admin dashboard — everything comes from Supabase DB.
- **Demo data removed entirely** — no DEMO_STATS, DEMO_TOP_EARNERS, DEMO_USERS fallbacks.

### Claude's Discretion
- Exact SQL query optimization (RPCs vs client-side joins)
- Loading skeleton designs for new tabs
- Pagination approach for transactions (offset vs cursor)
- Chart styles and color choices

### Deferred Ideas (OUT OF SCOPE)
- Google Places Autocomplete for location search
- Client Stripe saved payment methods in Settings
- Stripe webhook real-time sync
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ADMIN-01 | Admin can view all users with role badges | `profiles` + `trainer_profiles` join already implemented in `fetchUsers`; email requires `auth.users` access which only service role can read — workaround documented below |
| ADMIN-02 | Admin can suspend/unsuspend users | `handleSuspend` function already exists and works; RLS policy `profiles_admin_update` in place |
| ADMIN-03 | Admin can view platform revenue and booking analytics | `get_admin_analytics` RPC exists, is already wired — remove demo fallback and let real zeros show |
| ADMIN-04 | Admin can manage subscription tiers and override | `setAdminTierOverride` in `lib/subscription.ts` already works; `handleOverride` handler in dashboard |
| ADMIN-05 (implied) | Transactions tab with payment list | New tab; `payments` table has all needed fields; admin RLS policy `payments_admin_select_all` exists |
| ADMIN-06 (implied) | Payouts tab with per-trainer balance and approve/reject/hold | `payout_transactions` table exists; needs admin SELECT policy added; `create-payout` edge function called by admin on behalf of trainer |
</phase_requirements>

---

## Summary

Phase 33 is primarily a data-wiring and UI-addition phase rather than a new-infrastructure phase. The backend already has almost everything needed: the `get_admin_analytics` RPC is fully implemented, the `payments` table has an admin RLS SELECT policy, and the `payout_transactions` table exists with trainer-facing RLS. The two gaps are (1) `payout_transactions` lacks an admin SELECT policy so the payouts tab will return empty, and (2) the `profiles` table does not expose `auth.users.email` or `last_sign_in_at` which are in Supabase Auth and only readable via service role.

The biggest implementation risk is the email/last-login column for the users tab. Since `auth.users` cannot be queried from the client, the correct approach is to store `email` in the `profiles` table itself (it is already there for some users via `handle_new_user`) or expose it via a SECURITY DEFINER RPC. Review the profiles table for an `email` column before deciding which path to take.

For the payouts tab the admin needs to trigger a payout on behalf of a trainer. The existing `create-payout` edge function validates that the caller owns the trainer profile via `auth.uid()`, so an admin cannot call it directly for another trainer. A new admin-specific edge function or a flag parameter will be needed, or alternatively the admin can only update the `payout_transactions` table status rows (approve = insert a processing row, which the weekly-payouts job then picks up).

**Primary recommendation:** Add one migration (admin RLS on `payout_transactions`, and optionally an `email` column on `profiles` if not already present), wire the existing `get_admin_analytics` RPC to remove the demo-data fallback, and build the two new tabs (transactions, payouts) as self-contained sections inside `AdminDashboard.tsx` following established patterns.

---

## Standard Stack

### Core (all already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | 2.49.8 (per edge functions) | DB queries, RPC calls | Project standard |
| recharts | installed | Revenue chart in analytics tab | Already used in trainer earnings |
| sonner | installed | Toast notifications | Project standard for all dashboards |
| lucide-react | installed | Tab icons, action buttons | Project standard |
| zustand (`useAuthStore`) | installed | Admin role check | Project standard |

### No new dependencies needed

All required libraries are already in the project. The new tabs reuse existing patterns.

---

## Architecture Patterns

### Established Admin Dashboard Patterns (from codebase inspection)

**State shape per section:**
```typescript
// Each new tab follows this pattern:
const [transactions, setTransactions] = useState<TransactionRow[]>([]);
const [loadingTransactions, setLoadingTransactions] = useState(false);
```

**Tab type union — must be extended:**
```typescript
// Current (line 123):
type ActiveTab = 'analytics' | 'users' | 'reviews' | 'certifications' | 'audit' | 'settings' | 'support';
// After phase 33:
type ActiveTab = 'analytics' | 'transactions' | 'payouts' | 'users' | 'reviews' | 'certifications' | 'audit' | 'settings' | 'support';
```

**Tables where TypeScript types aren't generated — use `(supabase as any)`:**
```typescript
// Established pattern in AdminDashboard.tsx (line 242):
const { data, error } = await (supabase as any)
  .from('trainer_certifications')
  .select('...')
```
Apply same cast for `payout_transactions` queries.

**Query pattern for admin analytics (already wired, line 347):**
```typescript
const { data, error } = await supabase.rpc('get_admin_analytics', {
  p_start: bounds.start,
  p_end: bounds.end,
  p_bucket: getBucketParam(adminRange),
});
```
The RPC is SECURITY DEFINER and validates admin role server-side. Remove the `hasRealData` check and let real zeros display.

### Recommended Transaction Query (client-side join via Supabase)

The `payments` table joined with `bookings` and then profiles:

```typescript
// Source: Supabase JS client docs — embedded resource joins
const { data, error } = await supabase
  .from('payments')
  .select(`
    id, amount, platform_fee, trainer_payout, status, created_at,
    bookings!inner(
      client_id,
      client:client_id(full_name),
      trainer_id,
      trainer:trainer_id(profiles:user_id(full_name))
    )
  `)
  .order('created_at', { ascending: false })
  .range(offset, offset + PAGE_SIZE - 1);
```

Note: `trainer_profiles.user_id -> profiles.full_name` requires an extra hop. Alternatively, use a SECURITY DEFINER RPC for a clean multi-table join with date filtering — matches existing `get_admin_analytics` pattern.

### Recommended Payout Balance Query

Trainer payout balance = sum of `payments.trainer_payout` where `status = 'succeeded'` AND `payout_transaction_id IS NULL`, grouped by `trainer_id` via `bookings`.

```sql
-- Option A: client-side (two queries, aggregate in JS)
SELECT p.trainer_payout, b.trainer_id
FROM payments p
JOIN bookings b ON b.id = p.booking_id
WHERE p.status = 'succeeded' AND p.payout_transaction_id IS NULL;
-- Then aggregate by trainer_id in TypeScript

-- Option B: RPC (recommended for clean aggregation)
-- New function: get_admin_payout_balances()
-- Returns: [{trainer_id, trainer_name, pending_balance, payout_count}]
```

Option B (RPC) is recommended to match the project's existing analytics pattern and avoid N+1 lookups.

### Payout Approve/Hold/Reject Logic

The admin cannot call `create-payout` directly for another trainer because that edge function validates `auth.uid()` against the trainer's `user_id`. Three options:

1. **New admin edge function** `admin-trigger-payout` — takes `trainer_id`, uses service role key, reuses the Stripe transfer logic. Cleanest separation.
2. **Direct DB insert** — Admin inserts a `payout_transactions` row with `status='pending'` and `initiated_by='admin'`; the `weekly-payouts` cron or a separate trigger processes it. However, this bypasses the Stripe transfer — the transfer still needs to happen.
3. **Hold = status update** — For hold/reject, admin simply updates `payout_transactions.status` to `'held'` or `'failed'`. No Stripe call needed.

**Recommended approach:**
- **Approve:** Call new `admin-trigger-payout` edge function (or `create-payout` with admin bypass).
- **Hold:** Insert a `payout_transactions` row with status `'held'` (new status value — needs migration).
- **Reject:** Insert with status `'rejected'` or update an existing pending row.

Alternatively, given the scope note that manual payout triggers should call the existing `create-payout` edge function: add an `admin_override_trainer_id` parameter to `create-payout` that is only honored when the caller is admin role. This avoids creating a new edge function.

### RLS Gap: payout_transactions Admin SELECT

Current RLS on `payout_transactions` (migration `20260314200000_payout_system.sql`):
- Trainers can SELECT their own rows
- Service role can INSERT/UPDATE
- **No admin SELECT policy exists**

A new migration must add:

```sql
CREATE POLICY "Admins can view all payout transactions"
  ON public.payout_transactions
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- Also needed for admin-initiated payouts:
CREATE POLICY "Admins can insert payout transactions"
  ON public.payout_transactions
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Admins can update payout transactions"
  ON public.payout_transactions
  FOR UPDATE TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );
```

### Email/Last-Login for Users Tab

`auth.users` table is not accessible from the client or via standard RLS policies. Options:

1. **Check if `profiles.email` exists** — Run `SELECT column_name FROM information_schema.columns WHERE table_name='profiles'` or check migrations. The `handle_new_user` trigger does NOT copy email into profiles. Email is only in `auth.users`.

2. **SECURITY DEFINER RPC** — Create `get_admin_user_list()` that joins `auth.users` with `profiles` and returns email + `last_sign_in_at`. This is the correct approach for Supabase admin queries.

```sql
CREATE OR REPLACE FUNCTION public.get_admin_user_list()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_role text;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN (
    SELECT jsonb_agg(row_to_json(r))
    FROM (
      SELECT
        p.id, p.full_name, p.role, p.is_suspended, p.created_at,
        u.email, u.last_sign_in_at,
        tp.subscription_tier, tp.subscription_status,
        tp.tier_overridden_by, tp.tier_overridden_at
      FROM public.profiles p
      JOIN auth.users u ON u.id = p.id
      LEFT JOIN public.trainer_profiles tp ON tp.user_id = p.id
      WHERE p.role IN ('trainer', 'client', 'admin')
      ORDER BY p.created_at DESC
    ) r
  );
END;
$$;
```

3. **Simplest fallback** — Omit email and last-login from the users tab display. The CONTEXT.md says "show email, last login" so this doesn't satisfy requirements. Use the RPC.

### Anti-Patterns to Avoid

- **Direct `auth.users` query from client** — Will return empty or error. Always use SECURITY DEFINER RPC.
- **Calling `create-payout` for another user's trainer profile** — Will fail the `auth.uid()` ownership check. Need admin bypass path.
- **Removing the `usingDemoData` state var before removing all demo data references** — TypeScript will complain about unused state. Clean up together.
- **Client-side aggregation of payout balances** — Fetching all payments rows and summing in JS will be slow at scale. Use an RPC or at least a filtered query.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Platform analytics aggregation | Custom SQL in component | `get_admin_analytics` RPC | Already built, admin-gated, handles date ranges |
| Revenue chart | Custom chart | Recharts (already used in trainer analytics) | Already installed, consistent design |
| Payout balance calculation | Inline JS aggregation | New `get_admin_payout_balances` RPC | Keeps aggregation server-side, matches pattern |
| Admin user list with email | Direct `auth.users` query | `get_admin_user_list` SECURITY DEFINER RPC | Only way to access auth.users from client |
| Toast notifications | Custom notification UI | `sonner` toast | Project standard |

---

## Common Pitfalls

### Pitfall 1: `auth.users` is not accessible from authenticated client
**What goes wrong:** Querying `auth.users` from the frontend returns an empty result or permission denied, even for admin users. The admin SELECT policy on `profiles` does not extend to `auth.users`.
**Why it happens:** Supabase restricts `auth.users` to service role only.
**How to avoid:** Use a SECURITY DEFINER function that runs as postgres and can access `auth` schema.
**Warning signs:** Query returns `[]` with no error when you expect user data.

### Pitfall 2: `payout_transactions` admin queries silently return empty
**What goes wrong:** Admin queries `payout_transactions` and gets no rows, even when data exists.
**Why it happens:** No admin SELECT RLS policy on that table — only trainer-own and service-role policies exist.
**How to avoid:** Add admin RLS policies in a new migration before implementing the payouts tab.
**Warning signs:** Tab renders with "no payouts" even though `payout_transactions` rows exist in DB.

### Pitfall 3: `create-payout` cannot be called by admin for another trainer
**What goes wrong:** Admin calls `create-payout` to approve a trainer's payout; the edge function returns 404 "Trainer profile not found" because it looks up the trainer by `auth.uid()` (the admin's ID), not the target trainer.
**Why it happens:** Edge function uses `auth.uid()` to look up the trainer profile.
**How to avoid:** Either add `admin_target_trainer_id` param to `create-payout` with role check, or create a separate `admin-trigger-payout` edge function using service role.
**Warning signs:** 404 errors on payout approval despite the trainer existing.

### Pitfall 4: `payout_transactions` status enum is incomplete for hold/reject
**What goes wrong:** Attempting to set status `'held'` or `'rejected'` fails with a check constraint violation.
**Why it happens:** The `status` check constraint only allows `('pending', 'processing', 'completed', 'failed')`.
**How to avoid:** If hold/reject statuses are needed, add them to the constraint in the migration. Alternatively, map "reject" to `'failed'` and "hold" to a new `hold_until` timestamp column — simpler.
**Warning signs:** DB error `ERROR: new row violates check constraint`.

### Pitfall 5: Demo data removal requires cleaning `usingDemoData` state
**What goes wrong:** TypeScript build error or React DevTools warning about unused state after removing demo fallbacks.
**Why it happens:** `usingDemoData` state and the demo banner are tightly coupled to the fallback pattern.
**How to avoid:** Remove `usingDemoData` state, the banner JSX, and all `DEMO_*` constants in the same pass.
**Warning signs:** ESLint `no-unused-vars` for `setUsingDemoData` references.

### Pitfall 6: `get_admin_analytics` RPC returns `data.totals.mrr` not `data.mrr`
**What goes wrong:** Revenue stats display as undefined.
**Why it happens:** The RPC wraps all totals under a `totals` key: `data.totals.total_revenue`, `data.totals.mrr`, etc. — but `mrr`, `pro_subscriber_count`, `elite_subscriber_count`, `active_trial_count` are returned at the top-level `data` object (not inside `data.totals`).
**Source:** Reading the latest migration `20260317100000_admin_trial_count.sql` — `mrr` is returned as `data.mrr`, not `data.totals.mrr`.
**Warning signs:** Console shows `undefined` for MRR values; revenue metrics work but subscription counts don't.

The current `AdminDashboard.tsx` reads these correctly (lines 371-374):
```typescript
mrr: Number(data.totals.mrr ?? 0),  // BUG: should be data.mrr
pro_subscriber_count: Number(data.totals.pro_subscriber_count ?? 0),  // BUG: data.pro_subscriber_count
```
Actually inspecting the RPC output format: the `jsonb_build_object` in `20260317100000_admin_trial_count.sql` puts `mrr`, `pro_subscriber_count`, `elite_subscriber_count`, `active_trial_count` at the **top level**, not inside `totals`. The existing dashboard code reads them as `data.totals.mrr` — this is an existing bug to fix in this phase.

---

## Code Examples

### Transactions Tab Query (verified pattern)
```typescript
// Source: Supabase JS embedded resource join (supabase.com/docs)
// Admin RLS policy 'payments_admin_select_all' exists in 20260313120000_admin_role.sql

interface TransactionRow {
  id: string;
  amount: number;
  platform_fee: number;
  trainer_payout: number;
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded';
  created_at: string;
  client_name: string;
  trainer_name: string;
}

const fetchTransactions = useCallback(async () => {
  setLoadingTransactions(true);
  try {
    const { data, error } = await (supabase as any)
      .from('payments')
      .select(`
        id, amount, platform_fee, trainer_payout, status, created_at,
        bookings!inner(
          client:client_id(full_name),
          trainer:trainer_id(profiles:user_id(full_name))
        )
      `)
      .order('created_at', { ascending: false })
      .range(txOffset, txOffset + PAGE_SIZE - 1);
    if (error) throw error;
    // Map nested joins to flat interface
    const rows: TransactionRow[] = (data ?? []).map((p: any) => ({
      id: p.id,
      amount: p.amount,
      platform_fee: p.platform_fee,
      trainer_payout: p.trainer_payout,
      status: p.status,
      created_at: p.created_at,
      client_name: p.bookings?.client?.full_name ?? '—',
      trainer_name: p.bookings?.trainer?.profiles?.full_name ?? '—',
    }));
    setTransactions(rows);
  } catch {
    toast.error('Failed to load transactions');
  } finally {
    setLoadingTransactions(false);
  }
}, [txOffset, txStatusFilter]);
```

### Payout Balance RPC (new function to create in migration)
```sql
-- New function for admin payout balances
CREATE OR REPLACE FUNCTION public.get_admin_payout_balances()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_role text;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN (
    SELECT jsonb_agg(row_to_json(r))
    FROM (
      SELECT
        tp.id AS trainer_id,
        pr.full_name AS trainer_name,
        COALESCE(SUM(p.trainer_payout), 0) AS pending_balance,
        COUNT(*) AS payment_count
      FROM public.trainer_profiles tp
      JOIN public.profiles pr ON pr.id = tp.user_id
      JOIN public.bookings b ON b.trainer_id = tp.id
      JOIN public.payments p ON p.booking_id = b.id
      WHERE p.status = 'succeeded'
        AND p.payout_transaction_id IS NULL
      GROUP BY tp.id, pr.full_name
      HAVING COALESCE(SUM(p.trainer_payout), 0) > 0
      ORDER BY pending_balance DESC
    ) r
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_admin_payout_balances() TO authenticated;
```

### Correct RPC Response Mapping (fix existing MRR bug)
```typescript
// The get_admin_analytics RPC returns mrr/subscriber counts at TOP LEVEL, not inside totals.
// See migration 20260317100000_admin_trial_count.sql jsonb_build_object structure.
setAdminTotals({
  total_revenue: Number(data.totals.total_revenue),
  total_platform_fee: Number(data.totals.total_platform_fee),
  total_payouts: Number(data.totals.total_payouts),
  booking_volume: Number(data.totals.booking_volume),
  mrr: Number(data.mrr ?? 0),                          // top-level, not data.totals.mrr
  pro_subscriber_count: Number(data.pro_subscriber_count ?? 0),
  elite_subscriber_count: Number(data.elite_subscriber_count ?? 0),
  active_trial_count: Number(data.active_trial_count ?? 0),
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Demo data as primary display | Demo data fallback when DB empty | Phase 33 intent | Remove entirely — real zeros are fine |
| Admin queries platform tables directly | SECURITY DEFINER RPCs for aggregation | Phase 10, 13, 16 | Use RPC pattern for new payout balance query too |
| Trainer-initiated payouts only | Admin can trigger payouts | Phase 33 | New edge function parameter or admin-specific function needed |

---

## Migration Plan

Phase 33 requires one new migration file with:

1. **Admin RLS on `payout_transactions`** — SELECT + INSERT + UPDATE policies for admin role
2. **`get_admin_payout_balances()` RPC** — aggregates pending balances per trainer for payouts tab
3. **`get_admin_user_list()` RPC** — joins `auth.users` for email + last_sign_in_at
4. **`payout_transactions` status expansion** — add `'held'` to the CHECK constraint (optional, only if hold feature implemented)

No new tables needed — `payout_transactions` already exists.

---

## Open Questions

1. **Admin payout approval mechanism**
   - What we know: `create-payout` validates `auth.uid()` against trainer ownership; admin calling it for another trainer will fail
   - What's unclear: Whether to add an `admin_target_trainer_id` param to `create-payout` or build a separate `admin-trigger-payout` edge function
   - Recommendation: Add optional `trainer_id` param to `create-payout` with admin role check — minimal new code

2. **Hold status value**
   - What we know: Current `payout_transactions.status` CHECK only allows `pending|processing|completed|failed`
   - What's unclear: Whether "hold" maps to a new status or to a `hold_until` timestamp
   - Recommendation: Add `'held'` to the CHECK constraint in the migration; it maps cleanly to the admin workflow described in CONTEXT.md

3. **`profiles.email` column existence**
   - What we know: `handle_new_user` trigger does NOT copy email from `auth.users` into `profiles`
   - What's unclear: Whether a later migration added an `email` column to `profiles`
   - Recommendation: Use the `get_admin_user_list()` RPC approach which reads directly from `auth.users` — doesn't depend on whether `profiles.email` exists

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (configured in vite.config.ts `test` block) |
| Config file | vite.config.ts (inline `test` config) |
| Quick run command | `npm run test -- --run` |
| Full suite command | `npm run test -- --run` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ADMIN-01 | Users tab shows real profiles with role badges | unit (component smoke) | `npm run test -- --run --reporter=verbose AdminDashboard` | ❌ Wave 0 |
| ADMIN-02 | Suspend/unsuspend users | unit | `npm run test -- --run --reporter=verbose AdminDashboard` | ❌ Wave 0 |
| ADMIN-03 | Analytics shows real booking/revenue data | unit | `npm run test -- --run --reporter=verbose AdminDashboard` | ❌ Wave 0 |
| ADMIN-04 | Subscription tier override works | unit | `npm run test -- --run --reporter=verbose AdminDashboard` | ❌ Wave 0 |
| ADMIN-05 | Transactions tab renders payment list | unit | `npm run test -- --run --reporter=verbose AdminDashboard` | ❌ Wave 0 |
| ADMIN-06 | Payouts tab shows trainer balances | unit | `npm run test -- --run --reporter=verbose AdminDashboard` | ❌ Wave 0 |

Most admin behavior is integration-level (requires live Supabase). Unit tests should focus on:
- Rendering without crash when data is empty
- Correct state transitions (loading -> loaded -> rendered)
- Filter state updates (role filter, status filter, search)

### Sampling Rate
- **Per task commit:** `npm run test -- --run`
- **Per wave merge:** `npm run test -- --run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/pages/AdminDashboard.test.tsx` — smoke tests for new tabs (transactions, payouts), empty state rendering, and filter interactions (mock Supabase client)

*(All existing tests in `src/components/` and `src/hooks/` are unaffected by this phase)*

---

## Sources

### Primary (HIGH confidence)
- `/supabase/migrations/20260313120000_admin_role.sql` — Admin RLS policies on bookings, payments, profiles, trainer_profiles confirmed
- `/supabase/migrations/20260314200000_payout_system.sql` — `payout_transactions` schema and RLS confirmed; admin SELECT gap confirmed
- `/supabase/migrations/20260315000000_analytics_rpc.sql` — `get_admin_analytics` original implementation
- `/supabase/migrations/20260316200000_admin_mrr.sql` — MRR extension; confirms `mrr` is top-level in jsonb result
- `/supabase/migrations/20260317100000_admin_trial_count.sql` — Final `get_admin_analytics` definition with `active_trial_count` at top level
- `/src/pages/AdminDashboard.tsx` — All existing state, queries, tab structure, demo data constants
- `/supabase/functions/create-payout/index.ts` — Confirms `auth.uid()` ownership check; admin bypass required

### Secondary (MEDIUM confidence)
- Supabase docs pattern for `auth.users` access: SECURITY DEFINER function joining `auth.users` is the standard approach (cross-referenced with project's existing SECURITY DEFINER RPC pattern)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed, no new deps
- Architecture: HIGH — patterns read directly from source code
- Pitfalls: HIGH — identified from RLS policy inspection and edge function logic
- Migration requirements: HIGH — confirmed by reading actual SQL constraints

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (stable domain — Supabase schema changes invalidate immediately)
