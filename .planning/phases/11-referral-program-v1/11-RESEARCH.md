# Phase 11: Referral Program v1 - Research

**Researched:** 2026-03-14
**Domain:** Referral attribution (cookie-based), Supabase DB, Postgres RPC, React profile UI, landing leaderboard, Resend email
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REFERRAL-01 | Each user has a unique referral code visible on profile with a shareable link | Add `referral_code` column to `profiles` table (unique, generated at user creation); expose in TrainerDashboard overview tab and ClientDashboard; shareable URL = `${origin}/?ref=CODE` |
| REFERRAL-02 | Trainer refers client → client books → trainer earns $10 payout credit | Track referral attribution in `referrals` table; after referred client's first `completed` booking, insert a payout credit row into `payout_transactions` for the referring trainer |
| REFERRAL-03 | Client refers trainer → trainer books that client → client gets $5 discount on next booking | Track reverse referral; after referred trainer's first completed booking with the referring client, set `referral_discount_pending = true` on client profile; BookSession reads this flag and deducts $5 |
| REFERRAL-04 | Referral attribution: link sets cookie → links new user to referrer on signup → credit applied on first booking completion | Landing page reads `?ref=CODE` query param and writes `referral_code` cookie (30-day expiry); RoleSelect/AuthCallback reads cookie on account creation and writes to `referrals` table |
| REFERRAL-05 | Top 10 referrers leaderboard on landing page, refreshes monthly | Postgres RPC `get_referral_leaderboard()` returns top 10 by confirmed referral count; new `ReferralLeaderboard` component added to Landing page; monthly cadence = RPC groups by calendar month or last 30 days |
| REFERRAL-06 | Referral notifications: "You referred [User] — earn reward when they book" (in-app + email) | Insert row into `notifications` table for in-app; call existing Resend email pattern (same as payout emails) for email notification; fire on: (a) new referral sign-up, (b) first booking completion credit |
</phase_requirements>

---

## Summary

Phase 11 builds a complete cookie-based referral loop on top of the existing Supabase + React stack. No new libraries are needed. The key pattern is: a unique `referral_code` per user (generated at signup via a DB trigger or migration backfill), a `referrals` table tracking referrer → referred relationships, and credit hooks embedded in the booking completion flow.

The $10 trainer payout credit re-uses the `payout_transactions` table and the balance calculation logic already live in Phase 9. The $5 client discount requires a flag that BookSession reads at checkout time to reduce `rate_charged` by $5 (one-time, cleared after first booking with the relevant trainer). The leaderboard is a Postgres RPC returning top 10 referrers, added as a new section on the Landing page. Notifications use the existing `notifications` table (in-app) and the existing Resend fetch pattern (email).

The trickiest part of this phase is the cookie attribution flow across OAuth redirects. The landing page must persist the referral cookie before the OAuth redirect, and the attribution must be read back after the redirect completes (in `AuthCallback` or `RoleSelect`). This requires storing the referrer's user_id or referral_code in a cookie with sufficient expiry to survive the OAuth round-trip and a new user's delayed first booking.

**Primary recommendation:** Use a `referrals` table with `referrer_id`, `referred_id`, `status`, and `reward_type` columns. Gate credit logic on booking `status = 'completed'` (same trigger point as payout balance). Keep all reward logic in a new `process-referral-reward` Edge Function invoked from the `stripe-webhook` handler when a booking completes.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | 2.49.8 (Edge) / ^2.99.0 (frontend) | DB queries, RLS, RPC calls | Already in project at both pinned versions |
| stripe (npm) | 14.25.0 | No new calls needed — reuses existing balance pattern | Already installed, used for payout_transactions |
| Resend (fetch-based) | N/A (no SDK) | Referral milestone emails | Existing pattern: fetch to api.resend.com/emails |
| framer-motion | ^12.35.2 | Leaderboard animation (already used on landing) | Already installed |
| lucide-react | ^0.555.0 | Icons for referral UI (Share2, Link, Trophy) | Already installed |
| sonner | ^2.0.7 | Toast on copy-to-clipboard action | Already installed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `document.cookie` API | browser native | Set/read 30-day referral cookie on landing | No library needed — one-liner |
| `URLSearchParams` | browser native | Parse `?ref=CODE` from landing URL | No library needed |
| `navigator.clipboard.writeText` | browser native | Copy referral link to clipboard | No library needed — use as copy button handler |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Cookie-based attribution | localStorage | Cookies survive OAuth redirects; localStorage is cleared between origins. Cookie is correct for this OAuth flow. |
| process-referral-reward Edge Function | DB trigger | Edge Function lets us call Resend for email + insert payout_transactions in one atomic operation. DB trigger cannot call external services. |
| Monthly leaderboard via RPC | Materialized view | RPC is simpler; no cron needed to refresh. Query performance on `referrals` table is fast at current scale. |

