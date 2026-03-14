# Phase 9: Trainer Payout System - Research

**Researched:** 2026-03-14
**Domain:** Stripe Connect Transfers, Supabase pg_cron, Resend.com email, React tab UI
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Payout dashboard lives as a new **Payouts tab** inside the existing TrainerDashboard page
- Tab structure after Phase 9: **Overview | Payouts** (Phase 10 adds Analytics)
- Overview remains the default tab — trainers land there first
- No Navbar link — trainers reach Payouts via TrainerDashboard → Payouts tab only
- **Available balance** (withdrawable now) is the primary hero metric — large number, prominent
- Pending balance shown smaller below with a tooltip: "Completed sessions not yet paid out"
- No fee breakdown shown at the balance level — just the net withdrawable amount
- Single combined transaction table: both individual booking credits and Stripe payout transfer rows
- Columns: **Date | Client | Amount | Status**
- Status labels: **Completed** (green) | **Pending** (amber) | **Failed** (red) — matches existing badge pattern
- Sort: newest first, no filtering (filtering deferred to Phase 10 Analytics)
- Net payout per row only — no per-row fee breakdown visible
- "Request Payout" button on Payouts tab
- Button disabled (with tooltip "Minimum $50 required") when available balance < $50
- Click opens **confirmation modal**: "Request payout of $X.XX? Funds arrive within 2 business days." with Confirm/Cancel
- On success: toast notification + available balance immediately clears to $0
- On failure: error toast ("Payout failed. Please try again or contact support.") + balance restored
- Wire up **Resend.com** in the send-notification-email Edge Function (free tier: 100/day)
- **Initiation email**: "Your payout of $X.XX has been initiated. Funds expected within 2 business days."
- **Completion email**: "Your payout of $X.XX has arrived in your bank account." — triggered by Stripe webhook confirming transfer
- Both emails required (PAYOUT-06)
- Email subjects: "Your FitRush payout has been initiated" / "Your FitRush payout has arrived"
- Confirmation modal copy: "Request payout of $X.XX? Funds arrive within 2 business days."
- Disabled button tooltip: "Minimum $50 required"

### Claude's Discretion
- Weekly auto-payout scheduler implementation (Supabase pg_cron vs Edge Function cron)
- Resend API key env var name and config pattern
- Exact modal and toast copy beyond what's specified above
- Error state details for network failures
- Loading skeleton for the Payouts tab

### Deferred Ideas (OUT OF SCOPE)
- Custom payout amount (partial withdrawal) — user chose full-balance only for now
- Payout filtering by date/status on transaction table — Phase 10 Analytics adds time-range filtering
- PIN/password confirmation for payouts — not needed, modal confirmation is sufficient
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PAYOUT-01 | Trainer sees available balance + pending balance on payout dashboard | Balance query against `payments` table (SUM trainer_payout WHERE status=succeeded AND not yet paid out), realtime subscription via `supabase.channel()` for live updates |
| PAYOUT-02 | Trainer can initiate on-demand payout when balance ≥ $50 | `create-payout` Edge Function calls `stripe.transfers.create()` with destination = `trainer_profiles.stripe_account_id`; minimum threshold enforced in UI and Edge Function |
| PAYOUT-03 | Platform auto-initiates weekly payout every Monday for trainers with balance ≥ $50 | `weekly-payouts` Edge Function invoked by pg_cron SQL job using `net.http_post()` every Monday at 09:00 UTC; loops trainers with balance ≥ $50 |
| PAYOUT-04 | Balance = completed bookings sum − 8% platform fee − Stripe fees (~2.9% + $0.30) | `payments.trainer_payout` column already stores the net per-booking amount post-fee deduction; balance = SUM of unpaid trainer_payout rows |
| PAYOUT-05 | Transaction history shows date, amount, status per transfer | New `payout_transactions` table (or query joining `payments` + `payouts` tables) feeds the combined transaction table in the UI |
| PAYOUT-06 | Trainer receives email when payout is initiated and when it completes | Resend.com integrated into `send-notification-email` Edge Function; initiation email triggered by `create-payout`; completion email triggered by `payout.paid` webhook event |
</phase_requirements>

---

## Summary

Phase 9 implements the full trainer payout lifecycle: balance visibility, on-demand withdrawals, weekly auto-payouts, transaction history, and email notifications. The stack is entirely within existing project patterns — Stripe Connect (already wired), Supabase Edge Functions (already established), React tabs (AdminDashboard pattern to copy), and Resend.com (stub already exists in `send-notification-email`).

