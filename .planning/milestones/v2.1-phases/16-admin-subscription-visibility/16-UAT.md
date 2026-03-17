---
status: testing
phase: 16-admin-subscription-visibility
source: [16-01-SUMMARY.md, 16-02-SUMMARY.md, 16-03-SUMMARY.md]
started: 2026-03-17T04:30:00Z
updated: 2026-03-17T04:30:00Z
---

## Current Test

number: 2
name: Subscription Health StatCards — Analytics Tab
expected: |
  Log in as an admin. Go to Admin Dashboard → Analytics tab. Below the existing 4
  metric cards, a "Subscription Health" section appears with 4 new cards: MRR, Pro
  Subscribers, Elite Subscribers, and Active Trials. Each shows a numeric value.
awaiting: user response

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running dev server. Apply the new migration (supabase db push), then start the app fresh (npm run dev). The app boots without errors, and the Admin Dashboard loads — analytics and users tabs render without console errors.
result: pass

### 2. Subscription Health StatCards — Analytics Tab
expected: Log in as an admin. Go to Admin Dashboard → Analytics tab. Below the existing 4 metric cards (Total Revenue, Platform Fee, Trainer Payouts, Booking Volume), a "Subscription Health" section appears with 4 new cards: "MRR", "Pro Subscribers", "Elite Subscribers", and "Active Trials". Each card shows a numeric value (or $X.XX for MRR, or 0 if no data). The values load alongside the existing cards — no extra loading spinner needed.
result: [pending]

### 3. TierBadge — Trainer Rows in Users Tab
expected: Go to Admin Dashboard → Users tab. Find a row for a user with role "trainer". Next to their name (or in the Tier column), a small colored badge appears showing their subscription tier and status. Examples: "Free" in muted ink, "Pro" in accent color, "Elite" in dark ink, "Pro — Trialing" in lighter accent. Client rows have no tier badge. The table now has 5 columns (Name, Role, Joined, Tier, Status).
result: [pending]

### 4. Override Column — Trainer Rows
expected: In the Users tab, each trainer row has an "Override" button or link in a 6th column. Clicking it reveals an inline tier selector with three options: Free, Pro, Elite. The current tier appears pre-selected or highlighted. You can dismiss the selector without making a change.
result: [pending]

### 5. Applying a Manual Tier Override
expected: In the Users tab, click Override on a trainer. Select a different tier (e.g., switch Free → Pro). The request fires, a success toast appears ("Tier updated" or similar), the inline selector closes, and the trainer's TierBadge updates immediately to reflect the new tier. An override date subtext may appear below the badge (e.g., "Override: Mar 17").
result: [pending]

### 6. Deploy: admin-set-tier-override Edge Function
expected: Run `supabase functions deploy admin-set-tier-override` in the terminal. It deploys successfully (no errors). The function appears in `supabase functions list`. (You don't need to test a live curl call — deployment success is sufficient.)
result: [pending]

## Summary

total: 6
passed: 1
issues: 0
pending: 5
skipped: 0

## Gaps

[none yet]
