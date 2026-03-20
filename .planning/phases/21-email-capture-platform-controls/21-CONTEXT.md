# Phase 21: Email Capture + Platform Controls - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Landing page email capture form for collecting interested users while v4.0 features are built. Visitors submit email, see a confirmation animation, and receive a branded email. Separately, a GCP setup checklist is created for Maps billing controls and OAuth consent screen verification. No GCP console execution in this phase -- code and documentation only.

Requirements: WAITLIST-01, WAITLIST-02, WAITLIST-03

</domain>

<decisions>
## Implementation Decisions

### Form Placement and Fields
- Email-only input inline in the Hero section (not a separate section)
- Single field for maximum conversion, lowest friction
- Sits alongside or replaces existing CTA buttons in Hero
- No name, no phone, no role selector

### Waitlist Messaging
- "Get Early Access" tone -- exclusive, luxury-aligned
- No waitlist position number shown to visitors
- Simple success messaging without numerical social proof

### Confirmation Experience
- Full Hero section transforms to thank-you state on submit
- Framer Motion AnimatePresence transition (consistent with existing booking wizard pattern)
- No page navigation -- inline transformation
- Toast notification via Sonner as secondary feedback

### Confirmation Email
- Short and branded: "Welcome to FitRush. You are on the early access list. We will reach out when it is time."
- FitRush logo, gold accent (#C5A059) styling
- Sent via existing Resend Edge Function pattern (send-notification-email)
- From: FitRush <noreply@resend.dev>

### GCP/OAuth Setup
- Documentation checklist only -- no GCP console execution
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Landing Page
- `src/pages/Landing.tsx` -- Current Landing page orchestrator with Hero and 6 other sections
- `src/components/landing/Hero.tsx` -- Hero component that will receive the email input

### Form Patterns
- `src/lib/schemas.ts` -- 9 existing Zod schemas; add waitlistSchema here
- `src/components/search/SearchSection.tsx` -- Example of form state with useState

### Email Integration
- `supabase/functions/send-notification-email/index.ts` -- Resend email Edge Function pattern
- `src/lib/supabase.ts` -- Supabase client setup

### Research
- `.planning/research/SUMMARY.md` -- v4.0 research synthesis
- `.planning/research/PITFALLS.md` -- Google Maps billing risks and OAuth verification timeline

### Requirements
- `.planning/REQUIREMENTS.md` -- WAITLIST-01, WAITLIST-02, WAITLIST-03 definitions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/schemas.ts` -- Zod validation pattern; add `waitlistSchema` with email field
- `sonner` -- Toast notification library, already imported across the app
- `framer-motion` -- AnimatePresence already used in BookSession wizard and other sections
- `src/lib/supabase.ts` -- Typed Supabase client for database operations
- `supabase/functions/send-notification-email/index.ts` -- Resend email pattern (note: requires JWT auth, may need unauthenticated variant for waitlist)

### Established Patterns
- Landing page sections are standalone components imported into Landing.tsx
- Framer Motion fadeIn + slideUp used consistently across Hero and other sections
- Supabase queries use typed client with `.from('table').insert()` / `.select()` pattern
- Error handling: Sonner toast for user-facing errors, console.error for dev

### Integration Points
- Hero.tsx is the direct integration point for the email input
- New Supabase migration for `email_subscribers` table
- May need a new public Edge Function or adjust send-notification-email for unauthenticated access

</code_context>

<specifics>
## Specific Ideas

- "Get Early Access" as the CTA text -- luxury exclusive positioning
- Hero transforms completely on submit -- dramatic Framer Motion transition to thank-you state
- Confirmation email is minimal and branded: short copy, FitRush logo, gold accent
- No position-in-line display -- clean confirmation without number pressure

</specifics>

<deferred>
## Deferred Ideas

- **Trust infrastructure strategic note**: Differentiation built around verified credentials, transparent pricing, matching that prevents misrepresentation, and PT tooling (autosave, undo, exercise-level notes, structured check-ins). Must deliver 2+ at meaningfully better level than incumbents. Captured in STATE.md under Strategic Todos.
- **AI Marketing Tier for trainers** (v4.1+): Social media sync, content creation, marketing analytics as premium subscription feature. Captured in REQUIREMENTS.md.

</deferred>

---

*Phase: 21-email-capture-platform-controls*
*Context gathered: 2026-03-18*
