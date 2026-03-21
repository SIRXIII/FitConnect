---
created: 2026-03-21T01:28:00.666Z
title: Trainer certification upload and admin approval on dashboard
area: ui
files:
  - src/pages/TrainerDashboard.tsx
  - src/pages/TrainerOnboarding.tsx
  - src/pages/AdminDashboard.tsx
---

## Problem

Trainers cannot view, upload, or update their certifications from the Trainer Dashboard. During onboarding, trainers select a specialty (which implies certification like NASM, ACE, etc.) but there is no:

1. **Certification display** on the trainer dashboard — trainer can't see what certs are on file
2. **Certification upload** — no way to upload certification documents (PDF, images) as proof
3. **Admin approval workflow** — admin should review/verify submitted certifications before the trainer goes live
4. **Update mechanism** — trainers with new or renewed certifications can't upload updates

This is a trust/safety requirement — a fitness marketplace MUST verify trainer credentials. The "Vetted & Certified" claim on the landing page needs to be backed by actual verification.

## Solution

1. **Onboarding step (REQUIRED)**: Add a "Upload Certifications" step to TrainerOnboarding — trainer must upload at least one cert document (PDF/image) before completing onboarding
2. **Dashboard section**: "Certifications" section on TrainerDashboard for viewing status and uploading updates
3. Supabase Storage bucket `trainer-certifications` for document uploads
4. `trainer_certifications` table: id, trainer_id, name, file_url, status (pending/approved/rejected), submitted_at, reviewed_at, admin_notes
5. Admin Dashboard gets a "Certification Review" tab with pending submissions
6. Trainer profile shows "Verified" badge only after admin approves at least one certification
7. Trainer can't go fully "live" until at least one cert is approved (soft gate — can set up profile but bookings blocked)
8. HIGH PRIORITY — should be built before going to market in Corona
