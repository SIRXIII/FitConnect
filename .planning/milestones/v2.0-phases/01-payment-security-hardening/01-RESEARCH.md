# Phase 1: Payment & Security Hardening - Research

**Researched:** 2026-03-12
**Domain:** Supabase RLS, Stripe Connect, Edge Function auth, client-side key exposure, input sanitization
**Confidence:** HIGH

---

## Summary

This phase eliminates all 5 critical security vulnerabilities in the FitConnect codebase. The good news: the backend is significantly more complete than CONCERNS.md suggested. The `create-payment-intent` Edge Function already verifies JWT, validates ownership, and uses idempotency keys. The migration file contains full RLS policies for all 7 tables. The `stripe-webhook` function validates the Stripe signature. The actual work is smaller and more targeted than a fresh audit would imply.

The two genuine critical fixes are: (1) the **booking-before-payment-intent race condition** in `BookSession.tsx` — the client creates a DB booking record, then calls the Edge Function; if anything fails between those steps, an orphaned `pending` booking is left with no payment record; and (2) the **GEMINI_API_KEY exposure** — `vite.config.ts` line 18 bakes `GEMINI_API_KEY` into the client bundle via `process.env.GEMINI_API_KEY` using Vite `define`, making it extractable from the built JS. The SQL injection risk is low-severity in practice (Supabase uses parameterized queries under the hood for `ilike`), but length-capping and character whitelisting should still be added for defense-in-depth.

**Primary recommendation:** Fix the booking flow order (payment intent first, then insert booking), add a cleanup mechanism for abandoned `pending` bookings with no `payments` row, remove GEMINI_API_KEY from `vite.config.ts`, document and smoke-test the existing RLS policies, and add request-body validation to the two Edge Functions that currently lack it (`create-connect-account` only does partial validation; `send-notification-email` does not exist in the repo yet).

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REQ-SEC-01 | Fix Payment Race Condition: create payment intent before booking record; implement abandoned flow cleanup; add idempotency keys | BookSession.tsx creates booking at line 157 before calling Edge Function at line 186. Edge Function already has idempotency key. Fix: reorder + add cleanup cron or DB trigger. |
| REQ-SEC-02 | Fix SQL Injection in Trainer Search: validate/sanitize `ilike()` input; max length, character whitelist, rate limiting | useTrainers.ts line 46 passes raw `options.location` to `ilike()`. Supabase uses parameterized queries so true injection is blocked, but length+charset validation needed for DoS prevention. |
| REQ-SEC-03 | Verify and Harden RLS Policies: audit all Supabase RLS; ensure row-level isolation for bookings, profiles, slots, reviews | Full RLS is implemented in migration file. All 7 tables have RLS enabled and policies defined. Audit needed to verify correctness and document gaps. |
| REQ-SEC-04 | Edge Function Auth Verification: JWT verification + request body validation on all 4 Edge Functions | `create-payment-intent` and `create-connect-account` already verify JWT via `userClient.auth.getUser()`. `stripe-webhook` uses Stripe signature (correct, no JWT needed). `send-notification-email` function file does not exist in repo — must be created. |
| REQ-SEC-05 | Move GEMINI_API_KEY Server-Side: remove client-exposed API key; move AI calls to Edge Function or server proxy | `vite.config.ts` line 18-19 exposes `GEMINI_API_KEY` via Vite `define`. Key is baked into the client bundle. Remove `define` block; key is not actively used in source code. |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | 2.99.0 | Database, auth, RLS | Already in project; service-role client used in Edge Functions |
| Stripe (npm:stripe) | 14.25.0 | Payment intents, webhooks | Already used in Edge Functions |
| Deno (Supabase Edge Runtime) | Latest | Edge Function runtime | Required for Supabase Functions |
| Zod | 3.x | Input validation schema | De facto TypeScript validation standard; not yet in project, install needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| AbortSignal.timeout | Native | Fetch timeout | Wrap Edge Function calls to prevent indefinite hang |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Zod | Valibot | Zod is more widely understood; Valibot is smaller. Use Zod since it's referenced in REQUIREMENTS.md and CONCERNS.md already. |
| Cleanup cron job | DB trigger on bookings | DB trigger is simpler for this phase; cron needs additional infra. |

