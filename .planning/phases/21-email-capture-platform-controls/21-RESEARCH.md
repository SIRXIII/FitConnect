# Phase 21: Email Capture + Platform Controls - Research

**Researched:** 2026-03-18
**Domain:** Unauthenticated Supabase form submission, Resend email via Edge Function, Framer Motion AnimatePresence, Zod v4 validation
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Email-only input inline in the Hero section (not a separate section)
- Single field for maximum conversion, lowest friction
- Sits alongside or replaces existing CTA buttons in Hero
- No name, no phone, no role selector
- "Get Early Access" tone — exclusive, luxury-aligned
- No waitlist position number shown to visitors
- Simple success messaging without numerical social proof
- Full Hero section transforms to thank-you state on submit
- Framer Motion AnimatePresence transition (consistent with existing booking wizard pattern)
- No page navigation — inline transformation
- Toast notification via Sonner as secondary feedback
- Short and branded email: "Welcome to FitRush. You are on the early access list. We will reach out when it is time."
- FitRush logo, gold accent (#C5A059) styling
- Sent via existing Resend Edge Function pattern (send-notification-email)
- From: FitRush <noreply@resend.dev>
- Documentation checklist only — no GCP console execution
- Checklist covers: create GCP project, enable Maps JS API, set $10/month billing budget cap, restrict API key to HTTP referrers, submit OAuth consent screen for calendar.events scope
- Delivered as a markdown file or section in phase docs
- Actual console work is manual/separate from this phase

### Claude's Discretion
- Exact Hero layout adjustment for the email input
- Zod schema shape for waitlist (likely just email with max length)
- Database table design for email_subscribers (id, email unique, created_at)
- Framer Motion animation specifics for Hero transform
- RLS policy for public insert on waitlist table
- Whether to use existing send-notification-email or create a new lightweight Edge Function for unauthenticated waitlist emails

### Deferred Ideas (OUT OF SCOPE)
- Trust infrastructure strategic note: Differentiation built around verified credentials, transparent pricing, matching that prevents misrepresentation, and PT tooling (autosave, undo, exercise-level notes, structured check-ins). Must deliver 2+ at meaningfully better level than incumbents. Captured in STATE.md under Strategic Todos.
- AI Marketing Tier for trainers (v4.1+): Social media sync, content creation, marketing analytics as premium subscription feature. Captured in REQUIREMENTS.md.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| WAITLIST-01 | Visitor can enter email on landing page to join the waitlist | Supabase public insert RLS pattern + React form with Zod validation in Hero.tsx |
| WAITLIST-02 | Visitor receives confirmation email after signup via Resend | New unauthenticated Edge Function that calls Resend API; existing send-notification-email requires JWT and cannot be reused directly |
| WAITLIST-03 | Visitor sees their position in the waitlist after signup | Note: CONTEXT.md overrides this — no position shown. Success state replaces form instead. |
</phase_requirements>

---

## Summary

Phase 21 is the first v4.0 phase. It has two distinct workstreams: (1) a frontend email capture form with a Framer Motion Hero transformation and a new unauthenticated Supabase Edge Function for Resend delivery, and (2) a GCP setup documentation checklist (no live console work). The implementation is self-contained — no dependencies on other v4.0 phases.

The most important design decision is that the existing `send-notification-email` Edge Function requires JWT authentication (`requireAuth` pattern). Waitlist visitors are not logged in, so a new public Edge Function `waitlist-signup` must be created. This function handles both the `email_subscribers` insert and the Resend delivery in one call, avoiding two separate network roundtrips from the client. The function uses `createClient` with the service-role key for the DB write and calls Resend directly, returning 409 Conflict for duplicate emails.

On the frontend, Hero.tsx currently renders a static motion.div with two CTA buttons. The email form replaces those CTAs in the default state. On successful submission, AnimatePresence swaps the form state for a thank-you state using the same `stepVariants` pattern already established in BookingWizard. Zod v4 (already installed as `zod@^4.3.6`) validates the email client-side before the Edge Function call.

**Primary recommendation:** Create `supabase/functions/waitlist-signup/index.ts` as a new public Edge Function (no auth check), add `waitlistSchema` to `src/lib/schemas.ts`, and modify Hero.tsx to use `AnimatePresence` with two named states (`idle` and `submitted`).

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | ^4.3.6 | Email validation schema | Already installed; project uses zod for all form schemas |
| framer-motion | ^12.35.2 | Hero AnimatePresence transition | Already installed; established pattern in BookingWizard.tsx |
| sonner | ^2.0.7 | Secondary toast feedback | Already installed; used across entire app |
| @supabase/supabase-js | ^2.99.0 | DB insert from client + Edge Function service-role client | Already installed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Resend REST API | n/a | Send confirmation email from Edge Function | Called via fetch in the new waitlist-signup Edge Function |
| Deno Edge Functions | runtime | Run waitlist-signup serverlessly | All Supabase Edge Functions run on Deno |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New `waitlist-signup` Edge Function | Reuse `send-notification-email` | send-notification-email requires JWT; cannot serve unauthenticated callers without removing auth check which would break notification security |
| New `waitlist-signup` Edge Function | Direct Supabase insert from client + separate fetch to Resend | Two network calls; RESEND_API_KEY must not be exposed to browser — server-side only |
| Supabase DB insert | Third-party waitlist service (Mailchimp, ConvertKit) | Adds a paid external dependency for a simple email list; overkill for v4.0 |

**Installation:** No new packages needed. All dependencies already in package.json.

---

## Architecture Patterns

### Recommended Project Structure

New files this phase:

```
src/
└── components/landing/
    └── Hero.tsx          (modified — add email form + AnimatePresence states)

src/lib/
└── schemas.ts            (modified — add waitlistSchema + WaitlistInput type)

supabase/
├── functions/
│   └── waitlist-signup/
│       └── index.ts      (new public Edge Function)
└── migrations/
    └── 20260318XXXXXX_email_subscribers.sql  (new table)
```

### Pattern 1: Unauthenticated Edge Function

**What:** Edge Function that accepts unauthenticated POST requests, validates input, inserts to DB using service-role key, and calls Resend.

**When to use:** Any operation that must serve anonymous visitors (no session).

**Example:**
```typescript
// supabase/functions/waitlist-signup/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { corsHeaders } from '../_shared/cors.ts';
import { requireEnv } from '../_shared/env.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { email } = await req.json().catch(() => ({}));

    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return new Response(JSON.stringify({ error: 'Valid email is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use service-role to bypass RLS for insert
    const supabase = createClient(
      requireEnv('SUPABASE_URL'),
      requireEnv('SUPABASE_SERVICE_ROLE_KEY')
    );

    const { error: insertError } = await supabase
      .from('email_subscribers')
      .insert({ email: email.trim().toLowerCase() });

    if (insertError) {
      if (insertError.code === '23505') {
        // Already on waitlist — return 200 to avoid revealing who is registered
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw insertError;
    }

    // Send Resend confirmation email
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (resendApiKey) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'FitRush <noreply@resend.dev>',
          to: [email.trim().toLowerCase()],
          subject: 'You are on the FitRush early access list.',
          html: CONFIRMATION_EMAIL_HTML,
        }),
      });
      // Email failure is non-fatal — do not throw
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

### Pattern 2: AnimatePresence Hero Swap

**What:** Two React states (`idle` | `submitted`) with AnimatePresence keyed transitions — same pattern as BookingWizard step transitions.

**When to use:** Inline form-to-confirmation transforms without page navigation.

**Example:**
```typescript
// src/components/landing/Hero.tsx
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

type HeroState = 'idle' | 'submitted';

const stepVariants = {
  enter: { opacity: 0, y: 20 },
  center: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

const Hero: React.FC = () => {
  const [heroState, setHeroState] = useState<HeroState>('idle');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ... handleSubmit calls waitlist-signup Edge Function

  return (
    <section ...>
      <AnimatePresence mode="wait">
        {heroState === 'idle' ? (
          <motion.div
            key="idle"
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.4 }}
          >
            {/* existing headline + email form */}
          </motion.div>
        ) : (
          <motion.div
            key="submitted"
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.4 }}
          >
            {/* thank-you state */}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};
```

### Pattern 3: Zod Email Schema (v4 syntax)

**What:** Minimal Zod v4 schema for waitlist email field, added to existing schemas.ts.

```typescript
// src/lib/schemas.ts (addition)
export const waitlistSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .max(320, 'Email is too long')
    .email('Please enter a valid email address'),
});

