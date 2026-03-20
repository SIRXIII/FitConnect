---
phase: 25-ai-trainer-client-matching
plan: "02"
subsystem: ui
tags: [react, typescript, zustand, tailwind, supabase, localStorage]

# Dependency graph
requires:
  - phase: 25-01
    provides: matchScoring.ts with rankAndFilter, isPassportReady, getCachedMatches, setCachedMatches, MatchResult types

provides:
  - useMatchedTrainers hook: fetches client_profiles, runs scoring, applies 24hr localStorage cache
  - RecommendedTrainerCard: avatar, name, specialty, rate, match score%, tier label, explanation bullets, View Profile CTA
  - PassportPromptCard: inline prompt with Sparkles icon, heading, body, CTA to /client/passport
  - RecommendedCarousel: gate check + carousel or prompt card, with loading skeletons
  - SearchSection integration: carousel rendered above AnimatePresence results in list view only

affects:
  - SearchSection
  - client-facing recommendation surface
  - Fitness Passport conversion funnel

# Tech tracking
tech-stack:
  added: []
  patterns:
    - CarouselInner inner component pattern to avoid conditional hook calls in RecommendedCarousel
    - (supabase as any) cast for client_profiles query (project convention — no TS type regen mid-phase)
    - Initials fallback for missing avatar_url in trainer card
    - 24hr localStorage cache checked before any Supabase fetches

key-files:
  created:
    - Cenlar demand gt 1-17/src/hooks/useMatchedTrainers.ts
    - Cenlar demand gt 1-17/src/components/recommendations/RecommendedTrainerCard.tsx
    - Cenlar demand gt 1-17/src/components/recommendations/PassportPromptCard.tsx
    - Cenlar demand gt 1-17/src/components/recommendations/RecommendedCarousel.tsx
  modified:
    - Cenlar demand gt 1-17/src/components/search/SearchSection.tsx

key-decisions:
  - "CarouselInner inner component used to avoid conditional hook call in RecommendedCarousel role-gate block"
  - "Pre-existing AdminDashboard.test.tsx failure (grid-cols assertion) is out of scope — unrelated to matching UI"

patterns-established:
  - "Inner component pattern for conditional hook usage: outer gates (user/role), inner runs hooks"
  - "Silent null return on fetch error — recommendation carousel is non-critical path, main grid unaffected"

requirements-completed: [AIMATCH-01, AIMATCH-02, AIMATCH-03, AIMATCH-04]

# Metrics
duration: 2min
completed: 2026-03-19
---

# Phase 25 Plan 02: AI Trainer-Client Matching — Recommendation UI Summary

**"Recommended for You" carousel with match scores, explanation bullets, passport gate, and 24hr localStorage cache wired into SearchSection list view**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-19T19:44:18Z
- **Completed:** 2026-03-19T19:46:34Z
- **Tasks:** 2
- **Files modified:** 5 (4 created, 1 modified)

## Accomplishments

- Built `useMatchedTrainers` hook that gates on passport completeness, checks 24hr localStorage cache, fetches client profile + trainers, and runs `rankAndFilter` from matchScoring.ts
- Built `RecommendedTrainerCard` with avatar/initials fallback, rate display, match score%, tier label, explanation bullets, and View Profile CTA per UI-SPEC
- Built `PassportPromptCard` inline prompt card with Sparkles icon, heading, body copy, and CTA link
- Built `RecommendedCarousel` with loading skeleton (3 TrainerCardSkeleton), role gate (trainer → null), auth gate (no user → null), passport gate (PassportPromptCard), empty gate (null), and populated carousel with section header
- Integrated `RecommendedCarousel` into `SearchSection.tsx` above AnimatePresence results, list view only

## Task Commits

1. **Task 1: useMatchedTrainers hook + RecommendedTrainerCard + PassportPromptCard** - `8d5a9c4` (feat)
2. **Task 2: RecommendedCarousel + SearchSection integration** - `dd2a7e0` (feat)

## Files Created/Modified

- `src/hooks/useMatchedTrainers.ts` - Custom hook: cache check → client_profiles fetch → isPassportReady gate → trainer fetch → rankAndFilter → setCachedMatches
- `src/components/recommendations/RecommendedTrainerCard.tsx` - Individual match card with avatar, score badge, reasons, View Profile CTA
- `src/components/recommendations/PassportPromptCard.tsx` - Inline passport completion prompt with Sparkles icon and /client/passport CTA
- `src/components/recommendations/RecommendedCarousel.tsx` - Wrapper with role/auth gates and CarouselInner with all render states
- `src/components/search/SearchSection.tsx` - Added RecommendedCarousel import and `{viewMode === 'list' && <RecommendedCarousel />}` insertion

## Decisions Made

- Used CarouselInner inner component to avoid conditional hook calls — outer `RecommendedCarousel` handles user/role gates and returns null before hooks, inner `CarouselInner` always calls `useMatchedTrainers`
- Pre-existing `AdminDashboard.test.tsx` failure (`grid-cols` assertion in users table test) is out of scope — completely unrelated to recommendation UI, exists prior to this plan

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Recommendation carousel fully wired; clients with completed Fitness Passport will see up to 3 personalized trainer matches above the search grid
- Phase 25 complete — ready for Phase 26 (AI Discount Analytics) or any follow-on phase
- Pre-existing AdminDashboard test failure should be addressed separately (out of scope here)

---
*Phase: 25-ai-trainer-client-matching*
*Completed: 2026-03-19*