The most important architectural insight is the **Transfer vs. Payout distinction**: when the platform calls `stripe.transfers.create()`, it moves funds from the platform Stripe balance into the connected Express account's Stripe balance. Stripe then automatically routes those funds to the trainer's bank via its normal payout schedule (typically 2 business days for standard accounts). The `payout.paid` webhook fires on the connected account when funds are expected in the bank — this is what triggers the completion email.

The weekly auto-payout is best implemented as a dedicated Edge Function (`weekly-payouts`) invoked by a pg_cron SQL job using `net.http_post()` and Supabase Vault for credentials. This is the official Supabase-documented pattern and avoids maintaining separate cron infrastructure.

**Primary recommendation:** Use `stripe.transfers.create()` (not `stripe.payouts.create()`) for platform-initiated payouts; track transfer state in a new `payout_transactions` table; use pg_cron via SQL migration for the Monday schedule.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| stripe (npm) | 14.25.0 | Stripe Transfers API calls from Edge Functions | Already in project at this version — do not upgrade |
| @supabase/supabase-js | 2.49.8 | Supabase client in Edge Functions | Already pinned at this version |
| Resend (fetch-based) | N/A (no SDK) | Transactional email via REST API | No Deno SDK exists; project uses fetch natively |
| pg_cron + pg_net | built-in Supabase | Schedule weekly Edge Function invocation | Official Supabase cron pattern, no extra infra |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sonner | 2.0.7 | Toast notifications (success/error) | Already in project — use for payout success/failure feedback |
| lucide-react | 0.555.0 | Icons (DollarSign, Clock) | Already in project — use for balance card icons |
| Supabase Vault | built-in | Securely store project URL + service role key for pg_cron | Required for pg_cron → Edge Function invocation pattern |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pg_cron SQL job | Edge Function with `--cron` header | pg_cron is more reliable, visible in DB, and is the officially documented Supabase approach |
| Resend fetch API | Supabase Auth emails | Resend gives branded, custom HTML emails; Supabase Auth emails are limited to auth flows |
| `payout_transactions` table | Querying `payments` table directly | Dedicated table separates booking credits from Stripe transfer rows cleanly, enables proper history pagination |

**Installation:**
No new frontend packages needed. Resend is called via fetch in the Edge Function — no npm package required in Deno context.

---

## Architecture Patterns

### Recommended Project Structure
```
supabase/
├── functions/
│   ├── create-payout/         # On-demand payout for a single trainer
│   │   └── index.ts
│   └── weekly-payouts/        # Loops all trainers with balance ≥ $50, calls Stripe transfers
│       └── index.ts
├── migrations/
│   └── 20260314000000_payout_system.sql   # payout_transactions table + pg_cron job

src/
└── pages/
    └── TrainerDashboard.tsx   # Add tab state + PayoutsTab component inline or extracted
```

No new component folder needed — the Payouts tab can be a sub-component in TrainerDashboard.tsx following the AdminDashboard inline tab pattern.

### Pattern 1: Tab Switcher (copy from AdminDashboard)
**What:** State-based tab navigation with `useState<'overview' | 'payouts'>('overview')`
**When to use:** Matches the established admin dashboard pattern exactly

```typescript
// Source: AdminDashboard.tsx line 42 and 188-202
const [activeTab, setActiveTab] = useState<'overview' | 'payouts'>('overview');

// Tab bar render:
<div className="flex border-b border-ink/10">
  {(['overview', 'payouts'] as const).map((tab) => (
    <button
      key={tab}
      onClick={() => setActiveTab(tab)}
      className={`px-8 py-3 text-[10px] uppercase tracking-[0.25em] font-medium transition-colors ${
        activeTab === tab
          ? 'border-b-2 border-ink text-ink -mb-px'
          : 'text-ink/40 hover:text-ink'
      }`}
    >
      {tab}
    </button>
  ))}
</div>
```

### Pattern 2: Balance Query (SQL)
**What:** Calculate available balance as SUM of unpaid trainer_payout from payments
**When to use:** PAYOUT-01, PAYOUT-04