**Installation:** No new packages needed. All libraries already in `package.json`.

---

## Architecture Patterns

### Recommended Project Structure
```
supabase/
  migrations/
    20260316000000_referral_system.sql   # referrals table, referral_code column, RPC
  functions/
    process-referral-reward/             # New Edge Function
      index.ts
src/
  components/
    landing/
      ReferralLeaderboard.tsx            # New — top 10 leaderboard section
    shared/
      ReferralWidget.tsx                 # New — code display + copy button (reusable)
  pages/
    Landing.tsx                          # Modified — add ReferralLeaderboard section
    TrainerDashboard.tsx                 # Modified — add ReferralWidget to overview tab
    ClientDashboard.tsx                  # Modified — add ReferralWidget
  lib/
    referral.ts                          # New — cookie helpers, referral link builder
supabase/functions/stripe-webhook/
  index.ts                               # Modified — call process-referral-reward on booking completed
```

### Pattern 1: Cookie Attribution (Landing → Signup)
**What:** Landing page reads `?ref=CODE`, writes cookie; `AuthCallback`/`RoleSelect` reads cookie after signup and records attribution.
**When to use:** Every new user signup. Cookie must be set before OAuth redirect to survive the round-trip.
**Example:**
```typescript
// src/lib/referral.ts
const COOKIE_NAME = 'fitc_ref';
const COOKIE_DAYS = 30;

export function captureReferralCode(code: string): void {
  const expires = new Date(Date.now() + COOKIE_DAYS * 86400 * 1000).toUTCString();
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(code)}; expires=${expires}; path=/; SameSite=Lax`;
}

