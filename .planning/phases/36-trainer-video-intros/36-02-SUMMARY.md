---
phase: 36-trainer-video-intros
plan: "02"
subsystem: trainer-profile, search
tags: [video, trainer-profile, trainer-card, search-results]
dependency_graph:
  requires: [36-01]
  provides: [trainer-video-display, trainer-card-video-badge]
  affects: [TrainerProfile, TrainerCard, SearchSection]
tech_stack:
  added: []
  patterns: [html5-video-element, conditional-badge-overlay]
key_files:
  created: []
  modified:
    - Cenlar demand gt 1-17/src/pages/TrainerProfile.tsx
    - Cenlar demand gt 1-17/src/components/search/TrainerCard.tsx
    - Cenlar demand gt 1-17/src/components/search/SearchSection.tsx
    - Cenlar demand gt 1-17/src/types/index.ts
decisions:
  - "Video section placed between bio and workout locations in the right column of TrainerProfile"
  - "intro_video_url added to legacy Trainer interface and mapped in dbTrainerToCardData — avoids changing TrainerCard to accept TrainerWithProfile directly"
metrics:
  duration: "~10 minutes"
  completed: "2026-03-21T02:44:15Z"
  tasks_completed: 2
  files_changed: 4
---

# Phase 36 Plan 02: Trainer Video Display Summary

HTML5 inline video player on trainer public profiles and a gold "Video" badge on trainer search cards — closes the client-facing side of the video intro feature.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Video player on trainer profile | c50abdb | src/pages/TrainerProfile.tsx |
| 2 | Video badge on trainer cards | a9e9986 | src/components/search/TrainerCard.tsx, SearchSection.tsx, types/index.ts |

## What Was Built

- **TrainerProfile.tsx**: Added `{trainer.intro_video_url && ...}` section between bio and workout locations. HTML5 `<video>` element with `controls`, `poster` (thumbnail), `preload="metadata"`, `playsInline` (iOS). Hover autoplay on desktop (muted).
- **TrainerCard.tsx**: Gold `#C5A059` pill badge with play icon at bottom-left of avatar image. Shows only when `intro_video_url` is set.
- **SearchSection.tsx**: `dbTrainerToCardData` maps `intro_video_url` from `TrainerWithProfile` to the legacy `Trainer` shape. Since `useTrainers` already uses `select('*')`, no query changes needed.
- **types/index.ts**: Added `intro_video_url?: string | null` to `Trainer` interface.

## Deviations from Plan

None - plan executed exactly as written. The `useTrainerById` hook's `select('*')` automatically includes new columns added by the migration, so no query modifications were needed.

## Self-Check: PASSED

- [x] TrainerProfile.tsx conditionally renders video element when intro_video_url is non-null (line 404)
- [x] TrainerCard.tsx shows gold Video badge when intro_video_url is set (line 30)
- [x] intro_video_url mapped in dbTrainerToCardData in SearchSection.tsx
- [x] Trainer type updated in types/index.ts
- [x] Build succeeds (vite build: built in 2.14s)
- [x] No new TypeScript errors (35 baseline errors, 35 after changes)