```sql
-- Available balance: succeeded payments not yet included in a payout transfer
SELECT COALESCE(SUM(p.trainer_payout), 0) AS available_balance
FROM payments p
JOIN bookings b ON b.id = p.booking_id
WHERE b.trainer_id = $1
  AND p.status = 'succeeded'
  AND p.payout_transaction_id IS NULL;

-- Pending balance: booking credits not yet succeeded
SELECT COALESCE(SUM(p.trainer_payout), 0) AS pending_balance
FROM payments p
JOIN bookings b ON b.id = p.booking_id
WHERE b.trainer_id = $1
  AND p.status IN ('pending', 'processing');
```

This requires adding a `payout_transaction_id` column to `payments` to track which payments have been swept into a payout.

### Pattern 3: Stripe Transfer (Edge Function)
**What:** Move platform balance to connected Express account
**When to use:** `create-payout` and `weekly-payouts` functions

```typescript
// Source: Stripe Transfers API docs — https://docs.stripe.com/api/transfers/create
const transfer = await stripe.transfers.create({
  amount: Math.round(availableBalanceDollars * 100), // convert to cents
  currency: 'usd',
  destination: trainerProfile.stripe_account_id,
  metadata: {
    trainer_id: trainerProfile.id,
    payout_transaction_id: payoutRecord.id,
  },
});
```

**Important:** Amount is in cents (integer). `destination` is the `stripe_account_id` from `trainer_profiles`. This moves money from the *platform's* Stripe balance to the connected account balance. Stripe then auto-pays out to bank on the connected account's payout schedule.

### Pattern 4: Edge Function Auth (existing project pattern)
**What:** Bearer token validation + service role for DB writes
**When to use:** `create-payout` — called from the frontend with trainer's JWT

```typescript
// Source: create-connect-account/index.ts (existing pattern)
const authHeader = req.headers.get('Authorization') || '';
const userClient = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { Authorization: authHeader } },
  auth: { persistSession: false },
});
const { data: { user }, error: userError } = await userClient.auth.getUser();
// Then use adminClient (serviceRoleKey) for DB writes
```

### Pattern 5: pg_cron Weekly Schedule
**What:** SQL migration creates a cron job that POSTs to the weekly-payouts Edge Function every Monday at 09:00 UTC
**When to use:** PAYOUT-03

```sql
-- Source: https://supabase.com/docs/guides/functions/schedule-functions
-- Run once in migration after storing secrets in Vault
SELECT vault.create_secret('https://YOUR_PROJECT_REF.supabase.co', 'project_url');
SELECT vault.create_secret('YOUR_SERVICE_ROLE_KEY', 'service_role_key');

SELECT cron.schedule(
  'weekly-trainer-payouts',
  '0 9 * * 1',  -- Every Monday at 09:00 UTC
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/weekly-payouts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

The `weekly-payouts` function should use the service role key (from the Authorization header it receives) to query all trainers with balance ≥ $50 and iterate through them, calling `stripe.transfers.create()` for each.

### Pattern 6: Resend Email (Edge Function)
**What:** HTTP POST to Resend API, replacing the console.log stub in `send-notification-email`
**When to use:** PAYOUT-06 — initiation + completion emails

```typescript
// Source: https://resend.com/docs/send-with-supabase-edge-functions
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