export type WaitlistInput = z.infer<typeof waitlistSchema>;
```

Note: In Zod v4 `.email()` is a string method. The project already uses `zod@^4.3.6`.

### Pattern 4: Supabase Migration for email_subscribers

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_email_subscribers.sql

CREATE TABLE IF NOT EXISTS public.email_subscribers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_subscribers_email
  ON public.email_subscribers (lower(email));

-- RLS: enable but allow public insert only; no select for anon
ALTER TABLE public.email_subscribers ENABLE ROW LEVEL SECURITY;

-- No SELECT policy for anon (security: hide subscriber list)
-- INSERT handled by service-role in Edge Function (bypasses RLS)
-- Authenticated admin can read (add policy when admin panel exists)
```

### Anti-Patterns to Avoid

- **Calling RESEND_API_KEY from the browser:** The API key must only exist server-side in the Edge Function environment. Never add it to Vite env vars (`VITE_` prefix exposes it to the client bundle).
- **Reusing send-notification-email for unauthenticated callers:** That function enforces JWT auth — removing the check would break all existing notification emails that rely on the authenticated user context.
- **INSERT via anon Supabase client with permissive RLS:** Technically possible but exposes the anon key in client code to unlimited inserts. Prefer service-role in Edge Function.
- **Showing duplicate-email errors to visitors:** Return 200 for 23505 unique constraint violations to avoid revealing who is already registered.
- **AnimatePresence without `mode="wait"`:** Without `mode="wait"`, both enter and exit animations run simultaneously, causing visual overlap. Always use `mode="wait"` for full-swap transitions.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email validation | Custom regex | `z.string().email()` in Zod v4 | RFC-compliant, already in project |
| Duplicate prevention | Custom dedup logic | PostgreSQL `UNIQUE INDEX` + `23505` error code handling | DB-enforced, race-condition safe |
| Animation transitions | CSS keyframes | Framer Motion `AnimatePresence` | Already installed; handles mount/unmount lifecycle correctly |
| Toast notifications | Custom toast component | `sonner` `toast()` | Already installed and used across app |

