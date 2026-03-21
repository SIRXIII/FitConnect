# Phase 36 Context — Trainer Video Intros

**Phase:** 36
**Milestone:** v6.0 Growth Engine
**Status:** Ready to plan

## Goal

Trainers can upload a 30-second intro video to their profile. Clients see it on the trainer card and profile page. Videos are compressed client-side before upload.

## Requirements

- VIDEO-01: Video upload on trainer profile (max 30 sec, max 50MB, mp4/webm/mov)
- VIDEO-02: Stored in Supabase Storage with public URL in `trainer_profiles.intro_video_url`
- VIDEO-03: Thumbnail captured client-side (first frame via canvas) stored as `intro_video_thumbnail_url`
- VIDEO-04: Video plays inline on trainer public profile page
- VIDEO-05: "Video" badge on trainer cards in search results

## Success Criteria

1. Trainer can upload a video from their dashboard
2. Video appears on their public profile page with a play button
3. Trainer cards show a "Video" badge if the trainer has an intro
4. Videos are compressed client-side before upload

## Technical Context

### Current Profile Infrastructure
- `trainer_profiles` table exists with `avatar_url`, `bio`, `specialty`, etc.
- Supabase Storage already in use for client avatars (`avatars` bucket — Phase 18)
- Canvas-based avatar compression pattern established in `src/utils/imageUtils.ts`
- `TrainerProfile` page exists at `src/pages/TrainerProfile.tsx`
- Trainer cards rendered in `src/components/TrainerCard.tsx` (or similar)
- Trainer dashboard at `src/pages/TrainerDashboard.tsx`

### Schema Change
Migration adds two columns to `trainer_profiles`:
```sql
ALTER TABLE trainer_profiles
  ADD COLUMN intro_video_url TEXT,
  ADD COLUMN intro_video_thumbnail_url TEXT;
```

### Storage
New Supabase Storage bucket: `trainer-videos` (public read, auth write)
- RLS: trainer can only upload/delete their own video (match `user_id`)
- Max file size enforced in bucket settings: 50MB
- Public URL pattern: `{SUPABASE_URL}/storage/v1/object/public/trainer-videos/{user_id}/intro.mp4`

### Client-Side Processing
Video duration check: use `video.duration` after `loadedmetadata` event — reject if > 30 seconds before upload.
Thumbnail capture: seek video to `0.5s`, draw to canvas, export as JPEG blob, upload to `trainer-videos/{user_id}/thumb.jpg`.
No transcoding — upload the original (browser already records in h264/mp4 on mobile).

### Display
- Trainer profile: `<video>` element, `controls`, `preload="metadata"`, poster=thumbnail URL
- Trainer card: thumbnail `<img>` with "Video" badge overlay (gold pill), clicking navigates to profile
- Hover autoplay on desktop (muted, low priority)

## Constraints

- No server-side transcoding — Supabase Storage is a file store, not a video platform
- 50MB limit is generous for 30 seconds of mobile video (typical: 15-25MB at 1080p)
- Duration validation client-side only (not enforced server-side — acceptable for v6.0)