const res = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${RESEND_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    from: 'FitRush <noreply@fitrush.app>',  // must match verified domain
    to: [trainerEmail],
    subject: subject,
    html: htmlBody,
  }),
});
```

**Env var name:** `RESEND_API_KEY` — set in Supabase Edge Function secrets via `supabase secrets set RESEND_API_KEY=...`

### Pattern 7: payout.paid Webhook Handler
**What:** Handle `payout.paid` event in existing `stripe-webhook/index.ts` to trigger completion email
**When to use:** PAYOUT-06 completion email

```typescript
// Add to the switch statement in stripe-webhook/index.ts
case 'payout.paid': {
  // NOTE: payout.paid fires on the CONNECTED ACCOUNT, not the platform account.
  // This event arrives when Stripe expects funds to be in the trainer's bank.
  // The event's account field identifies which connected account it belongs to.
  const payout = event.data.object as Stripe.Payout;
  // Look up payout_transaction by stripe_transfer_id to find trainer
  // Then call send-notification-email for the completion email
  break;
}
```

**Critical:** `payout.paid` fires on the connected account's event stream, not the platform's. The Stripe webhook endpoint must be configured to receive Connect events (use "Listen to events on Connected accounts" in Stripe Dashboard), or handle via the `account` property on the event object.

### Anti-Patterns to Avoid
- **Calling `stripe.payouts.create()`:** This creates a payout FROM a connected account to their bank — it requires the connected account's secret key and is not how platforms initiate transfers. Use `stripe.transfers.create()` instead.
- **Hardcoding platform fee:** Always read from `platform_settings` table. `payments.trainer_payout` is already calculated correctly, so just SUM that column.
- **Storing balance in a column:** Available balance is always derived from the `payments` table at query time. Never cache it in a column — it will drift.
- **Calling `send-notification-email` from the webhook handler directly:** The webhook handler uses service role, so it can call the Resend API directly rather than calling another Edge Function. Simplify by inlining the Resend call or sharing a helper module.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email delivery | Custom SMTP sender | Resend.com fetch API | DNS, deliverability, DKIM/SPF setup is complex; Resend handles it |
| Recurring job | setTimeout loop, setInterval in Edge Function | pg_cron SQL migration | Edge Functions are stateless and ephemeral; only DB-level cron survives deploys |
| Balance calculation | Custom fee math | SUM `payments.trainer_payout` | Fees already applied at booking time per PAYOUT-04; `trainer_payout` is the authoritative net figure |
| Transfer status tracking | Polling Stripe transfers API | Stripe webhook `payout.paid` | Webhooks are event-driven and reliable; polling incurs latency and cost |

**Key insight:** `payments.trainer_payout` is the single source of truth for what a trainer earns per booking — all balance calculations should aggregate this column, not recompute fees.

---

## Common Pitfalls

### Pitfall 1: Transfer vs. Payout API Confusion
**What goes wrong:** Developer calls `stripe.payouts.create()` instead of `stripe.transfers.create()`. The payouts API acts on behalf of a connected account and requires a different auth context (the connected account's key), so it will fail or payout to the wrong account.
**Why it happens:** The word "payout" appears in the feature name, but the Stripe API object `Payout` is for bank disbursements from a connected account's own Stripe balance — not for platforms sending money to connected accounts.
**How to avoid:** Use `stripe.transfers.create({ destination: stripeAccountId })` — this is the platform-to-connected-account money movement.
**Warning signs:** Stripe error "You cannot create a payout for a connected account from the platform account" or "Must be authenticated as the connected account."

### Pitfall 2: payout.paid is a Connected Account Event
**What goes wrong:** Webhook endpoint never receives `payout.paid` events because the Stripe webhook is configured only for the platform account, not connected accounts.
**Why it happens:** Stripe's webhook dashboard has a separate setting for Connect events. The `payout.paid` event fires on the connected account's event stream.
**How to avoid:** In the Stripe Dashboard under Webhooks, enable "Listen to events on Connected accounts." In the webhook handler, the event object will have an `account` property (`event.account`) containing the connected account ID when it comes from a connected account.
**Warning signs:** Webhook registered, `payout.paid` never fires in logs.

### Pitfall 3: Double-Payout (Race Condition)
**What goes wrong:** Trainer clicks "Request Payout" twice fast (or weekly auto-payout fires while a manual payout is in flight), resulting in two Stripe transfers for the same balance.
**Why it happens:** No idempotency check before initiating transfer.
**How to avoid:** Insert a `payout_transactions` record with status `pending` BEFORE calling Stripe. Query for any pending payout before allowing a new one. Use Stripe idempotency keys.
**Warning signs:** `payout_transactions` table has two rows with overlapping payment IDs.

### Pitfall 4: Balance Goes Negative
**What goes wrong:** Trainer has $60 available. On-demand payout of $60 is initiated. Before it completes, a booking is refunded, reducing the actual available balance to $30. Stripe successfully transferred $60, creating a negative effective balance.
**Why it happens:** Balance is read, then transfer is initiated — no atomic lock.
**How to avoid:** Mark payments as "swept" (set `payout_transaction_id`) in the same DB transaction as recording the payout. Consider Stripe idempotency and only initiate transfers for the exact amount of payments being swept.
**Warning signs:** `available_balance` query returns negative value.

### Pitfall 5: Resend From Address Not Verified
**What goes wrong:** Resend rejects emails with "From address is not verified." The free tier requires a verified domain.
**Why it happens:** Resend requires DNS verification of the sender domain.
**How to avoid:** Verify the sending domain (fitrush.app or similar) in Resend Dashboard before implementing. Alternatively, use `onboarding@resend.dev` during development (Resend's sandbox address), switching to verified domain before production.
**Warning signs:** Resend API returns 403 or 422 with "domain not verified."

### Pitfall 6: pg_cron Vault Secrets Not Set
**What goes wrong:** The pg_cron job fails silently because Vault secrets (`project_url`, `service_role_key`) were never set.
**Why it happens:** Vault setup requires explicit SQL commands; the migration creates the schedule but cannot insert the secrets (they contain sensitive values).
**How to avoid:** Document the Vault setup step explicitly in the wave plan. It must be done manually or via a secure CI step — NOT in a migration file (secrets must not be in migration history).
**Warning signs:** `net.http_post` in pg_cron returns error or null; check `cron.job_run_details`.

---

## Code Examples

### Balance Query (Supabase client, TypeScript)
```typescript
// Source: inferred from payments table schema + project query patterns
const { data } = await supabase
  .from('payments')
  .select('trainer_payout')
  .eq('status', 'succeeded')
  .is('payout_transaction_id', null)  // not yet paid out
  .in('booking_id',
    supabase
      .from('bookings')
      .select('id')
      .eq('trainer_id', trainerProfile.id)
  );

