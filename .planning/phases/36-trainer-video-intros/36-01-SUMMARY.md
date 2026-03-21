---
phase: 36-trainer-video-intros
plan: "01"
subsystem: trainer-profile
tags: [video, storage, upload, trainer-dashboard]
dependency_graph:
  requires: []
  provides: [trainer-video-upload, video-utils]
  affects: [trainer-profiles-schema, supabase-storage]
tech_stack:
  added: [trainer-videos storage bucket]
  patterns: [canvas-thumbnail-extraction, client-side-video-validation]
key_files:
  created:
    - Cenlar demand gt 1-17/supabase/migrations/20260320_trainer_video_intro.sql
    - Cenlar demand gt 1-17/src/utils/videoUtils.ts
    - Cenlar demand gt 1-17/src/components/trainer/VideoUploader.tsx
  modified:
    - Cenlar demand gt 1-17/src/types/supabase.ts
    - Cenlar demand gt 1-17/src/pages/TrainerDashboard.tsx
decisions:
  - "Used fetchProfile(user.id) after upload completion to refresh trainerProfile from store rather than local state mutation"
  - "VideoUploader placed in trainer dashboard profile tab above SettingsTab in a bordered container"
metrics:
  duration: "~15 minutes"
  completed: "2026-03-21T02:44:15Z"
  tasks_completed: 2
  files_changed: 5
---

# Phase 36 Plan 01: Trainer Video Upload Summary

Trainer video upload pipeline with client-side validation, canvas thumbnail extraction, and Supabase Storage integration — uploads to `trainer-videos/{userId}/intro.mp4` with thumbnail at `{userId}/thumb.jpg`.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Migration + video utilities | 34021f3 | supabase/migrations/20260320_trainer_video_intro.sql, src/utils/videoUtils.ts |
| 2 | VideoUploader component + dashboard integration | d19ddc2 | src/components/trainer/VideoUploader.tsx, src/pages/TrainerDashboard.tsx |

## What Was Built

- **Migration**: ALTER TABLE trainer_profiles adds `intro_video_url` and `intro_video_thumbnail_url` TEXT columns. Creates `trainer-videos` Supabase Storage bucket (public read, 50MB limit) with RLS policies for per-trainer upload/delete.
- **videoUtils.ts**: `validateVideoDuration` checks duration via HTMLVideoElement metadata before upload; `captureVideoThumbnail` seeks to 0.5s and uses canvas to export JPEG blob.
- **VideoUploader**: Shows dropzone when no video, thumbnail preview with "Replace" button when video exists. Validates size (<= 50MB) and duration (<= 30s) before uploading. Progress bar with manual percentage steps. "Remove" button deletes from storage and nulls DB columns.
- **TrainerDashboard**: VideoUploader rendered in profile tab above SettingsTab inside bordered container.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Used fetchProfile instead of Object.assign for state update**
- **Found during:** Task 2
- **Issue:** trainerProfile comes from auth store, not local state — Object.assign would mutate store object without triggering React re-renders
- **Fix:** Called `fetchProfile(user.id)` in onUploadComplete callback to refresh store properly
- **Files modified:** src/pages/TrainerDashboard.tsx

**2. [Rule 2 - Missing types] Added intro_video fields to supabase.ts type definitions**
- **Found during:** Task 1
- **Issue:** New DB columns needed type coverage in supabase.ts Row/Insert/Update for the VideoUploader's `supabase.from('trainer_profiles').update()` call to type-check
- **Fix:** Added `intro_video_url` and `intro_video_thumbnail_url` to all three type sections
- **Files modified:** src/types/supabase.ts

## Self-Check

- [x] supabase/migrations/20260320_trainer_video_intro.sql exists
- [x] src/utils/videoUtils.ts exports validateVideoDuration and captureVideoThumbnail
- [x] src/components/trainer/VideoUploader.tsx created
- [x] TrainerDashboard profile tab includes VideoUploader
- [x] No new TypeScript errors introduced (pre-existing errors are unrelated to this plan)
