---
phase: 14-feature-gates-+-search
plan: "03"
subsystem: ui
tags: [react, typescript, tier-gates, feature-flags, zustand]

# Dependency graph
requires:
  - phase: 14-feature-gates-+-search
    plan: "01"
    provides: useTier(), useCan(), TierFeature type, TIER_GATES registry
  - phase: 12-subscription-foundation
    provides: subscription_tier column on trainer_profiles
affects:
  - 15-subscription-ui (upgrade CTA placeholder in LockedFeatureBanner)
  - 16-admin-subscription (no inline tier comparisons needed in trainer dashboard)

provides:
  - LockedFeatureBanner reusable component (all 6 TierFeature values covered)
  - Analytics tab gated via useCan('analytics_advanced') in TrainerDashboard
  - Slot visibility hint in overview tab (Free: "3 of N visible to clients")

# Tech tracking
tech-stack:
  added: []
  patterns:
    - LockedFeatureBanner as the standard locked-state UI — import and pass feature + tier props
    - useCan(feature) gate pattern at render site — ternary between real content and LockedFeatureBanner
    - FEATURE_COPY + FEATURE_NAMES maps in LockedFeatureBanner for all current TierFeature values

key-files:
  created:
    - "Cenlar demand gt 1-17/src/components/shared/LockedFeatureBanner.tsx"
  modified:
    - "Cenlar demand gt 1-17/src/pages/TrainerDashboard.tsx"

key-decisions:
  - "LockedFeatureBanner uses FEATURE_NAMES map for human-readable titles — avoids string manipulation from label field"
  - "Tab label remains in tab bar for all tiers (discovery UX) — only content is gated, not the tab button"
  - "Slot hint uses tier === 'free' check directly (not useCan) — this is an informational display, not access control"

patterns-established:
  - "LockedFeatureBanner pattern: import component, pass feature and tier props, renders copy from FEATURE_COPY map"
  - "Tier hint pattern: conditional paragraph after stat number using tier === 'free' check"

requirements-completed:
  - TIER-05
  - TIER-06

# Metrics
duration: 3min
completed: 2026-03-16
---

# Phase 14 Plan 03: Trainer Dashboard Feature Gates Summary

**Analytics tab gated via useCan('analytics_advanced') with LockedFeatureBanner for Free trainers, plus slot visibility hint showing '3 of N visible to clients' in the overview stats card**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-16T21:50:37Z
- **Completed:** 2026-03-16T21:53:30Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments
- LockedFeatureBanner ships: covers all 6 TierFeature values, matches FitRush design (border container, uppercase tracking label, serif title, text-ink/50 description, no rounded corners)
- Analytics tab gated: Free trainers see LockedFeatureBanner, Pro/Elite/Trialing see AnalyticsTab; tab label always visible for discovery
- Slot visibility hint: Free trainers with >3 slots see amber "3 of N visible to clients" warning; those with <=3 see a soft upgrade nudge

## Task Commits

Each task was committed atomically:

1. **Task 1: Create LockedFeatureBanner component** - `642823b` (feat)
2. **Task 2: Gate analytics tab and add slot visibility hint** - `28a56fa` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `Cenlar demand gt 1-17/src/components/shared/LockedFeatureBanner.tsx` - Reusable locked-feature banner; FEATURE_COPY and FEATURE_NAMES maps for all 6 TierFeature values; Tier + TierFeature types imported from tierGates.ts
- `Cenlar demand gt 1-17/src/pages/TrainerDashboard.tsx` - Added useTier/useCan/LockedFeatureBanner imports; canAnalytics gates analytics tab content; slot visibility hint added to Available Slots stat card

## Decisions Made
- Tab label stays in tab bar for all tiers — Free trainers can see the "analytics" tab exists but see LockedFeatureBanner when they click it (discovery UX, not hidden gating)
- Slot hint uses direct `tier === 'free'` check rather than `useCan` — it's an informational display about data visibility, not a feature access gate
- FEATURE_NAMES map added to LockedFeatureBanner to avoid brittle string manipulation from the label field (plan showed `copy.label.replace(' Feature', '')` — replaced with explicit map)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Replaced brittle label string manipulation with FEATURE_NAMES map**
- **Found during:** Task 1 (LockedFeatureBanner creation)
- **Issue:** Plan specified `copy.label.replace(' Feature', '')` for feature name display — fragile string manipulation that would break if label format changes
- **Fix:** Added explicit `FEATURE_NAMES: Record<TierFeature, string>` map with correct human-readable names for all 6 features
- **Files modified:** `Cenlar demand gt 1-17/src/components/shared/LockedFeatureBanner.tsx`
- **Verification:** TypeScript compiles, all feature names correct
- **Committed in:** `642823b` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug/fragile code)
**Impact on plan:** Minor improvement — more maintainable than plan's string manipulation approach. No scope change.

## Issues Encountered
None — TypeScript compiled clean on first pass, all 20 tests remained GREEN after changes.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- LockedFeatureBanner ready for Phase 15 (Subscription UI) to add upgrade CTA link inside the placeholder comment
- All 4 must-haves satisfied: Free sees banner, Pro/Elite/Trialing see analytics, slot hint displays, trialing trainers get full access via useCan trial bypass
- No blockers for Plan 04 (search priority gates)

## Self-Check

- [x] `Cenlar demand gt 1-17/src/components/shared/LockedFeatureBanner.tsx` — created
- [x] `Cenlar demand gt 1-17/src/pages/TrainerDashboard.tsx` — modified (imports, hooks, gate, hint)
- [x] commit `642823b` — Task 1
- [x] commit `28a56fa` — Task 2
- [x] TypeScript: no errors in TrainerDashboard or LockedFeatureBanner
- [x] 20/20 tests GREEN (vitest run)

## Self-Check: PASSED

---
*Phase: 14-feature-gates-+-search*
*Completed: 2026-03-16*
