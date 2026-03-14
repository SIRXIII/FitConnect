# Phase 9: Trainer Payout System - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Enable trainers to view their earnings balance and withdraw funds via Stripe Connect. Covers: payout dashboard tab, available/pending balance display, on-demand payout request flow, weekly auto-payout (Monday), transaction history, and email notifications on initiation + completion.

Earnings analytics, CSV export, and charts belong to Phase 10.

</domain>

<decisions>
## Implementation Decisions

### Dashboard Placement
- Payout dashboard lives as a new **Payouts tab** inside the existing TrainerDashboard page
- Tab structure after Phase 9: **Overview | Payouts** (Phase 10 adds Analytics)
- Overview remains the default tab — trainers land there first
- No Navbar link — trainers reach Payouts via TrainerDashboard → Payouts tab only

### Balance Display
- **Available balance** (withdrawable now) is the primary hero metric — large number, prominent
- Pending balance shown smaller below with a tooltip: "Completed sessions not yet paid out"
- No fee breakdown shown at the balance level — just the net withdrawable amount

### Transaction History Table
- Single combined table: both individual booking credits and Stripe payout transfer rows
- Columns: **Date | Client | Amount | Status**
- Status labels: **Completed** (green) | **Pending** (amber) | **Failed** (red) — matches existing badge pattern
- Sort: newest first, no filtering (filtering deferred to Phase 10 Analytics)
- Net payout per row only — no per-row fee breakdown visible

### On-Demand Payout UX
- "Request Payout" button on Payouts tab
- Button disabled (with tooltip "Minimum $50 required") when available balance < $50
- Click opens **confirmation modal**: "Request payout of $X.XX? Funds arrive within 2 business days." with Confirm/Cancel
- On success: toast notification + available balance immediately clears to $0
- On failure: error toast ("Payout failed. Please try again or contact support.") + balance restored

### Email Delivery — Resend.com
- Wire up **Resend.com** in the send-notification-email Edge Function (free tier: 100/day)
- **Initiation email**: "Your payout of $X.XX has been initiated. Funds expected within 2 business days."
- **Completion email**: "Your payout of $X.XX has arrived in your bank account." — triggered by Stripe webhook confirming transfer
- Both emails required (PAYOUT-06)

### Claude's Discretion
- Weekly auto-payout scheduler implementation (Supabase pg_cron vs Edge Function cron)
- Resend API key env var name and config pattern
- Exact modal and toast copy beyond what's specified above
- Error state details for network failures
- Loading skeleton for the Payouts tab

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TrainerDashboard.tsx` stat card pattern: `border border-ink/10 p-8 space-y-3` with label (text-xs uppercase tracking) + serif number — reuse for Available/Pending balance cards
- `AdminDashboard.tsx` tab interface pattern — apply same tab structure to TrainerDashboard
- `StatCard` component from AdminDashboard — reuse for balance figures
- Existing status badge pattern (green/amber/red with text-xs uppercase) — reuse for Completed/Pending/Failed
- `useNotifications` hook + notifications table — use same pattern for payout notification records
- `send-notification-email/index.ts` Edge Function stub — extend with Resend.com provider

### Established Patterns
- Realtime subscriptions: `supabase.channel()` with `postgres_changes` — use for live balance updates
- Auth: `useAuthStore()` → `trainerProfile.stripe_account_id` — available for payout Edge Function calls
- Edge Functions: Deno.serve(), corsHeaders from `_shared/cors.ts`, bearer token auth
- `payments.trainer_payout` — already calculated and stored per booking, use for balance aggregation
- `platform_settings` table — platform fee already configurable, no hardcoding needed

### Integration Points
- New payout Edge Function (`supabase/functions/create-payout/`) calls Stripe Transfers API using `trainerProfile.stripe_account_id`
- Stripe webhook (`stripe-webhook/index.ts`) needs new handler for `payout.paid` event to trigger completion email
- TrainerDashboard route (`/trainer/dashboard`) — add tab switcher, Payouts tab component
- `payments` table — query for balance calculation: SUM trainer_payout WHERE trainer_id AND status = 'succeeded' AND not yet paid out

</code_context>

<specifics>
## Specific Ideas

- Confirmation modal copy: "Request payout of $X.XX? Funds arrive within 2 business days." — keep it direct, no fluff
- Disabled button tooltip: "Minimum $50 required" — not a general error, a clear threshold message
- Initiation email subject: "Your FitRush payout has been initiated"
- Completion email subject: "Your FitRush payout has arrived"

</specifics>

<deferred>
## Deferred Ideas

- Custom payout amount (partial withdrawal) — user chose full-balance only for now
- Payout filtering by date/status on transaction table — Phase 10 Analytics adds time-range filtering
- PIN/password confirmation for payouts — not needed, modal confirmation is sufficient

</deferred>

---

*Phase: 09-trainer-payout-system*
*Context gathered: 2026-03-14*