**Installation (client-side only):**
```bash
cd "Cenlar demand gt 1-17"
npm install zod
```

No additional Edge Function dependencies needed — Stripe and Supabase already imported.

---

## Architecture Patterns

### What Actually Exists vs. What CONCERNS.md Assumed

CONCERNS.md was written before the Edge Functions were added to the repo. The actual state:

| Concern | Status |
|---------|--------|
| Edge Functions not in repo | RESOLVED — `supabase/functions/` exists with 3 functions |
| No JWT verification in Edge Functions | RESOLVED — both payment functions call `userClient.auth.getUser()` |
| No idempotency keys | RESOLVED — `idempotencyKey: \`fitconnect_booking_${booking.id}\`` exists |
| No RLS visible | RESOLVED — full RLS in migration file |
| No Stripe webhook validation | RESOLVED — `stripe.webhooks.constructEvent()` validates signature |
| Booking before payment intent | **STILL TRUE** — BookSession.tsx lines 157-206 create booking first |
| GEMINI_API_KEY in client bundle | **STILL TRUE** — vite.config.ts line 18 |
| Input sanitization on search | **STILL TRUE** — no length/charset validation |

### Recommended Project Structure for This Phase

No new directories needed. Changes are surgical:

```
Cenlar demand gt 1-17/
├── src/
│   ├── pages/BookSession.tsx          # Reorder: payment intent → booking insert
│   ├── hooks/useTrainers.ts           # Add input sanitization helper
│   └── lib/
│       └── sanitize.ts                # New: sanitizeSearchInput() utility
├── supabase/
│   ├── functions/
│   │   ├── create-payment-intent/     # Add abandoned booking cleanup logic
│   │   ├── send-notification-email/   # New: create with JWT auth + body validation
│   │   └── _shared/
│   │       └── validate.ts            # New: shared request body validator
│   └── migrations/
│       └── 20260312_cleanup_abandoned_bookings.sql  # New: cleanup function/trigger
├── vite.config.ts                     # Remove GEMINI_API_KEY define block
└── .planning/codebase/
    └── RLS_POLICIES.md                # New: RLS documentation (per CONCERNS.md #3)
```

### Pattern 1: Payment-Intent-First Booking Flow

**What:** Create payment intent in Edge Function first; only insert booking record after `clientSecret` is obtained.
**When to use:** Any time a booking creation is gated on a successful payment setup.

Current broken flow:
```
[Client] → INSERT booking (pending) → POST /create-payment-intent → show Stripe UI
           ↑ booking exists even if Edge Function fails
```

Correct flow:
```
[Client] → POST /create-payment-intent (no booking_id yet) → receive clientSecret
         → INSERT booking with payment_intent_id → show Stripe UI
```

**Implementation approach:**
The Edge Function must be modified to accept slot/trainer data and create the payment intent without a pre-existing booking. The booking insert happens client-side only after `clientSecret` is returned successfully. The Edge Function then needs the booking_id for the `payments` table upsert — this means we either: (a) pass slot metadata to the Edge Function and let it create both PI and record, or (b) have the client insert the booking AFTER receiving clientSecret, then call a second endpoint to link them.

Simplest correct approach: **Client creates booking → immediately calls Edge Function → if Edge Function fails, client cancels/deletes the booking.** This is close to the current approach but adds explicit cleanup on failure path instead of leaving orphaned records.

Better approach: **Edge Function receives slot_id + notes → creates PI → client inserts booking with payment_intent_id in one atomic step.** Requires Edge Function to know about slot ownership and rate (it already queries trainer_profiles).

