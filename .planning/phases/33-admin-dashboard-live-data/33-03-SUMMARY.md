---
phase: 33-admin-dashboard-live-data
plan: "03"
subsystem: admin-dashboard
tags: [admin, payouts, users, rpc, live-data]
dependency_graph:
  requires: ["33-01", "33-02"]
  provides: ["payouts-tab", "users-tab-upgraded"]
  affects: ["AdminDashboard.tsx"]
tech_stack:
  added: []
  patterns:
    - "Client-side filter after full RPC fetch for responsive UX"
    - "supabase.functions.invoke with trainer_id body for admin payout bypass"
    - "Flat RPC response fields instead of nested join objects"
key_files:
  created: []
  modified:
    - "Cenlar demand gt 1-17/src/pages/AdminDashboard.tsx"
decisions:
  - "Used (supabase as any).rpc() cast for new RPCs not yet in generated Supabase types"
  - "Client-side filtering in fetchUsers keeps the RPC call minimal and filter changes instant"
  - "Approve payout passes trainer_user_id (not trainer_profile_id) to create-payout edge function to match its existing user_id lookup logic"
metrics:
  duration: "~7 minutes"
  completed_date: "2026-03-23"
  tasks_completed: 2
  files_modified: 1
---

# Phase 33 Plan 03: Payouts Tab and Users Tab Live Data Summary

**One-liner:** Payouts tab with per-trainer approve/hold controls via create-payout edge function, plus Users tab upgraded to get_admin_user_list RPC with email, last login, and role/status filtering.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Add Payouts tab with trainer balances and approve/hold controls | 1eee7ed | AdminDashboard.tsx |
| 2 | Upgrade Users tab with email, last login, role/status filters via RPC | 1eee7ed | AdminDashboard.tsx |

## What Was Built

### Payouts Tab (new)
- `PayoutBalance` interface matching `get_admin_payout_balances` RPC output
- `PayoutHistoryRow` interface for `payout_transactions` query
- `fetchPayoutBalances` callback calling `(supabase as any).rpc('get_admin_payout_balances')`
- `fetchPayoutHistory` callback querying `payout_transactions` table (last 50 rows)
- `handleApprovePayout`: validates Stripe account + $50 minimum, calls `supabase.functions.invoke('create-payout', { body: { trainer_id } })`, refreshes both lists
- `handleHoldPayout`: inserts `{ status: 'held', initiated_by: 'admin' }` row into `payout_transactions`, refreshes both lists
- JSX: trainer balances table with approve (disabled if no Stripe account or <$50) and hold buttons, plus payout history table with color-coded status badges

### Users Tab (upgraded)
- `UserRow` interface extended with `email`, `last_sign_in_at`, and flat subscription fields (`subscription_tier`, `subscription_status`, `tier_overridden_by`, `tier_overridden_at`) — removed nested `trainer_profiles` object
- `fetchUsers` replaced: now calls `get_admin_user_list` RPC, then applies client-side role/status/search filtering
- Filter state: `roleFilter` (all/trainer/client/admin) and `statusFilter` (all/active/suspended)
- Table header updated: 8-column grid adding Email and Last Login columns
- User rows updated: show `user.email`, `user.last_sign_in_at` (with "Never" fallback), flat `user.subscription_tier` / `user.subscription_status`
- Search placeholder updated to "Search by name or email..."
- Override display uses flat `user.tier_overridden_at` (not `user.trainer_profiles?.tier_overridden_at`)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] Supabase RPC type system does not include new RPCs**
- **Found during:** Task 1 and Task 2 TypeScript compilation
- **Issue:** `supabase.rpc('get_admin_payout_balances')` and `supabase.rpc('get_admin_user_list')` fail TypeScript type check because the generated types file only knows about RPCs registered at type-generation time
- **Fix:** Cast to `(supabase as any).rpc(...)` — consistent with how `fetchTransactions` already uses `(supabase as any).from(...)` throughout the file
- **Files modified:** AdminDashboard.tsx
- **Commit:** 1eee7ed

## Verification

- `npx tsc --noEmit` — 0 errors in AdminDashboard.tsx (pre-existing errors in other files are out of scope)
- `npm run build` — succeeded, 3024 modules transformed
- Payouts tab calls `get_admin_payout_balances` RPC
- Approve button calls `create-payout` with `trainer_id` body param
- Hold button inserts `payout_transactions` row with `status: 'held'`
- Users tab calls `get_admin_user_list` RPC
- Users tab shows email and `last_sign_in_at` columns
- Role (all/trainer/client/admin) and status (all/active/suspended) filters wired to state
- Search filters by name AND email
- Existing suspend/unsuspend and tier override still functional (uses `user.id`)
- No `DEMO_USERS` references remain
- No `trainer_profiles?.subscription_tier` references remain

## Self-Check: PASSED

- AdminDashboard.tsx modified: FOUND
- Commit 1eee7ed: FOUND
- `interface PayoutBalance`: FOUND (line 39)
- `get_admin_payout_balances` RPC call: FOUND (line 286)
- `handleApprovePayout` with `functions.invoke('create-payout'`: FOUND (line 314)
- `handleHoldPayout` with `status: 'held'`: FOUND (line 339)
- `activeTab === 'payouts'` JSX: FOUND (line 803)
- `get_admin_user_list` RPC call: FOUND (line 203)
- `roleFilter` state: FOUND (line 159)
- `statusFilter` state: FOUND (line 160)
- `user.email` in row: FOUND (line 987)
- `user.last_sign_in_at` in row: FOUND (line 1001)
- "Search by name or email": FOUND (line 913)