export function readReferralCode(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function clearReferralCode(): void {
  document.cookie = `${COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
}

export function buildReferralLink(code: string): string {
  return `${window.location.origin}/?ref=${encodeURIComponent(code)}`;
}
```

### Pattern 2: Attribution Recording (RoleSelect on First Role Set)
**What:** After a new user selects their role (first action post-signup), read the referral cookie and insert a `referrals` row.
**When to use:** In `RoleSelect` page after the `setRole()` call succeeds.
**Example:**
```typescript
// In RoleSelect.tsx, after setRole() succeeds:
import { readReferralCode, clearReferralCode } from '@/lib/referral';

const refCode = readReferralCode();
if (refCode) {
  // Look up referrer's user_id from referral_code
  const { data: referrer } = await supabase
    .from('profiles')
    .select('id')
    .eq('referral_code', refCode)
    .maybeSingle();

  if (referrer && referrer.id !== user.id) {
    await supabase.from('referrals').insert({
      referrer_id: referrer.id,
      referred_id: user.id,
      referred_role: role, // 'trainer' or 'client'
      status: 'pending',
    });
    clearReferralCode();
  }
}
```

### Pattern 3: Reward Processing (Edge Function on Booking Complete)
**What:** When `stripe-webhook` handles `payment_intent.succeeded` and booking moves to `confirmed`, check if this is the referred user's FIRST completed booking and trigger reward.
**When to use:** Inside `stripe-webhook/index.ts` after `updatePaymentAndBooking()` marks booking `confirmed`.
**Example:**
```typescript
// In process-referral-reward Edge Function (called from stripe-webhook)
// Input: { booking_id, client_id, trainer_id }
// 1. Look up referrals where referred_id = client_id AND status = 'pending'
// 2. Check if this is first completed booking for referred user
// 3. If trainer reward: insert payout_transaction credit row for referrer
// 4. If client reward: set referral_discount_pending = true on referring client's profile
// 5. Mark referral as 'rewarded'
// 6. Insert in-app notification + send Resend email
```

### Pattern 4: $5 Client Discount at Checkout
**What:** BookSession reads a `referral_discount_pending` flag on the client's profile. If true AND this is the first booking with the referred trainer, deduct $5 from `rate_charged`.
**When to use:** In `handleBooking()` in `BookSession.tsx` before constructing the booking row.
**Example:**
```typescript
// BookSession.tsx handleBooking additions
const { data: clientProfile } = await supabase
  .from('profiles')
  .select('referral_discount_pending, referral_discount_trainer_id')
  .eq('id', user.id)
  .single();

const hasReferralDiscount =
  clientProfile?.referral_discount_pending &&
  clientProfile?.referral_discount_trainer_id === trainerProfile.id;

const finalRate = hasReferralDiscount ? Math.max(0, rate - 5) : rate;
// ... use finalRate for booking insert and payment intent amount
```

### Pattern 5: Leaderboard RPC + Landing Component
**What:** Postgres RPC returns top 10 referrers by count of rewarded referrals in the current month. `ReferralLeaderboard` component calls it on mount.
**When to use:** On the Landing page as a new section after `HowItWorks`.
**Example:**
```sql
-- In migration: get_referral_leaderboard()
CREATE OR REPLACE FUNCTION public.get_referral_leaderboard()
RETURNS TABLE (
  rank          bigint,
  full_name     text,
  avatar_url    text,
  referral_count bigint
)
LANGUAGE sql
SECURITY INVOKER
AS $$
  SELECT
    ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC) AS rank,
    p.full_name,
    p.avatar_url,
    COUNT(*) AS referral_count
  FROM public.referrals r
  JOIN public.profiles p ON p.id = r.referrer_id
  WHERE r.status = 'rewarded'
    AND r.rewarded_at >= date_trunc('month', now())
  GROUP BY p.id, p.full_name, p.avatar_url
  ORDER BY referral_count DESC
  LIMIT 10;
$$;
```

### Anti-Patterns to Avoid
- **Self-referral:** Always guard `referrer_id != referred_id` at the DB level (CHECK constraint) and in the Edge Function.
- **Double-reward:** Mark referral `status = 'rewarded'` atomically before firing reward to prevent idempotency failures if the webhook fires twice.
- **Applying discount to already-discounted rate:** The $5 deduction applies to `rate` (post trainer-discount), not `optimized_rate`. Cap at $0 minimum.
- **Cookie read before landing page loads `?ref=` param:** Read the param synchronously in a `useEffect` on mount in `Landing.tsx`, not in AuthCallback (which loads on a different URL).
- **Leaderboard as blocking render:** Load leaderboard data asynchronously with a skeleton; the landing page must not delay render for the RPC call.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Unique referral code generation | Custom random string | `nanoid` or `substring(gen_random_uuid()::text, 1, 8)` in Postgres trigger | UUID-based codes are collision-resistant at this scale |
| Email sending for milestones | New email service | Existing Resend fetch pattern in Edge Functions | Already wired, same pattern as payout emails |
| Payout credit for referral | New payout mechanism | Existing `payout_transactions` table with `initiated_by = 'referral'` | Phase 9 balance query already sums all `payout_transactions`; adding a referral row is automatic |
| Cookie management | Cookie library | Native `document.cookie` API | No library justified for 3 lines of cookie code |
| Leaderboard ranking | Client-side sort | SQL `ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC)` | Computed once in DB, not on every client |

**Key insight:** The `payout_transactions` table already defines the credit mechanism. A `$10 referral credit` is just another row with `initiated_by = 'referral'` and `status = 'completed'` — the trainer's available balance auto-includes it.

---

## Common Pitfalls

### Pitfall 1: Cookie Lost Across OAuth Redirect
**What goes wrong:** `SameSite=Strict` cookies are not sent on cross-origin redirect returns from Google/Facebook OAuth.
**Why it happens:** OAuth redirects are external; strict same-site cookies are blocked.
**How to avoid:** Use `SameSite=Lax` (not Strict) for the referral cookie. Lax allows cookies on top-level navigations triggered by links/redirects, which covers OAuth redirects.
**Warning signs:** Cookie reads `null` in `RoleSelect` even though `?ref=` was in the original URL.

### Pitfall 2: Attribution Fires on Returning Users
**What goes wrong:** If an existing user visits `/?ref=CODE`, they get attributed as a referral.
**Why it happens:** Cookie is set on all visits with `?ref=` regardless of user state.
**How to avoid:** In `RoleSelect`, only process attribution if this is the user's FIRST role selection (i.e., profile has no existing role before the `setRole` call). Check `!profile?.role` before reading the cookie.

### Pitfall 3: Reward Applied Before First Booking Is "Completed"
**What goes wrong:** Reward fires when booking is `confirmed` (payment captured) rather than `completed` (session attended).
**Why it happens:** `payment_intent.succeeded` marks booking `confirmed`, not `completed`. "Completed" is a separate status set when the session is marked as attended.
**How to avoid:** Trigger reward on booking status `completed`, not `confirmed`. Need to look at how bookings are marked complete — it may be manual or via another webhook.
**Research gap:** See Open Questions — how bookings move from `confirmed` to `completed` must be verified.

### Pitfall 4: Double-Reward on Webhook Retry
**What goes wrong:** Stripe may retry a webhook delivery. If the Edge Function is not idempotent, the reward fires twice.
**Why it happens:** Stripe guarantees at-least-once delivery.
**How to avoid:** Before inserting the payout credit, check if the referral already has `status = 'rewarded'`. Use an upsert or early return guard.

### Pitfall 5: $5 Discount Applied on Subsequent Bookings
**What goes wrong:** `referral_discount_pending` flag stays `true` after the first booking, giving the client infinite discounts.
**Why it happens:** If the flag isn't cleared atomically when the discount booking is created.
**How to avoid:** Clear `referral_discount_pending` and `referral_discount_trainer_id` in the same `bookings.insert` transaction (or immediately after). Use a Postgres trigger or clear it in the `stripe-webhook` handler when the discounted booking's payment succeeds.

### Pitfall 6: Leaderboard Shows All-Time Counts Instead of Monthly
**What goes wrong:** RPC returns lifetime referral counts, leaderboard shows the same leaders every month.
**Why it happens:** `WHERE` clause missing `date_trunc('month', now())` filter on `rewarded_at`.
**How to avoid:** Always filter by `rewarded_at >= date_trunc('month', now())`. Add a `rewarded_at timestamptz` column to `referrals` table.

---

## Code Examples

Verified patterns from existing codebase:

### Inserting to payout_transactions (referral credit)
```typescript
// In process-referral-reward Edge Function
// $10 trainer credit — reuses exact same table as Phase 9 payouts
await adminClient
  .from('payout_transactions')
  .insert({
    trainer_id: referrerTrainerProfileId,
    amount: 10.00,
    status: 'completed',          // Credit is immediately available
    initiated_by: 'referral',     // Extend CHECK constraint to include 'referral'
    stripe_transfer_id: null,     // No Stripe transfer for credits
  });
```

### Inserting in-app notification (existing pattern)
```typescript
// notifications table schema: user_id, type, title, message, link, read
await adminClient
  .from('notifications')
  .insert({
    user_id: referrerUserId,
    type: 'referral_reward',
    title: 'Referral reward earned',
    message: `You referred ${referredName} — $10 credit added to your balance.`,
    link: '/trainer/dashboard',
    read: false,
  });
```

### Sending email via Resend (existing pattern in stripe-webhook)
```typescript
// Same pattern used in stripe-webhook/index.ts for payout completion
const resendApiKey = Deno.env.get('RESEND_API_KEY');
if (resendApiKey) {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'FitRush <noreply@resend.dev>',
      to: [referrerEmail],
      subject: 'Your FitRush referral reward has been applied',
      html: `<p>Great news! Your referral earned you a $10 credit on your FitRush payout balance.</p>`,
    }),
  }).catch((err: unknown) => console.error('[process-referral-reward] Resend error:', err));
}
```

### Migration: referral_code column on profiles
```sql
-- In migration file
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE;

-- Backfill existing users
UPDATE public.profiles
SET referral_code = substring(replace(gen_random_uuid()::text, '-', ''), 1, 8)
WHERE referral_code IS NULL;

-- Apply to new users via updated handle_new_user trigger
-- OR generate in application code at role-selection time
ALTER TABLE public.profiles
  ALTER COLUMN referral_code SET NOT NULL; -- after backfill
```

### Migration: referrals table
```sql
CREATE TABLE IF NOT EXISTS public.referrals (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_role   text        NOT NULL CHECK (referred_role IN ('trainer', 'client')),
  status          text        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'rewarded', 'expired')),
  reward_type     text        CHECK (reward_type IN ('payout_credit', 'booking_discount')),
  rewarded_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT referrals_no_self_referral CHECK (referrer_id <> referred_id),
  CONSTRAINT referrals_unique_pair UNIQUE (referrer_id, referred_id)
);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Server-side session for attribution | Cookie-based (SameSite=Lax) | Industry standard for OAuth flows | Survives OAuth redirect round-trip correctly |
| Separate credit balance table | Reuse payout_transactions | Phase 9 established this | No new infrastructure needed for referral credits |

---

## Open Questions

1. **How are bookings marked `completed`?**
   - What we know: `bookings.status` has `completed` as a valid value; payout balance logic depends on completed bookings
   - What's unclear: Is `completed` set manually by the trainer in TrainerBookings page? Via a scheduled cron? Via a webhook? The reward trigger depends on this event.
   - Recommendation: Check `TrainerBookings.tsx` for status-update UI before writing the process-referral-reward trigger. If bookings are marked complete client-side via direct Supabase update, the referral reward Edge Function needs to be called from a DB trigger (not a webhook) — or from the frontend at the same point.

2. **Does `profiles` table have email column?**
   - What we know: Edge Functions query `adminClient.from('profiles').select('email')` successfully (seen in `create-payout`, `weekly-payouts`, `stripe-webhook`) — email IS available on the profiles table (sourced from auth.users via Supabase sync)
   - What's unclear: Whether this is a computed column or a persisted column in the schema DDL (the initial migration doesn't show it, but Edge Functions clearly access it)
   - Recommendation: Trust the existing Edge Function pattern. `profiles.email` works. No change needed.

3. **$5 discount attribution direction (REFERRAL-03 clarification)**
   - What we know: REFERRAL-03 says "Client refers trainer → trainer books that client → client gets $5 discount on next booking"
   - What's unclear: "trainer books that client" likely means "trainer's first booking session WITH that client" — i.e., first time a referred trainer appears as the trainer in the referred client's booking. This is unusual (referrer is client, referred is trainer) and the reward goes back to the referring client.
   - Recommendation: Treat as: referring_client → refers → new_trainer. When the new trainer completes a session with the referring client, the referring client gets $5 off their next booking with ANY trainer (not just that specific trainer). Simpler to implement and more useful to the client. Clarify with user if exact scope matters.

---

## DB Schema Changes Required

### New Table: `referrals`
```
referrals (
  id              uuid PK
  referrer_id     uuid FK profiles.id
  referred_id     uuid FK profiles.id
  referred_role   text CHECK ('trainer' | 'client')
  status          text CHECK ('pending' | 'rewarded' | 'expired')
  reward_type     text CHECK ('payout_credit' | 'booking_discount') nullable
  rewarded_at     timestamptz nullable
  created_at      timestamptz
  UNIQUE(referrer_id, referred_id)
  CHECK(referrer_id != referred_id)
)
```

### Columns Added to `profiles`
```
referral_code             text UNIQUE NOT NULL  -- 8-char unique code
referral_discount_pending boolean DEFAULT false  -- client has pending $5 discount
referral_discount_trainer_id uuid nullable       -- which trainer triggered the discount
```

### `payout_transactions.initiated_by` CHECK Constraint
Currently: `CHECK (initiated_by IN ('trainer', 'auto'))`
Must become: `CHECK (initiated_by IN ('trainer', 'auto', 'referral'))`
This requires `ALTER TABLE payout_transactions DROP CONSTRAINT ... ADD CONSTRAINT ...`

### New Edge Function: `process-referral-reward`
- Called from `stripe-webhook` (or from client on booking completion if completed status is set client-side)
- Input: `{ booking_id }`
- Looks up booking → checks `referrals` table → fires appropriate reward → marks referral rewarded

### New RPC: `get_referral_leaderboard()`
- Returns top 10 referrers by rewarded referral count in current calendar month
- SECURITY INVOKER (public — leaderboard is visible without auth)

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Build verification (no vitest configured) |
| Config file | none — matches Phase 9/10 pattern |
| Quick run command | `npm run build 2>&1 \| tail -5` (run from `Cenlar demand gt 1-17/`) |
| Full suite command | `npm run build && npx tsc --noEmit` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REFERRAL-01 | Referral code + share link visible on profile | build | `npm run build 2>&1 \| tail -5` | Wave 0 |
| REFERRAL-02 | Trainer earns $10 payout credit | build + manual | `npm run build` + manual booking flow | Wave 0 |
| REFERRAL-03 | Client gets $5 discount at checkout | build + manual | `npm run build` + manual booking verification | Wave 0 |
| REFERRAL-04 | Cookie attribution survives signup flow | build + manual | `npm run build` + manual ?ref= URL test | Wave 0 |
| REFERRAL-05 | Leaderboard renders top 10 referrers | build | `npm run build 2>&1 \| tail -5` | Wave 0 |
| REFERRAL-06 | In-app + email notifications at milestones | build + manual | `npm run build` + manual referral completion | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd "Cenlar demand gt 1-17" && npm run build 2>&1 | tail -5`
- **Per wave merge:** Full build passes + manual smoke test of referral link → signup flow
- **Phase gate:** Full build green before `/gsd:verify-work`

### Wave 0 Gaps
- No existing test infrastructure — same as Phases 9 and 10
- All verification is build-time type check + manual browser testing
- None — no framework install needed

---

## Sources

### Primary (HIGH confidence)
- Existing codebase — `supabase/migrations/20260311143000_fitconnect_current_schema.sql` — DB schema verified
- Existing codebase — `supabase/functions/stripe-webhook/index.ts` — Resend email pattern, payout reward pattern
- Existing codebase — `supabase/functions/create-payout/index.ts` — `payout_transactions` insert pattern
- Existing codebase — `src/pages/BookSession.tsx` — checkout rate calculation, booking insert logic
- Existing codebase — `src/pages/TrainerDashboard.tsx` — tab pattern, `useAuthStore` pattern
- Existing codebase — `supabase/migrations/20260314200000_payout_system.sql` — `payout_transactions` schema with `initiated_by` constraint

### Secondary (MEDIUM confidence)
- MDN Web Docs — SameSite=Lax cookie behavior with OAuth redirects — standard browser behavior
- Phase 9 RESEARCH.md — confirmed Resend pattern, payout_transactions architecture

### Tertiary (LOW confidence)
- Booking `completed` transition mechanism — inferred from schema, not verified from UI code (see Open Questions #1)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed, no new dependencies
- Architecture: HIGH — all patterns derived from existing working code in Phases 9/10
- DB schema changes: HIGH — based on actual schema DDL
- `payout_transactions` credit pattern: HIGH — direct reuse of Phase 9 infrastructure
- Cookie attribution flow: MEDIUM — SameSite=Lax behavior is standard but OAuth provider behavior can vary
- Booking `completed` trigger point: LOW — Open Question #1 must be resolved before writing process-referral-reward

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (stable stack, no fast-moving dependencies)