```typescript
// Source: src/pages/BookSession.tsx - corrected handleBooking()
const handleBooking = async () => {
  // Step 1: Create payment intent FIRST (no booking record yet)
  const piResponse = await fetch(`${SUPABASE_URL}/functions/v1/create-payment-intent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ slot_id: slot.id }),  // slot_id instead of booking_id
  });

  if (!piResponse.ok) {
    setPaymentError('Payment setup failed. Please try again.');
    return;
  }

  const { clientSecret, paymentIntentId } = await piResponse.json();

  // Step 2: Insert booking with payment_intent_id linked
  const { data, error } = await supabase.from('bookings').insert({
    client_id: user.id,
    trainer_id: trainerProfile.id,
    slot_id: slot.id,
    status: 'pending',
    rate_charged: rate,
    platform_fee: platformFee,
    trainer_payout: trainerPayout,
    payment_intent_id: paymentIntentId,  // link immediately
    notes: notes || null,
  }).select('id').single();

  if (error) {
    // Cancel the payment intent since we have no booking
    await cancelPaymentIntent(paymentIntentId);
    setPaymentError('Booking failed. The session may no longer be available.');
    return;
  }

  setClientSecret(clientSecret);
  setBookingId(data.id);
  setStep('payment');
};
```

### Pattern 2: Abandoned Booking Cleanup

**What:** A DB function that marks stale `pending` bookings (no `payments` row after N minutes) as `cancelled`.
**When to use:** Background cleanup for edge cases where the browser closes after booking insert but before payment.

```sql
-- Migration: cleanup_abandoned_bookings()
-- Source: Standard Supabase pattern for scheduled cleanup
CREATE OR REPLACE FUNCTION public.cleanup_abandoned_bookings()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cancelled_count integer;
BEGIN
  UPDATE public.bookings
  SET status = 'cancelled',
      cancellation_reason = 'Abandoned payment flow',
      updated_at = now()
  WHERE status = 'pending'
    AND created_at < now() - interval '30 minutes'
    AND NOT EXISTS (
      SELECT 1 FROM public.payments p WHERE p.booking_id = bookings.id
    );

  GET DIAGNOSTICS cancelled_count = ROW_COUNT;
  RETURN cancelled_count;
END;
$$;
```

This can be called by a Supabase scheduled cron (pg_cron) or manually via the `stripe-webhook` function when payment_intent.canceled fires.

### Pattern 3: Input Sanitization for Search

**What:** Strip dangerous characters and enforce length limits on search strings before passing to Supabase queries.
**When to use:** Any user-provided string used in `ilike()`, `eq()`, or other query operators.

```typescript
// Source: Defensive coding best practice for Supabase ilike()
// File: src/lib/sanitize.ts

/**
 * Sanitize a location search string.
 * - Max 50 characters
 * - Allow: letters, numbers, spaces, commas, periods, hyphens, apostrophes
 * - Strip everything else
 */
export function sanitizeSearchInput(raw: string): string {
  return raw
    .slice(0, 50)
    .replace(/[^a-zA-Z0-9\s,.\-']/g, '')
    .trim();
}
```

In `useTrainers.ts`:
```typescript
if (options.location) {
  const safe = sanitizeSearchInput(options.location);
  if (safe.length > 0) {
    query = query.ilike('location', `%${safe}%`);
  }
}
```

### Pattern 4: Remove Client-Side API Key Exposure

**What:** Remove `GEMINI_API_KEY` from Vite `define` block so it is not bundled into client JS.
**When to use:** Any server-side secret must never appear in `vite.config.ts` `define` or with `VITE_` prefix.

```typescript
// vite.config.ts — REMOVE these lines:
define: {
  'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),  // DELETE
},
```

The key is not used anywhere in the current source code (confirmed by search). Removing the `define` block has zero functional impact. When Gemini AI features are implemented (Phase 7), they will go through a new `ai-proxy` Edge Function that reads `GEMINI_API_KEY` from Deno environment secrets.

### Pattern 5: Edge Function Auth Pattern (already implemented correctly)

Both `create-payment-intent` and `create-connect-account` follow the correct pattern. Document it for `send-notification-email`:

```typescript
// Source: supabase/functions/create-payment-intent/index.ts (lines 31-49)
// Pattern: User-scoped client for auth, service-role client for data operations

const authHeader = req.headers.get('Authorization') || '';
const userClient = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { Authorization: authHeader } },
  auth: { persistSession: false },
});

const { data: { user }, error: userError } = await userClient.auth.getUser();
if (userError || !user) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, ... });
}