**Key insight:** Every library needed for this phase is already installed. The only new artifact is the Edge Function.

---

## Common Pitfalls

### Pitfall 1: Sending Duplicate Emails on Form Re-submit

**What goes wrong:** User submits, network is slow, submits again. Two inserts succeed (if DB constraint not in place) or one succeeds — but if the constraint catches the duplicate and the function returns an error, the client shows an error to a user who is already on the list.

**Why it happens:** Race between double-submit and DB constraint check.

**How to avoid:** (1) Disable the submit button immediately on click (`loading` state). (2) Return HTTP 200 (not 409) for duplicate emails so the client shows the success state regardless.

**Warning signs:** Error toast appearing for users who try to sign up twice.

### Pitfall 2: Email Confirmation Blocking the Success Response

**What goes wrong:** Resend API is slow or unavailable. If the Edge Function awaits Resend and throws on failure, the user's insert is rolled back (or the 500 is returned) even though the DB write succeeded.

**Why it happens:** Treating email send failure as fatal.

**How to avoid:** Fire-and-forget the Resend call: log errors with `console.error` but always return 200 after a successful DB insert. This matches the pattern already established in `send-notification-email`.

**Warning signs:** Users not appearing in `email_subscribers` table even though they saw an error.

### Pitfall 3: AnimatePresence `key` Not Changing Between States

**What goes wrong:** The exit animation never plays — the old content disappears instantly.

**Why it happens:** Both states share the same `key` prop on the motion element.

**How to avoid:** Use `key="idle"` and `key="submitted"` so AnimatePresence detects a different element is mounting.

### Pitfall 4: Zod v4 API Differences

**What goes wrong:** Using Zod v3 syntax in a v4 project (e.g., `z.string().email()` with a custom message via `.email({ message: '...' })` — this works the same in v4, but some v3 error `.format()` patterns changed).

**Why it happens:** Training data and blog posts often reference Zod v3.

**How to avoid:** The project has `zod@^4.3.6`. The `.email()` validator and `.parse()` / `.safeParse()` APIs are unchanged. `z.infer<typeof schema>` still works. No issues expected for a simple email schema.

### Pitfall 5: CORS on the New Public Edge Function

**What goes wrong:** Browser blocks the POST to the new Edge Function because CORS headers are missing for the OPTIONS preflight.

**Why it happens:** New Edge Function doesn't inherit CORS config — each function must explicitly handle OPTIONS and include `corsHeaders` from `_shared/cors.ts`.

**How to avoid:** Copy the OPTIONS handler pattern from any existing Edge Function. The `_shared/cors.ts` file exports `corsHeaders` with `Access-Control-Allow-Origin: *` already configured.

