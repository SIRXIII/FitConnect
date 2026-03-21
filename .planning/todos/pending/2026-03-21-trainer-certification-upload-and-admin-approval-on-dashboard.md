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

1. Add a "Certifications" section to TrainerDashboard (Overview tab) showing current certs + upload button
2. Supabase Storage bucket `trainer-certifications` for document uploads
3. `trainer_certifications` table: id, trainer_id, name, file_url, status (pending/approved/rejected), submitted_at, reviewed_at, admin_notes
4. Admin Dashboard gets a "Certification Review" tab with pending submissions
5. Trainer profile shows "Verified" badge only after admin approves at least one certification
6. Consider making this a v6.0 or v7.0 phase depending on priority