// Use adminClient for operations that need service_role
const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false },
});
```

### Anti-Patterns to Avoid

- **Booking-before-payment-intent:** Never insert a DB record that depends on a subsequent API call succeeding. Create the external resource first, then record it.
- **Vite `define` for secrets:** Never put server-only keys in Vite `define`. Only `VITE_` prefixed variables should be in the client bundle.
- **`apikey` header in client fetch:** `BookSession.tsx` line 193 includes `apikey: import.meta.env.VITE_SUPABASE_ANON_KEY` in fetch headers. This is redundant (the Edge Function uses auth token, not anon key). Remove to reduce surface area.
- **Trusting `is_booked` flag alone:** The migration already handles this correctly with DB triggers, but client code must not bypass the trigger by checking `is_booked` manually before insert.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Payment intent idempotency | Custom dedup logic | Stripe idempotency key (`idempotencyKey` param) | Already implemented in Edge Function; Stripe handles retries correctly |
| Webhook signature verification | Custom HMAC | `stripe.webhooks.constructEvent()` | Already implemented; hand-rolling will miss timing attacks |
| JWT verification in Edge Functions | Custom JWT decode | `userClient.auth.getUser()` pattern | Already implemented; Supabase handles token refresh, revocation |
| Input sanitization regex | Complex allow-lists | Simple `replace(/[^allowed]/g, '')` + length cap | Sufficient for search strings; Supabase parameterizes queries |
| Abandoned booking detection | Polling from client | PostgreSQL function + pg_cron or webhook trigger | Server-side is reliable; client can close tab at any time |

---

## Common Pitfalls

### Pitfall 1: The `booking_id` Dependency in `create-payment-intent`

**What goes wrong:** The current Edge Function expects `booking_id` in the request body. If you reorder the flow so booking is created after PI, you either need to change the Edge Function signature or use a two-call approach.
**Why it happens:** The Edge Function was designed for the current (broken) flow.
**How to avoid:** Change Edge Function to accept `slot_id` + client auth, create PI with slot metadata, return `clientSecret` + `paymentIntentId`. Then client inserts booking with `payment_intent_id` column. Requires a DB migration to add `payment_intent_id` to `bookings` table.
**Warning signs:** If `booking_id` is still required by the Edge Function after refactoring, the race condition has not been fixed.

### Pitfall 2: Booking Trigger Race with PI-First Flow

**What goes wrong:** The `lock_and_mark_slot_on_booking_insert()` DB trigger runs on `bookings INSERT`. If two clients race to insert a booking for the same slot after both received a valid `clientSecret`, the second insert will fail with "Slot is already booked". This is correct behavior — the slot lock prevents double-booking.
**Why it happens:** Stripe PI creation is not atomic with DB slot locking.
**How to avoid:** The client must handle a 409-type error from the booking INSERT gracefully, cancel the PI for the losing client, and show "Sorry, this slot was just booked."
**Warning signs:** Users reporting payment charged but no booking created.

### Pitfall 3: RLS on `bookings` Update During Cleanup

**What goes wrong:** The `cleanup_abandoned_bookings()` function runs as `SECURITY DEFINER` and bypasses RLS. This is correct for a cleanup job. However, if invoked via client-exposed API without service-role protection, any user could trigger cleanup of other users' bookings.
**Why it happens:** PostgreSQL `SECURITY DEFINER` functions run as the function owner, not the caller.
**How to avoid:** Never expose the cleanup function as a client-callable RPC without `auth.role() = 'service_role'` guard. Call it only from the webhook Edge Function or a scheduled job.

### Pitfall 4: Vite `define` vs. `VITE_` Prefix Confusion

**What goes wrong:** Developers add `GEMINI_API_KEY` back as `VITE_GEMINI_API_KEY` thinking the prefix is required for Vite env vars. All `VITE_` vars are public by design.
**Why it happens:** Vite's env var convention (`VITE_` = public) is easily confused.
**How to avoid:** Server-only keys must NEVER have `VITE_` prefix and must NEVER appear in `vite.config.ts` `define`. Document this explicitly in `.env.local.example`.

### Pitfall 5: CORS Wildcard in Edge Functions

**What goes wrong:** `cors.ts` sets `'Access-Control-Allow-Origin': '*'`. This is fine for non-credentialed requests, but it means any origin can call the Edge Functions. The JWT auth mitigates this, but is worth documenting.
**Why it happens:** Supabase Edge Functions require CORS headers for browser calls.
**How to avoid:** For this phase, wildcard CORS is acceptable since JWT auth is the authorization mechanism. Do not lock CORS to specific origins without testing all client deployment environments.

### Pitfall 6: `send-notification-email` Function Missing

**What goes wrong:** The function is referenced in the additional context (4 Edge Functions deployed: create-payment-intent, stripe-webhook, create-connect-account, **send-notification-email**) but the file does not exist in the repo under `supabase/functions/`. The deployed version exists on Supabase infrastructure but has no source in version control.
**Why it happens:** Function was deployed manually without being committed to the repo.
**How to avoid:** Recover the function source from Supabase dashboard or recreate it. For REQ-SEC-04, the function must be added to the repo with JWT verification.

---

## Code Examples

Verified patterns from the actual codebase:

### Current Broken Booking Flow (to be fixed)
```typescript
// Source: BookSession.tsx lines 157-206 — CURRENT (broken) ORDER
// 1. Booking INSERT happens first (line 157-170)
const { data, error } = await supabase.from('bookings').insert({ ... }).select('id').single();

