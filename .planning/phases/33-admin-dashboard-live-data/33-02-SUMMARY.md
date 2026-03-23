---
phase: 33-admin-dashboard-live-data
plan: 02
subsystem: ui
tags: [react, supabase, admin, analytics, payments]

requires:
  - phase: 33-01
    provides: get_admin_analytics RPC with top-level mrr/pro_subscriber_count/elite_subscriber_count/active_trial_count keys

provides:
  - AdminDashboard with live-only analytics (no demo fallback)
  - Corrected MRR mapping reading from data.mrr not data.totals.mrr
  - Transactions tab with payment list, client/trainer names, status badges, filter, and load-more pagination
  - Clean removal of all demo data constants and usingDemoData state

affects: [admin-dashboard, analytics-tab, transactions-tab, payments]

tech-stack:
  added: []
  patterns:
    - "Admin dashboard fetch functions: on error show real zeros + toast.error, no demo fallback"
    - "Transactions table pattern: supabase as any query with bookings!inner join, map to typed row, paginate with offset + TX_PAGE_SIZE"

key-files:
  created: []
  modified:
    - "Cenlar demand gt 1-17/src/pages/AdminDashboard.tsx"

key-decisions:
  - "Demo data removed entirely — real zeros are fine for a new platform, demo preview was misleading admins about actual data state"
  - "RPC response cast to any via const data = rawData as any to satisfy Supabase Json type without breaking access to nested fields"
  - "Transactions useEffect depends on fetchTransactions (which depends on txStatusFilter) so filter changes automatically re-fetch from offset 0"

patterns-established:
  - "supabase.rpc result cast: const data = rawData as any — use when RPC returns jsonb with dynamic keys that TypeScript Json type won't index"

requirements-completed: [ADMIN-03, ADMIN-05]

duration: 6min
completed: 2026-03-23
---

# Phase 33 Plan 02: Admin Dashboard Live Data — UI Layer Summary

**Stripped all demo/mock data from AdminDashboard.tsx, fixed MRR top-level key mapping bug, and added Transactions tab with payment list, status filter, and load-more pagination**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-03-23T07:58:08Z
- **Completed:** 2026-03-23T08:04:09Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Deleted DEMO_TOTALS, DEMO_TOP_EARNERS, DEMO_USERS constants and all associated fallback logic
- Fixed MRR bug: `data.totals.mrr` changed to `data.mrr` (and same for pro_subscriber_count, elite_subscriber_count, active_trial_count) to match the actual RPC jsonb_build_object structure from the 20260317 migration
- Added Transactions tab: queries payments table with bookings join for client/trainer names, status badge coloring, filter bar, and load-more pagination (25 per page)

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove all demo data and fix MRR response mapping bug** - `e8af8d0` (feat)
2. **Task 2: Add Transactions tab with payment list, status filter, and pagination** - `4634699` (feat)

**Plan metadata:** `(this commit)` (docs: complete plan)

## Files Created/Modified
- `Cenlar demand gt 1-17/src/pages/AdminDashboard.tsx` - Removed 108 lines of demo data, fixed MRR key mapping, added TransactionRow interface + fetchTransactions + Transactions tab JSX (+148 lines net)

## Decisions Made
- Demo data removed entirely rather than kept behind a toggle — real zeros on a new platform are accurate and not misleading
- RPC response cast to `any` (via `const data = rawData as any`) to satisfy Supabase's `Json` return type while still accessing nested fields like `data.totals.total_revenue`
- Transactions `useEffect` depends on the `fetchTransactions` callback (which captures `txStatusFilter`) so changing the filter automatically resets offset and re-fetches

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added `as any` cast for RPC response to satisfy TypeScript**
- **Found during:** Task 1 (after removing demo fallback, tsc revealed `data` is `Json` type)
- **Issue:** `supabase.rpc` returns `Json` type which has no `.totals` or `.mrr` properties per TypeScript, causing compile errors at lines 296-313
- **Fix:** Destructured as `rawData` then immediately cast: `const data = rawData as any`
- **Files modified:** `Cenlar demand gt 1-17/src/pages/AdminDashboard.tsx`
- **Verification:** `npx tsc --noEmit` shows zero AdminDashboard.tsx errors
- **Committed in:** `e8af8d0` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Required for correct TypeScript compilation. Consistent with existing `supabase as any` pattern used throughout the file.

## Issues Encountered
None — the TypeScript cast was a predictable follow-on from removing the demo fallback that previously bypassed the type error path.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Admin dashboard now shows live data only; analytics and transactions tabs are fully functional
- Payouts tab (added to tab bar) still shows nothing — that tab content is not yet implemented (out of scope for this plan)
- Ready to proceed with remaining admin-dashboard-live-data plans if any, or move to next phase

---
*Phase: 33-admin-dashboard-live-data*
*Completed: 2026-03-23*