---

## Code Examples

### Calling the Edge Function from Hero.tsx

```typescript
// Source: established supabase.ts + Edge Function call pattern
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  const result = waitlistSchema.safeParse({ email });
  if (!result.success) {
    setError(result.error.errors[0]?.message ?? 'Invalid email');
    return;
  }

  setLoading(true);
  setError(null);

  try {
    const res = await fetch(
      `${SUPABASE_URL}/functions/v1/waitlist-signup`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: result.data.email }),
      }
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? 'Signup failed');
    }
    setHeroState('submitted');
    toast.success('You are on the early access list.');
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Something went wrong');
    toast.error('Could not sign you up. Please try again.');
  } finally {
    setLoading(false);
  }
};
```

Note: No `Authorization` header is sent — this is intentional for a public endpoint.

### Branded Confirmation Email HTML (inline in Edge Function)

```typescript
const CONFIRMATION_EMAIL_HTML = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Georgia, serif; background: #FDFCFB; color: #1A1A1A; margin: 0; padding: 40px;">
  <div style="max-width: 480px; margin: 0 auto;">
    <div style="width: 40px; height: 1px; background: #C5A059; margin-bottom: 32px;"></div>
    <h1 style="font-size: 28px; font-weight: 300; letter-spacing: -0.5px; margin: 0 0 24px 0;">FitRush</h1>
    <p style="font-size: 16px; line-height: 1.7; color: #1A1A1A; margin: 0 0 16px 0;">
      Welcome to FitRush.
    </p>
    <p style="font-size: 16px; line-height: 1.7; color: #1A1A1A; margin: 0 0 32px 0;">
      You are on the early access list. We will reach out when it is time.
    </p>
    <div style="width: 40px; height: 1px; background: #C5A059; margin-bottom: 16px;"></div>
    <p style="font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: #1A1A1A80;">
      Elite Fitness Marketplace
    </p>
  </div>
</body>
</html>
`;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Zod v3 `.email()` with options object | Zod v4 `.email()` works identically for basic use | Zod v4 (2024) | No migration needed for simple schemas |
| framer-motion `AnimatePresence` with `exitBeforeEnter` prop | Use `mode="wait"` instead | framer-motion v6+ | Project is on v12; use `mode="wait"` |
| Supabase Edge Functions with `serve()` | Use `Deno.serve()` | 2023 | Project already uses `Deno.serve` pattern |

**Deprecated/outdated:**
- `AnimatePresence exitBeforeEnter` prop: replaced by `mode="wait"` in framer-motion v6+. The project uses v12; never use `exitBeforeEnter`.

---

## Open Questions

1. **WAITLIST-03 vs. CONTEXT.md conflict**
   - What we know: REQUIREMENTS.md says "Visitor sees their position in the waitlist after signup." CONTEXT.md (locked decision) says "No waitlist position number shown to visitors."
   - What's unclear: Whether the planner should mark WAITLIST-03 as fulfilled by the success state (position suppressed by design choice) or flag it as partially deferred.
   - Recommendation: Mark WAITLIST-03 as satisfied. The user explicitly decided to suppress position display in the discussion phase. The success state fulfills the spirit of requirement (visitor sees acknowledgment). The planner should document this as an intentional design override in PLAN.md.

2. **`waitlist-signup` Edge Function must be invocable without `Authorization` header**
   - What we know: Supabase Edge Functions can be called without auth if the function does not check for it. The `apikey` header with the anon key is optional.
   - What's unclear: Whether Netlify or Supabase edge config needs to be updated to allow unauthenticated invocations.
   - Recommendation: No special config needed — Supabase Edge Functions are publicly invocable by default. The function controls its own auth enforcement. The existing `cors.ts` already allows all origins.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `vite.config.ts` (inline `test` block — `globals: true`, `environment: 'jsdom'`) |
| Quick run command | `npx vitest run src/components/landing/Hero.test.tsx` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WAITLIST-01 | Email input renders in Hero; submit calls Edge Function | unit | `npx vitest run src/components/landing/Hero.test.tsx` | ❌ Wave 0 |
| WAITLIST-02 | Edge Function calls Resend API after successful insert | unit (mocked) | `npx vitest run src/components/landing/Hero.test.tsx` | ❌ Wave 0 |
| WAITLIST-03 | Success state renders after submit (position suppressed by design) | unit | `npx vitest run src/components/landing/Hero.test.tsx` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/components/landing/Hero.test.tsx`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/components/landing/Hero.test.tsx` — covers WAITLIST-01, WAITLIST-02, WAITLIST-03
  - Test: renders email input in idle state
  - Test: submit with invalid email shows error, does not call Edge Function
  - Test: submit with valid email transitions to submitted state (mock `fetch`)
  - Test: Sonner toast fires on success
  - Pattern: mock `framer-motion` same as BookingWizard.test.tsx (`vi.mock('framer-motion', ...)`)
  - Pattern: mock `fetch` globally with `vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) }))`