// 2. Payment intent created AFTER (line 186-197) — race condition window here
const response = await fetch(`${SUPABASE_URL}/functions/v1/create-payment-intent`, {
  body: JSON.stringify({ booking_id: data.id }),  // booking already exists
});
```

### Idempotency Key (already correct in Edge Function)
```typescript
// Source: supabase/functions/create-payment-intent/index.ts line 196
const paymentIntent = await stripe.paymentIntents.create(
  { ... },
  { idempotencyKey: `fitconnect_booking_${booking.id}` }  // correct
);
```

### JWT Auth Pattern (already correct in Edge Functions)
```typescript
// Source: supabase/functions/create-payment-intent/index.ts lines 31-49
const userClient = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { Authorization: authHeader } },
  auth: { persistSession: false },
});
const { data: { user }, error: userError } = await userClient.auth.getUser();
if (userError || !user) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, ... });
}
```

### GEMINI_API_KEY Exposure (to be removed)
```typescript
// Source: vite.config.ts lines 17-19 — DELETE this block
define: {
  'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
},
```

### Existing RLS: Bookings Insert Policy (correct)
```sql
-- Source: supabase/migrations/20260311143000_fitconnect_current_schema.sql line 709-713
create policy bookings_insert_client
on public.bookings
for insert
with check (client_id = auth.uid());  -- client can only create bookings for themselves
```

### Existing RLS: Payments Insert Policy (correct)
```sql
-- Source: migration line 797-800
create policy payments_insert_service_role
on public.payments
for insert
with check (auth.role() = 'service_role');  -- only Edge Functions can insert payments
```

### Slot Locking DB Trigger (already correct)
```sql
-- Source: migration lines 311-357 — lock_and_mark_slot_on_booking_insert()
-- This uses SELECT FOR UPDATE to prevent double-booking at DB level
select * into locked_slot from public.availability_slots
where id = new.slot_id FOR UPDATE;  -- serializes concurrent booking attempts

if locked_slot.is_booked then
  raise exception 'Slot is already booked';
end if;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual JWT decode in Edge Functions | `supabase.auth.getUser()` with user-scoped client | Supabase SDK v2 | Handles token refresh/revocation automatically |
| Webhook signature manual verification | `stripe.webhooks.constructEvent()` | Stripe SDK v3+ | Prevents replay attacks |
| Stripe `on_behalf_of` | Stripe Connect destination charges with `transfer_data` | Stripe Connect docs 2023 | Correct for marketplace model; already implemented |

**Deprecated/outdated:**
- `apikey` header in client fetch to Edge Functions: The Supabase client's `Authorization: Bearer <token>` is sufficient. The `apikey` header is only needed when not using a user JWT. Remove from `BookSession.tsx` line 193.

---

## Open Questions

1. **`send-notification-email` function source recovery**
   - What we know: The function is deployed on Supabase but not in the repo.
   - What's unclear: What does it do? Does it use Resend, SendGrid, or Supabase's built-in email?
   - Recommendation: Retrieve source from Supabase dashboard (Project > Edge Functions) before implementing REQ-SEC-04. If unrecoverable, recreate with JWT auth based on the existing pattern.

