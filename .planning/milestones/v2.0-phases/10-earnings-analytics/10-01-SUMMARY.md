---
phase: 10-earnings-analytics
plan: "01"
subsystem: database
tags: [postgres, supabase, rpc, analytics, csv, typescript]

# Dependency graph
requires:
  - phase: 09-payout-system
    provides: payments table with amount/platform_fee/trainer_payout, bookings with rate_charged, trainer_profiles with optimized_rate
  - phase: 05-admin-role
    provides: profiles.role IN ('trainer', 'client', 'admin') constraint + admin RLS policies

provides:
  - "get_trainer_analytics RPC: metrics + time-series trend for trainer earnings"
  - "get_trainer_peak_hours RPC: 7x24 heatmap data from slot start_time"
  - "get_admin_analytics RPC: platform totals + top earners, SECURITY DEFINER"
  - "analytics.ts: TimeRange, getDateBounds, getBucketParam, formatBucketLabel, EarningRow, exportEarningsCSV"

affects:
  - 10-02-trainer-analytics-tab
  - 10-03-admin-analytics-tab
  - 10-04-csv-export

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Postgres RPC SECURITY INVOKER with explicit ownership check (auth.uid() vs trainer_profiles.user_id)"
    - "Postgres RPC SECURITY DEFINER with role validation (SELECT role FROM profiles WHERE id = auth.uid())"
    - "date_trunc(p_bucket, ...) parameterized by range — avoids bucket/range mismatch"
    - "NULLIF to prevent division-by-zero in percentage calculations"
    - "Pure TS utility module with no React/Supabase imports — testable in isolation"
    - "RFC 4180 CSV with BOM prefix for Excel UTF-8 compatibility"

key-files:
  created:
    - "Cenlar demand gt 1-17/supabase/migrations/20260315000000_analytics_rpc.sql"
    - "Cenlar demand gt 1-17/src/lib/analytics.ts"
  modified: []

key-decisions:
  - "discount_adoption_pct uses rate_charged < optimized_rate as proxy (definition B from research pitfall 5)"
  - "get_trainer_peak_hours uses availability_slots.start_time not bookings.created_at (avoids pitfall 6)"
  - "p_bucket parameter passed to RPC — granularity determined by TimeRange in getBucketParam (avoids pitfall 2)"
  - "EarningRow.gross/.net are numeric — exportEarningsCSV calls .toFixed(2) for CSV formatting"
  - "getBucketParam exported separately from formatBucketLabel — allows RPC callers to reuse bucket logic"

patterns-established:
  - "Pattern: All analytics aggregation in Postgres RPC — TypeScript only formats and renders"
  - "Pattern: getBucketParam(range) → p_bucket param → date_trunc(p_bucket, ...) in SQL"
  - "Pattern: exportEarningsCSV takes EarningRow[] — caller fetches data once, reuses for display + export"

requirements-completed: [ANALYTICS-01, ANALYTICS-02, ANALYTICS-03, ANALYTICS-04, ANALYTICS-05, ANALYTICS-06]

# Metrics
duration: 6min
completed: 2026-03-15
---

# Phase 10 Plan 01: Analytics Data Foundation Summary

**Three Postgres RPC functions (trainer metrics, peak hours heatmap, admin totals) + pure TypeScript analytics.ts utility with date math, bucket mapping, label formatting, and RFC 4180 CSV export**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-15T02:14:10Z
- **Completed:** 2026-03-15T02:15:40Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created `20260315000000_analytics_rpc.sql` with three production-ready Postgres functions, each with appropriate security model and admin/ownership validation
- Created `src/lib/analytics.ts` with all 6 exports needed by downstream UI plans (ANALYTICS-01 through ANALYTICS-06 data layer complete)
- Build passes cleanly at both commits with zero TypeScript errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Postgres analytics RPC migration** - `f43b970` (feat)
2. **Task 2: analytics.ts utility library** - `dce76cd` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `Cenlar demand gt 1-17/supabase/migrations/20260315000000_analytics_rpc.sql` — Three RPC functions: trainer analytics, peak hours, admin analytics
- `Cenlar demand gt 1-17/src/lib/analytics.ts` — Pure TS utilities: TimeRange, EarningRow, getDateBounds, getBucketParam, formatBucketLabel, exportEarningsCSV

## Decisions Made
- discount_adoption_pct uses `rate_charged < optimized_rate` as the "discount applied" proxy per research pitfall 5 (definition B — most reliable signal in current schema)
- Peak hours function joins to `availability_slots.start_time` not `bookings.created_at` to show actual session times (research pitfall 6)
- `p_bucket` is a parameter to the RPC, not hardcoded — TimeRange-to-bucket mapping lives in `getBucketParam()` in the TS layer
- `getBucketParam` exported as a separate function so UI components can compute both the RPC param and the label format from one call

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None - admin role confirmed as `'admin'` value in `profiles.role` from `20260313120000_admin_role.sql` migration, resolving the open question from research.

## User Setup Required
None - no external service configuration required. RPC functions deploy with the migration; no Vault secrets or Edge Function config needed.

## Next Phase Readiness
- Data layer is complete — Plans 10-02 (trainer AnalyticsTab) and 10-03 (admin analytics extension) can proceed
- `analytics.ts` exports are stable and typed — import `{ getDateBounds, getBucketParam, formatBucketLabel, exportEarningsCSV, TimeRange, EarningRow }` from `@/lib/analytics`
- RPC function signatures: `get_trainer_analytics(p_trainer_id, p_start, p_end, p_bucket)`, `get_trainer_peak_hours(p_trainer_id, p_start, p_end)`, `get_admin_analytics(p_start, p_end, p_bucket)`

## Self-Check: PASSED

- FOUND: `Cenlar demand gt 1-17/supabase/migrations/20260315000000_analytics_rpc.sql`
- FOUND: `Cenlar demand gt 1-17/src/lib/analytics.ts`
- FOUND: `.planning/phases/10-earnings-analytics/10-01-SUMMARY.md`
- FOUND commit: `f43b970` (Task 1 — analytics RPC migration)
- FOUND commit: `dce76cd` (Task 2 — analytics.ts utility library)

---
*Phase: 10-earnings-analytics*
*Completed: 2026-03-15*