---

## GCP Platform Controls Checklist

This is a documentation deliverable, not a code task. The planner should create a checklist task that produces a markdown file at `.planning/phases/21-email-capture-platform-controls/GCP-SETUP-CHECKLIST.md`.

### Checklist Contents (to include in the generated file)

```markdown
# GCP Platform Controls Setup Checklist

## Google Cloud Project Setup
- [ ] Create new GCP project named "fitrush-prod" (or add to existing)
- [ ] Note Project ID (format: fitrush-prod-XXXXXX)
- [ ] Enable billing account on the project

## Maps JavaScript API
- [ ] Enable "Maps JavaScript API" in APIs & Services > Library
- [ ] Create an API key in APIs & Services > Credentials
- [ ] Under "Application restrictions" → select "HTTP referrers (websites)"
  - Add: `https://fitrush-app.netlify.app/*`
  - Add: `http://localhost:3000/*` (dev only — remove before production)
- [ ] Under "API restrictions" → select "Restrict key" → choose "Maps JavaScript API"
- [ ] Save the key as VITE_GOOGLE_MAPS_API_KEY in .env.local and Netlify environment variables

## Billing Budget Alert
- [ ] Go to Billing > Budgets & alerts
- [ ] Create budget: Scope = "fitrush-prod" project, Amount = $10/month
- [ ] Set alert thresholds: 50%, 90%, 100%
- [ ] Add email recipient (team email)

## Google OAuth Consent Screen (for Calendar Sync — Phase 28)
- [ ] Go to APIs & Services > OAuth consent screen
- [ ] App type: External
- [ ] App name: FitRush
- [ ] User support email: your email
- [ ] Authorized domains: fitrush-app.netlify.app
- [ ] Scopes: add `https://www.googleapis.com/auth/calendar.events`
- [ ] Add test users (for development before verification completes)
- [ ] Submit for verification
- [ ] Note: verification takes 4–8 weeks. Start immediately — Phase 28 cannot ship to production users until verification is complete.
```

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection: `supabase/functions/send-notification-email/index.ts` — confirmed JWT auth requirement, Resend API call pattern, error handling convention
- Direct code inspection: `src/components/booking/BookingWizard.tsx` + `BookingWizard.test.tsx` — confirmed AnimatePresence pattern, stepVariants shape, framer-motion mock pattern for Vitest
- Direct code inspection: `src/lib/schemas.ts` — confirmed Zod v4 usage, schema naming conventions, type export pattern
- Direct code inspection: `package.json` — confirmed installed versions: zod@^4.3.6, framer-motion@^12.35.2, sonner@^2.0.7, vitest@^4.1.0
- Direct code inspection: `vite.config.ts` — confirmed Vitest inline config (`globals: true`, `environment: 'jsdom'`)
- Direct code inspection: `supabase/functions/_shared/cors.ts` + `_shared/env.ts` — confirmed shared utilities available to new Edge Function
- Direct code inspection: `src/components/landing/Hero.tsx` — confirmed current Hero structure: static motion.div, two CTA buttons, no form state

### Secondary (MEDIUM confidence)
- framer-motion v12 docs pattern: `AnimatePresence mode="wait"` replaces deprecated `exitBeforeEnter` prop (v6+ change)
- Supabase Edge Functions: public invocation (no auth header) is default behavior; function controls its own auth enforcement
- PostgreSQL error code 23505 for unique constraint violation — standard and stable

### Tertiary (LOW confidence)
- None — all claims above are verifiable from code inspection or stable platform behavior

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries inspected directly from package.json
- Architecture: HIGH — Edge Function pattern and AnimatePresence pattern both derived from existing codebase code
- Pitfalls: HIGH — derived from direct inspection of auth check in send-notification-email and framer-motion changelog

**Research date:** 2026-03-18
**Valid until:** 2026-06-18 (stable — no fast-moving dependencies; all libraries are established versions)