2. **Payment intent flow refactor scope**
   - What we know: The Edge Function currently requires a `booking_id`. Changing to `slot_id`-first requires modifying both the Edge Function and adding a `payment_intent_id` column to `bookings`.
   - What's unclear: Whether the simpler approach (booking insert → on-failure auto-cancel) is acceptable as an interim fix.
   - Recommendation: The simpler fix (add explicit cancellation on payment intent failure, rely on the 30-minute cleanup job for browser-close scenarios) is sufficient for Phase 1 and avoids a large refactor. The more correct flow (PI first) is ideal but is a larger change.

3. **pg_cron availability**
   - What we know: Supabase Pro plans include pg_cron for scheduled tasks.
   - What's unclear: Whether this project's Supabase plan includes pg_cron.
   - Recommendation: Implement cleanup as a callable DB function. Hook it into the `stripe-webhook` function for `payment_intent.canceled` events (already handled). Defer scheduled cron to after confirming plan tier.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None — no test suite exists in this project |
| Config file | None (Wave 0 must create) |
| Quick run command | N/A — to be established |
| Full suite command | N/A — to be established |

Per STATE.md: "No test suite exists — consider adding after security hardening." For Phase 1, validation is manual/smoke-test based. The planner should include verification steps as manual checks rather than automated tests.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-SEC-01 | Payment intent created before booking exists in DB | manual-only | N/A | ❌ no test infra |
| REQ-SEC-01 | Abandoned pending bookings cancelled after 30 min | manual-only | N/A | ❌ no test infra |
| REQ-SEC-02 | Special chars in location search are stripped | manual-only | N/A | ❌ no test infra |
| REQ-SEC-02 | Location strings > 50 chars are truncated | manual-only | N/A | ❌ no test infra |
| REQ-SEC-03 | Client cannot read another client's bookings | manual-only | N/A | ❌ no test infra |
| REQ-SEC-03 | Trainer cannot modify another trainer's slots | manual-only | N/A | ❌ no test infra |
| REQ-SEC-04 | Unauthenticated call to create-payment-intent returns 401 | manual-only | N/A | ❌ no test infra |
| REQ-SEC-04 | Unauthenticated call to create-connect-account returns 401 | manual-only | N/A | ❌ no test infra |
| REQ-SEC-05 | GEMINI_API_KEY absent from built client bundle | manual-only | `grep -r "GEMINI" dist/` | ❌ no test infra |

### Sampling Rate
- **Per task commit:** Manual verification step described in PLAN.md task
- **Per wave merge:** Manual regression check of booking flow end-to-end
- **Phase gate:** All 5 requirement success criteria met before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] No test framework installed — out of scope for Phase 1 (addressed post-Phase 1 per STATE.md)
- The `grep -r "GEMINI" dist/` check for REQ-SEC-05 can run after `npm run build` without a test framework

---

## Sources

### Primary (HIGH confidence)
- `supabase/functions/create-payment-intent/index.ts` — confirmed JWT auth, idempotency key, ownership check
- `supabase/functions/stripe-webhook/index.ts` — confirmed Stripe signature validation
- `supabase/migrations/20260311143000_fitconnect_current_schema.sql` — confirmed full RLS on all 7 tables
- `src/pages/BookSession.tsx` — confirmed booking-before-intent race condition (lines 157, 186)
- `vite.config.ts` — confirmed GEMINI_API_KEY in `define` block (line 18)
- `src/hooks/useTrainers.ts` — confirmed raw user input in `ilike()` (line 46)

### Secondary (MEDIUM confidence)
- Supabase RLS documentation patterns — consistent with migration file implementation
- Stripe Connect destination charges pattern — confirmed by `transfer_data` in Edge Function

### Tertiary (LOW confidence)
- `send-notification-email` function behavior — function not in repo, behavior unknown

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in project, no new choices needed
- Architecture: HIGH — code has been read directly; findings are concrete, not inferred
- Pitfalls: HIGH — derived from actual code inspection, not speculation
- RLS audit: HIGH — policies are fully present in migration file; correctness is verifiable

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (stable stack; Supabase/Stripe APIs unlikely to break patterns within 30 days)