const availableBalance = (data ?? []).reduce((sum, p) => sum + p.trainer_payout, 0);
```

Note: Supabase JS v2 supports nested selects for this pattern. Alternatively use a SQL function via `.rpc()`.

### create-payout Edge Function Structure
```typescript
// supabase/functions/create-payout/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import Stripe from 'npm:stripe@14.25.0';
import { corsHeaders } from '../_shared/cors.ts';
import { requireEnv } from '../_shared/env.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // 1. Auth: verify trainer JWT (same pattern as create-connect-account)
  // 2. Fetch trainer's stripe_account_id from trainer_profiles
  // 3. Calculate available balance (SUM unpaid payments.trainer_payout)
  // 4. Guard: balance < $50 → return 400
  // 5. Guard: existing pending payout_transaction → return 409
  // 6. Insert payout_transactions row (status: 'pending')
  // 7. Mark contributing payments with payout_transaction_id
  // 8. Call stripe.transfers.create({ amount, currency: 'usd', destination: stripeAccountId })
  // 9. Update payout_transactions row (stripe_transfer_id, status: 'processing')
  // 10. Send initiation email via Resend
  // 11. Return { success: true, amount, transferId }
});
```

### Resend Email Call (in Edge Function)
```typescript
// Source: https://resend.com/docs/send-with-supabase-edge-functions
const resendApiKey = requireEnv('RESEND_API_KEY');

