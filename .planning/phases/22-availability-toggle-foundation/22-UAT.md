---
status: testing
phase: 22-availability-toggle-foundation
source: 22-01-SUMMARY.md, 22-02-SUMMARY.md, 22-03-SUMMARY.md
started: 2026-03-19T18:00:00Z
updated: 2026-03-19T18:00:00Z
---

## Current Test

number: 1
name: Trainer Goes Live with Toggle
expected: |
  On the Trainer Dashboard, a sticky availability header bar appears below the nav. Tapping the toggle starts a 5-second warm-up animation (progress bar fills). After 5 seconds, the trainer is LIVE — the toggle shows green "LIVE" state.
awaiting: user response

## Tests

### 1. Trainer Goes Live with Toggle
expected: On the Trainer Dashboard, a sticky availability header bar appears below the nav. Tapping the toggle starts a 5-second warm-up animation (progress bar fills). After 5 seconds, the trainer is LIVE — the toggle shows green "LIVE" state.
result: [pending]

### 2. Trainer Goes Offline
expected: While live, tapping the toggle again transitions the trainer back to offline. If the trainer has upcoming bookings, a warning appears before going offline.
result: [pending]

### 3. Sleep Timer Selection
expected: While live, sleep timer pill buttons (1hr, 2hr, 4hr, EOD) are visible. Tapping one sets a countdown timer. The countdown is always visible showing remaining time (e.g., "1:59:32").
result: [pending]

### 4. Countdown Extend on Tap
expected: Tapping the countdown display extends the timer. The remaining time increases by the tapped duration.
result: [pending]

### 5. Booking Mode Selector
expected: The availability header shows a booking mode selector. Trainer can switch between "Instant Book" and "Request to Book" modes.
result: [pending]

### 6. Live Now Badge in Search
expected: When a trainer is live, their card in search results shows a green "Live Now" badge with an animated pulse dot. Live trainers sort to the top of results.
result: [pending]

### 7. Booking Mode Badge in Search
expected: Trainer cards in search results show either "Instant Book" (accent color) or "Request to Book" (muted) badge.
result: [pending]

### 8. Instant Book — Atomic Booking
expected: As a client, booking a live trainer's slot in Instant Book mode completes the booking. If the slot was just taken by another client, a toast error appears saying the slot is taken (no double-booking).
result: [pending]

### 9. Request to Book Flow
expected: As a client, booking a trainer in "Request to Book" mode inserts a booking request and navigates to My Bookings. The CTA button shows "Request to Book" text.
result: [pending]

### 10. Booking Request Queue (Trainer Side)
expected: On the Trainer Dashboard, when live and in Request mode, a booking request queue appears showing pending requests (max 5). Each request card shows client info, slot time, and a 30-minute countdown with accept/decline buttons.
result: [pending]

### 11. First-Time Tooltip
expected: The first time a trainer sees the availability toggle, a tooltip explains how it works. After dismissal, it doesn't appear again (persisted in localStorage).
result: [pending]

## Summary

total: 11
passed: 0
issues: 0
pending: 11
skipped: 0

## Gaps

[none yet]
