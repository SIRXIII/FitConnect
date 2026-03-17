---
phase: 14-feature-gates-+-search
plan: "02"
subsystem: database
tags: [postgres, supabase, triggers, rpc, react, typescript]

# Dependency graph
requires:
  - phase: 12-subscription-foundation
    provides: get_visible_slots RPC (SECURITY DEFINER, tier-limited slot fetch) and subscription_tier column on trainer_profiles
  - phase: 14-feature-gates-+-search
    provides: 14-01 plan (prior tasks in this phase)
provides:
  - enforce_bio_tier_limit BEFORE UPDATE trigger on trainer_profiles (free<=280, pro/elite<=1000 chars)
  - TrainerProfile.tsx fetchSlots wired to get_visible_slots RPC (no direct availability_slots query)
affects:
  - 15-subscription-ui (upgrade prompts when bio save fails or slot limit hit)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "BEFORE UPDATE trigger with IS DISTINCT FROM OLD.col guards per-column changes without touching unmodified rows"
    - "supabase as any cast for unregistered RPCs (consistent with ReferralLeaderboard, AnalyticsTab pattern)"

key-files:
  created:
    - "Cenlar demand gt 1-17/supabase/migrations/20260317000000_bio_tier_limit.sql"
  modified:
    - "Cenlar demand gt 1-17/src/pages/TrainerProfile.tsx"

key-decisions:
  - "Bio trigger fires only on IS DISTINCT FROM OLD.bio — existing long bios preserved on trainer downgrade"
  - "supabase cast to any for get_visible_slots RPC — consistent with project-wide pattern for unregistered RPCs"

patterns-established:
  - "Tier enforcement via Postgres trigger: BEFORE UPDATE, IS DISTINCT FROM, COALESCE(subscription_tier, 'free')"
  - "Client-facing slot fetch via get_visible_slots RPC — never query availability_slots table directly from TrainerProfile"

requirements-completed:
  - TIER-01
  - TIER-02
  - TIER-03
  - TIER-06

# Metrics
duration: 2min
completed: 2026-03-16
---

# Phase 14 Plan 02: Feature Gates + Search — Slot RPC Wire + Bio Trigger Summary

**Postgres trigger blocks bio saves >280 chars for free trainers; TrainerProfile.tsx fetches slots via tier-enforcing get_visible_slots RPC instead of direct table query**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-16T21:45:21Z
- **Completed:** 2026-03-16T21:47:05Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Deployed `enforce_bio_tier_limit` BEFORE UPDATE trigger on `trainer_profiles` — free trainers receive a Postgres exception when attempting bio saves >280 characters; existing long bios (pre-downgrade) are untouched
- Replaced direct `availability_slots` table query in `TrainerProfile.tsx fetchSlots` with `supabase.rpc('get_visible_slots')` — slot limits now enforced at Postgres level (free=3, pro=10, elite=unlimited) and cannot be bypassed by client-side queries
- Realtime subscription on `availability_slots` table preserved — it only triggers `fetchSlots()` on changes, not a direct query

## Task Commits

Each task was committed atomically:

1. **Task 1: Create bio tier limit migration** - `9dc979a` (feat)
2. **Task 2: Replace direct slot fetch with get_visible_slots RPC** - `d9d66f0` (feat)

## Files Created/Modified

- `Cenlar demand gt 1-17/supabase/migrations/20260317000000_bio_tier_limit.sql` - enforce_bio_tier_limit() function + trigger; applied via supabase db push
- `Cenlar demand gt 1-17/src/pages/TrainerProfile.tsx` - fetchSlots now calls get_visible_slots RPC; cast to any for unregistered RPC type

## Decisions Made

- Bio trigger fires only when `NEW.bio IS DISTINCT FROM OLD.bio` — existing oversized bios are preserved on downgrade; trigger only gates new/changed content
- Casting `supabase as any` for the RPC call is consistent with how `get_referral_leaderboard`, `get_trainer_analytics`, and `get_admin_analytics` are called throughout the project (Supabase auto-generated types don't include manually created RPCs)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Cast supabase to any for get_visible_slots RPC to resolve TypeScript error**
- **Found during:** Task 2 (Replace direct slot fetch with RPC)
- **Issue:** TypeScript error TS2345 — `get_visible_slots` not in Supabase generated types, making the RPC param type `never`; secondary error TS2352 on the cast to AvailabilitySlot[]
- **Fix:** Added `(supabase as any).rpc(...)` cast with eslint-disable comment, matching the existing pattern for unregistered RPCs in ReferralLeaderboard, AnalyticsTab, and AdminDashboard
- **Files modified:** Cenlar demand gt 1-17/src/pages/TrainerProfile.tsx
- **Verification:** `npx tsc --noEmit` shows zero TrainerProfile.tsx errors
- **Committed in:** d9d66f0 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - type compatibility bug)
**Impact on plan:** Required for TypeScript compilation. No scope creep — matched existing project-wide pattern.

## Issues Encountered

None beyond the RPC type cast deviation above.

## User Setup Required

None — migration applied via `supabase db push`, no manual Supabase Studio steps needed.

## Next Phase Readiness

- Slot visibility gate is now authoritative at DB level — client-facing booking view always respects tier limits
- Bio character enforcement is server-side — cannot be bypassed by direct Supabase client writes
- Phase 14 Plan 03 (if exists) or Phase 15 Subscription UI can now build upgrade prompts triggered by the bio RAISE EXCEPTION and slot limit behavior

---
*Phase: 14-feature-gates-+-search*
*Completed: 2026-03-16*

## Self-Check: PASSED

- FOUND: Cenlar demand gt 1-17/supabase/migrations/20260317000000_bio_tier_limit.sql
- FOUND: Cenlar demand gt 1-17/src/pages/TrainerProfile.tsx
- FOUND: .planning/phases/14-feature-gates-+-search/14-02-SUMMARY.md
- FOUND commit: 9dc979a (Task 1)
- FOUND commit: d9d66f0 (Task 2)
