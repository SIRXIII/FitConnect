---
phase: 33
plan: "01"
subsystem: admin-polish
tags: [admin, mock-data, terms, privacy, build, tests]
dependency_graph:
  requires: []
  provides: [clean-trainer-search, real-terms-privacy, admin-verified]
  affects: [landing-page, search-section, admin-dashboard]
tech_stack:
  added: []
  patterns: [empty-state-over-mock-fallback]
key_files:
  modified:
    - Cenlar demand gt 1-17/src/components/search/SearchSection.tsx
    - Cenlar demand gt 1-17/src/components/landing/BestDeals.tsx
    - Cenlar demand gt 1-17/src/pages/AdminDashboard.test.tsx
decisions:
  - "Admin dashboard retains demo data preview mode (DEMO_USERS/DEMO_TOTALS) since it's admin-only and clearly labeled — this is intentional for a new platform with no data yet"
  - "BestDeals section hides entirely when no real discounted trainers exist rather than showing fake data"
  - "SearchSection shows 'No trainers available yet' empty state instead of falling back to MOCK_TRAINERS"
metrics:
  duration: "7 minutes"
  completed: "2026-03-20"
  tasks_completed: 6
  files_modified: 3
---

# Phase 33 Plan 01: Admin & Production Polish Summary

**One-liner:** Mock trainer fallbacks removed from public-facing search and deals sections, admin dashboard verified functional with all four ADMIN requirements met, build passes clean, all 140 tests green.

## Tasks Completed

| Task | Requirement | Status | Notes |
|------|-------------|--------|-------|
| 1 | ADMIN-01 through ADMIN-04 | Verified | All present in AdminDashboard.tsx: role badges, suspend/unsuspend, analytics, subscription override |
| 2 | POLISH-02 | Fixed | Removed MOCK_TRAINERS fallback from SearchSection and BestDeals |
| 3 | POLISH-01 | Verified | Tagline "Every idle hour is untapped revenue." at TrainerDashboard.tsx line 188 |
| 4 | POLISH-07, POLISH-08 | Verified | Terms and Privacy pages have proper structured sections, no placeholder text |
| 5 | POLISH-04, POLISH-05 | Verified | SearchSection uses TrainerCardSkeleton, AdminDashboard shows spinner during load |
| 6 | PERF-01, PERF-03, PERF-04 | Verified | Build clean (2.15s), all 140 tests pass |

## Admin Dashboard Verification (ADMIN-01 through ADMIN-04)

- **ADMIN-01 (User list with role badges):** `fetchUsers` queries `profiles` joined with `trainer_profiles`, `TierBadge` component renders tier/status per row. Role column shows trainer/client.
- **ADMIN-02 (Suspend/Unsuspend):** `handleSuspend` toggles `is_suspended` on profiles table, updates local state, shows toast.
- **ADMIN-03 (Platform analytics):** `get_admin_analytics` RPC call with time range, renders revenue, fee, payouts, booking volume, MRR, subscriber counts.
- **ADMIN-04 (Subscription override):** `handleOverride` calls `setAdminTierOverride`, 3-tier selector per trainer row. Override indicator shows when `tier_overridden_by` is set.

Note: AdminDashboard intentionally keeps `DEMO_USERS` / `DEMO_TOTALS` / `DEMO_TOP_EARNERS` for admin preview — clearly labeled "Showing demo data — connect live data to replace". This is appropriate since it is an admin-only internal tool on a new platform.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] AdminDashboard.test.tsx column count assertion was stale**
- **Found during:** Task 6 (build verification / test run)
- **Issue:** Test expected 5-column grid `grid-cols-[1fr_100px_120px_120px_120px]` but implementation has evolved to 6 columns `grid-cols-[1fr_100px_120px_100px_120px_140px]` (added Override column)
- **Fix:** Updated test description and assertion to match actual 6-column layout
- **Files modified:** `src/pages/AdminDashboard.test.tsx`
- **Commit:** b31ca3f

## Self-Check: PASSED

- SearchSection.tsx: FOUND, MOCK_TRAINERS removed
- BestDeals.tsx: FOUND, MOCK_TRAINERS removed
- Commit b31ca3f: FOUND
- Build: clean (2.15s)
- Tests: 140/140 passed
