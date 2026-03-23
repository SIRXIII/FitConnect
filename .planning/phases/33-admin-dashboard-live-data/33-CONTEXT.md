# Phase 33: Admin Dashboard Live Data & Controls - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the admin dashboard to real Supabase data. Replace all demo/hardcoded data with live queries. Add transaction list, payout approval/reject UI, and full user management with active/inactive filtering. Admin should manage everything from the website — not Stripe dashboard.

</domain>

<decisions>
## Implementation Decisions

### Analytics Tab
- Pull real data from Supabase: total bookings (count from `bookings`), total revenue (sum from `bookings.amount`), active users (count from `profiles` where role is set), platform fees (sum from `bookings.platform_fee`)
- Time range filters already exist (adminRange state) — wire them to real queries
- Remove DEMO_STATS fallback entirely
- Revenue chart should use Recharts (already installed) with real monthly data

### Transactions Tab (NEW)
- New tab showing all payments: date, client name, trainer name, amount, platform fee, status (succeeded/pending/refunded)
- Pull from `bookings` table joined with profiles
- Sortable by date, filterable by status
- No Stripe API calls needed — all data is in Supabase from webhook events

### Payouts Tab (NEW)
- Show trainer payout balances (sum of completed bookings minus platform fee minus already-paid-out)
- Per-trainer: approve payout, reject, or hold
- Payout history with date, amount, status
- Uses existing `payouts` table if it exists, otherwise create one
- Manual payout triggers call the existing `create-payout` edge function

### Users Tab
- Replace demo users with real query from `profiles` joined with `auth.users` (for email, last_sign_in_at)
- Show: name, email, role, status (active/suspended), member since, last login
- Filter by: role (all/client/trainer/admin), status (all/active/suspended)
- Search by name or email
- Suspend/unsuspend already works — keep it

### Cert Approval Fix
- The `platform_settings` table was missing (now created) — that was causing the Settings save freeze
- Cert approve button should work now — verify and fix any remaining RLS issues

### Claude's Discretion
- Exact SQL query optimization (RPCs vs client-side joins)
- Loading skeleton designs for new tabs
- Pagination approach for transactions (offset vs cursor)
- Chart styles and color choices

</decisions>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above.

### Key source files
- `src/pages/AdminDashboard.tsx` — Main admin dashboard (1100+ lines), all tabs
- `src/lib/supabase.ts` — Supabase client
- `supabase/functions/create-payout/index.ts` — Existing payout edge function
- `supabase/functions/weekly-payouts/index.ts` — Auto-payout logic
- `supabase/migrations/20260311143000_fitconnect_current_schema.sql` — Base schema with bookings, profiles tables

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AdminDashboard.tsx` already has tab structure (analytics, users, reviews, certifications, audit, settings, support)
- Recharts is installed and used in trainer earnings — reuse for admin charts
- `useAuthStore` provides current user for admin role checks
- `useSupportTickets` hook pattern can be replicated for transactions/payouts

### Established Patterns
- Admin queries use `(supabase as any)` to bypass TypeScript types for tables not in generated types
- Tab switching via `activeTab` state
- Loading states: `loadingX` boolean per section
- Toast notifications via `sonner` for success/error

### Integration Points
- New tabs added to `activeTab` type union and tab bar
- `platform_settings` table now exists (just created) for fee configuration
- `bookings` table has amount, platform_fee, status fields
- `profiles` table has role, is_suspended, created_at
- Trainer payout data in bookings (trainer_id, amount after fee)

</code_context>

<specifics>
## Specific Ideas

- User wants to manage EVERYTHING from the admin dashboard — no going to Stripe
- Revenue/analytics must reflect real booking data, not mock numbers
- Payout controls should be per-trainer with approve/reject/hold actions
- User list should show active vs inactive clearly with filtering

</specifics>

<deferred>
## Deferred Ideas

- Google Places Autocomplete for location search — separate task
- Client Stripe saved payment methods in Settings — separate phase
- Stripe webhook real-time sync — depends on Stripe keys being configured

</deferred>

---

*Phase: 33-admin-dashboard-live-data*
*Context gathered: 2026-03-23*