await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${resendApiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    from: 'FitRush <noreply@yourdomain.com>',
    to: [trainerEmail],
    subject: 'Your FitRush payout has been initiated',
    html: `<p>Your payout of $${amount.toFixed(2)} has been initiated. Funds expected within 2 business days.</p>`,
  }),
});
```

### payout_transactions Table (Migration)
```sql
CREATE TABLE IF NOT EXISTS public.payout_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid NOT NULL REFERENCES public.trainer_profiles(id) ON DELETE RESTRICT,
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  stripe_transfer_id text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  initiated_by text NOT NULL CHECK (initiated_by IN ('trainer', 'auto')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add FK column to payments for sweep tracking
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS payout_transaction_id uuid
    REFERENCES public.payout_transactions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payout_transactions_trainer
  ON public.payout_transactions(trainer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payments_payout_transaction
  ON public.payments(payout_transaction_id);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `stripe.payouts.create()` for platform payouts | `stripe.transfers.create()` to connected account | Stripe Connect docs clarification | Transfers are platform-to-connected; payouts are connected-to-bank (automatic) |
| Manual cron server (cron daemon) | Supabase pg_cron + pg_net | Supabase Cron GA release | No external infra; scheduled via SQL migration |
| SendGrid/Mailgun | Resend.com | ~2023 | Simpler API, developer-first, free tier 100/day |

**Deprecated/outdated:**
- Stripe API version `2023-10-16` is the pinned version in project. Do NOT change it — keep parity with existing functions.
- The `send-notification-email` console.log stub is a known placeholder from Phase 4+ comment — Phase 9 is the intended replacement point.

---

## Open Questions

1. **Resend sender domain**
   - What we know: Resend requires a verified domain for the `from` address
   - What's unclear: Whether `fitrush.app` domain is owned and can be verified in Resend
   - Recommendation: Use `onboarding@resend.dev` as the `from` address during development/testing (Resend's built-in test address). Flag domain verification as a deployment prerequisite.

2. **payout.paid webhook — connected account configuration**
   - What we know: `payout.paid` fires on the connected account's event stream, not the platform's
   - What's unclear: Whether the existing Stripe webhook endpoint is already configured to receive Connect events
   - Recommendation: Add a task to verify webhook configuration in Stripe Dashboard. The webhook handler already receives the `account` property on events — check `event.account` to confirm.

3. **Stripe balance sufficiency for transfers**
   - What we know: `stripe.transfers.create()` debits the platform's Stripe balance, not the connected account
   - What's unclear: Whether the platform balance is always sufficient (it depends on collected payment volume vs. deferred payouts)
   - Recommendation: Handle the Stripe `insufficient_funds` error explicitly in `create-payout`, returning a 402 with a clear message. This edge case should be rare but needs error handling.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected — Wave 0 must install Vitest |
| Config file | `vitest.config.ts` — Wave 0 creates |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PAYOUT-01 | Available balance = SUM of unpaid succeeded trainer_payout | unit | `npx vitest run src/lib/balance.test.ts` | Wave 0 |
| PAYOUT-01 | Pending balance = SUM of pending/processing trainer_payout | unit | `npx vitest run src/lib/balance.test.ts` | Wave 0 |
| PAYOUT-02 | Request Payout button disabled when balance < $50 | unit | `npx vitest run src/components/trainer/PayoutsTab.test.tsx` | Wave 0 |
| PAYOUT-02 | create-payout Edge Function rejects balance < $50 with 400 | manual-only | Supabase CLI: `supabase functions serve create-payout` + curl | N/A |
| PAYOUT-03 | weekly-payouts function iterates trainers with balance ≥ $50 | manual-only | Invoke function manually, verify DB records | N/A |
| PAYOUT-04 | Balance query uses payments.trainer_payout (not recomputing fees) | unit | `npx vitest run src/lib/balance.test.ts` | Wave 0 |
| PAYOUT-05 | Transaction history rows sorted newest-first | unit | `npx vitest run src/components/trainer/PayoutsTab.test.tsx` | Wave 0 |
| PAYOUT-06 | Initiation email triggered on successful transfer | manual-only | Check Resend dashboard after test payout | N/A |
| PAYOUT-06 | Completion email triggered by payout.paid webhook | manual-only | Use Stripe CLI to trigger webhook event | N/A |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `vitest.config.ts` — framework install: `npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom`
- [ ] `src/lib/balance.test.ts` — covers PAYOUT-01, PAYOUT-04 (pure balance calculation logic)
- [ ] `src/components/trainer/PayoutsTab.test.tsx` — covers PAYOUT-02, PAYOUT-05 (UI state: disabled button, table sort)

*(Edge Function tests and webhook tests are manual-only — they require live Stripe + Supabase environment)*

---

## Sources

### Primary (HIGH confidence)
- Stripe Transfers API — https://docs.stripe.com/api/transfers/create (verified: parameters, amount in cents, destination = connected account ID)
- Stripe Webhook Event Types — https://docs.stripe.com/api/events/types (verified: `payout.paid` fires when funds expected in bank; `transfer.paid` does NOT exist)
- Supabase Schedule Functions — https://supabase.com/docs/guides/functions/schedule-functions (verified: pg_cron + net.http_post + Vault pattern)
- Resend Supabase Edge Functions — https://resend.com/docs/send-with-supabase-edge-functions (verified: fetch-based, `RESEND_API_KEY` env var, `https://api.resend.com/emails` endpoint)
- Project codebase — existing `stripe-webhook/index.ts`, `create-connect-account/index.ts`, `send-notification-email/index.ts`, `AdminDashboard.tsx` (direct read)

### Secondary (MEDIUM confidence)
- Stripe Connect payouts documentation — https://docs.stripe.com/connect/payouts-connected-accounts (verified payout.paid event list; some details required inference)
- Separate charges and transfers — https://docs.stripe.com/connect/separate-charges-and-transfers (verified transfer creation pattern)

### Tertiary (LOW confidence)
- None — all critical claims verified against official sources

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified against project package.json and official docs
- Architecture: HIGH — patterns derived directly from existing codebase + official Stripe/Supabase docs
- Pitfalls: HIGH — Transfer vs. Payout confusion and payout.paid event scope verified against official docs; race conditions are well-documented general patterns

**Research date:** 2026-03-14
**Valid until:** 2026-04-13 (stable APIs; Stripe API version pinned at 2023-10-16 in project)
