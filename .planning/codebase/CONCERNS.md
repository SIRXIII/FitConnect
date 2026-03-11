# Codebase Concerns

**Analysis Date:** 2026-03-11

## Critical Issues

### 1. Incomplete Payment Flow & Race Conditions

**Issue:** Payment creation and booking confirmation have race condition vulnerabilities

**Files:**
- `src/pages/BookSession.tsx` (lines 145-221)
- `src/pages/TrainerDashboard.tsx` (lines 33-65)

**Impact:**
- Booking is created in DB before payment intent (line 157-170), then payment is initiated (line 182-206)
- If payment intent fails after booking is created, the booking remains in "pending" status indefinitely
- No automatic cleanup if payment setup fails or client closes browser mid-flow
- No idempotency keys for payment intent creation — retries will create duplicate intents

**Fix approach:**
- Create payment intent FIRST, store clientSecret temporarily
- Only create booking after clientSecret is successfully generated
- Implement timeout-based cleanup for abandoned payment flows
- Add idempotency keys to all payment intent calls
- Store payment intent ID in bookings table for reconciliation

---

### 2. SQL Injection / Unsafe Query Construction in Search

**Issue:** User-provided search parameters are used in Supabase queries without sufficient validation

**Files:**
- `src/hooks/useTrainers.ts` (lines 45-46)
- `src/components/search/SearchSection.tsx` (lines 57-66)

**Details:**
```typescript
// Line 45-46 in useTrainers.ts:
if (options.location) {
  query = query.ilike('location', `%${options.location}%`); // User input in LIKE clause
}
```

**Impact:**
- `ilike()` with user input could be exploited for pattern-based attacks
- Even though Supabase client validates, trusting user input in LIKE is risky
- No length limits on search strings (DoS potential)

**Fix approach:**
- Implement input validation: max length (50 chars), alphanumeric + spaces + basic punctuation only
- Use Supabase's native filtering with validation library (e.g., Zod)
- Add rate limiting to trainer search endpoints
- Log suspicious search patterns

---

### 3. No Row-Level Security (RLS) Policies Visible

**Issue:** Code assumes Supabase RLS policies exist but they are not shown in codebase

**Files:**
- `src/pages/BookSession.tsx` (booking creation, line 157-170)
- `src/pages/MyBookings.tsx` (user's own bookings, line 144)
- `src/stores/auth.ts` (profile updates, line 152-155)

**Impact:**
- If RLS is not properly configured, users could:
  - Book slots for other trainers/clients
  - View/cancel other users' bookings
  - Modify other users' profiles
  - Access sensitive trainer data (Stripe account IDs, rates)
- Hard to verify security posture without seeing actual Supabase schema + RLS definitions

**Fix approach:**
- Document all RLS policies in `.planning/codebase/RLS_POLICIES.md`
- Verify policies enforce:
  - Clients can only view/modify their own bookings
  - Trainers can only view/modify their own slots and trainer profile
  - Profiles are viewable by all but only editable by owner
  - Payments/reviews are only creatable by authorized users
- Add RLS tests in test suite (if added)

---

### 4. Missing Authentication Checks on Backend Functions

**Issue:** Edge Functions called from client are not shown to verify auth + validation

**Files:**
- `src/pages/BookSession.tsx` (line 186-196)
- `src/pages/TrainerDashboard.tsx` (line 40)

**Details:**
- Calls to `create-payment-intent` and `create-connect-account` Edge Functions
- Bearer token is passed, but no verification if function validates it
- No way to verify functions exist, are secure, or validate input

**Impact:**
- If Edge Functions don't validate auth/ownership, attackers could:
  - Create payment intents for bookings they don't own
  - Create multiple Stripe accounts for same user
  - Trigger functions with malformed data causing crashes

**Fix approach:**
- Create `supabase/functions/` directory in repo with full function code
- Each function MUST:
  - Verify `Authorization` header and extract user ID
  - Validate all inputs (types, ranges, ownership)
  - Return proper error codes (401 for auth, 400 for validation)
  - Log all actions for audit trail
- Add type definitions for function request/response payloads

---

### 5. Unencrypted Sensitive Data in State

**Issue:** Auth token and Supabase anon key exposed in frontend state

**Files:**
- `src/pages/BookSession.tsx` (line 193)
- `src/stores/auth.ts` (using supabase client)

**Details:**
```typescript
// Line 193 in BookSession.tsx:
Authorization: `Bearer ${token}`,
apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
```

**Impact:**
- Anon key is in `import.meta.env` (OK, it's public-facing)
- BUT: Auth token is in memory, could be extracted by malicious JS
- No CSRF protection on state-changing operations
- No Content Security Policy visible

**Fix approach:**
- Keep tokens in HTTP-only cookies (Supabase handles this)
- Add CSRF tokens to all POST/PUT/DELETE operations
- Implement Content Security Policy header
- Add Subresource Integrity (SRI) for CDN assets

---

## High-Priority Concerns

### 6. Missing Cancellation Policy & Refund Logic

**Issue:** Bookings can be cancelled (MyBookings.tsx:194) but no refund is processed

**Files:**
- `src/pages/MyBookings.tsx` (lines 193-205)
- `src/pages/BookSession.tsx` (lines 228-234)

**Details:**
- Client cancels booking → status set to "cancelled" in DB
- Payment/charge already taken via Stripe
- No refund is initiated
- No communication to trainer about cancellation

**Impact:**
- Customers pay but can't get refunded
- No audit trail of who cancelled and why
- Violates FTC consumer protection rules (must honor refund requests)
- 24-hour cancellation window logic is only client-side (can be bypassed)

**Fix approach:**
- Create server-side cancellation logic that:
  - Checks booking date vs. current time
  - If refundable, calls Stripe refund API
  - Updates booking with refund_id, refund_status, refunded_at
  - Notifies both client and trainer
  - Prevents double-refunds with idempotency
- Add `refund_deadline` (24 hours after booking, not after session)
- Log all refunds with reason/justification

---

### 7. No Input Validation on User Profiles

**Issue:** Profile updates accept any data without validation

**Files:**
- `src/stores/auth.ts` (line 148-160)

**Details:**
```typescript
updateProfile: async (updates: Partial<Profile>) => {
  // No validation — accepts any partial<Profile>
  const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
}
```

**Impact:**
- Users could inject arbitrary data into their profile
- Phone numbers could be non-phone format
- Full names could contain special characters/emojis
- Could corrupt trainer matching if specialty/bio accept dangerous data
- No length limits (could hit DB storage limits)

**Fix approach:**
- Add Zod validation schema for Profile updates:
  ```typescript
  const ProfileUpdateSchema = z.object({
    full_name: z.string().min(1).max(100),
    phone: z.string().regex(/^\d{10}$/).optional(),
    avatar_url: z.string().url().optional(),
    // ... other fields
  });
  ```
- Validate on client before sending to server
- Validate again server-side (in Edge Function or RLS policy)
- Sanitize HTML/JS in bio/notes fields

---

### 8. Cascading Failures on Slot Deletion

**Issue:** When a trainer deletes an availability slot, no checks for dependent bookings

**Files:**
- `src/hooks/useAvailability.ts` (lines 53-62)

**Details:**
```typescript
const removeSlot = async (slotId: string) => {
  const { error } = await supabase
    .from('availability_slots')
    .delete()
    .eq('id', slotId)
    .eq('is_booked', false);  // Only prevents deleting if marked is_booked
  // But what if booking status is 'pending'?
};
```

**Impact:**
- If booking status changes to something other than is_booked=true before deletion, the slot could be deleted
- Client's booking suddenly has no associated time slot
- Trainer can accidentally delete slots with pending/confirmed bookings

**Fix approach:**
- Verify NO bookings exist for slot before deletion:
  ```typescript
  const { data: bookings } = await supabase
    .from('bookings')
    .select('id')
    .eq('slot_id', slotId)
    .in('status', ['pending', 'confirmed', 'completed']);

  if (bookings?.length) throw new Error('Cannot delete slot with active bookings');
  ```
- Use database CASCADE DELETE rules in schema (if not already)
- Add soft delete: mark slots as deleted instead of hard delete

---

### 9. No Data Retention / GDPR Compliance

**Issue:** User data deletion is not implemented; no audit trail retention policy

**Files:**
- Overall app (no sign-out cleanup)

**Impact:**
- GDPR: Users have right to erasure but code shows no way to delete profile + related data
- Data accumulates indefinitely (bookings, reviews, availability slots, payment info)
- No way to comply with "data minimization" principle
- Audit trail for payment disputes could be lost

**Fix approach:**
- Implement account deletion endpoint that:
  - Anonymizes completed bookings (remove notes, client/trainer identifiers)
  - Deletes pending/cancelled bookings
  - Removes availability slots
  - Deletes profile avatar from storage
  - Retains payment/refund records for legal compliance (7-10 years)
  - Marks account as deleted (soft delete)
- Create data retention policy: when to delete logs, temporary data, etc.
- Add GDPR data export endpoint (to give users copy of their data)

---

### 10. Incomplete Error Handling in Network Requests

**Issue:** Fetch calls don't handle all error scenarios (network timeouts, partial failures)

**Files:**
- `src/pages/BookSession.tsx` (lines 182-214)
- `src/pages/TrainerDashboard.tsx` (lines 38-64)

**Details:**
```typescript
const response = await fetch(...);
const result = await response.json(); // Assumes valid JSON

if (!response.ok) throw new Error(result.error || 'Failed to create payment');
// But what if response.json() itself throws? Response is not actually JSON?
```

**Impact:**
- If server returns HTML error page instead of JSON, `.json()` throws uncaught error
- Network timeout (no response) will hang indefinitely
- Malformed responses crash the page
- No retry logic for transient failures

**Fix approach:**
- Wrap fetch in try-catch with proper error handling:
  ```typescript
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) throw new Error('Invalid response type');
    const result = await response.json();
    // ...
  } catch (err) {
    if (err instanceof TypeError) // Network error
    if (err.name === 'AbortError') // Timeout
  }
  ```
- Add exponential backoff retry for transient failures
- Set reasonable timeouts (30s for payment intent)

---

### 11. Hardcoded Stripe Configuration & Rates

**Issue:** Business logic (8% platform fee, trainer payout) hardcoded in component

**Files:**
- `src/pages/BookSession.tsx` (lines 154-155)
- `src/pages/TrainerDashboard.tsx` (line 7)

**Details:**
```typescript
const platformFee = Math.round(rate * 0.08 * 100) / 100;  // 8% hardcoded
const trainerPayout = Math.round((rate - platformFee) * 100) / 100;
```

**Impact:**
- Can't change fee structure without code change + redeploy
- Business logic in UI layer (not in API/DB)
- Inconsistency risk: frontend calculations don't match backend
- No audit trail of rate changes

**Fix approach:**
- Move to backend configuration table:
  ```sql
  CREATE TABLE platform_config (
    id UUID PRIMARY KEY,
    platform_fee_percentage NUMERIC(5,2) DEFAULT 8.00,
    trainer_payout_percentage NUMERIC(5,2) GENERATED AS (100 - platform_fee_percentage),
    effective_date TIMESTAMP,
    created_at TIMESTAMP
  );
  ```
- Fetch config at app startup, cache in Zustand
- Recalculate fees on server when creating bookings (single source of truth)

---

## Medium-Priority Concerns

### 12. TODO Comment with Missing Implementation

**Issue:** `availableNow` field is not computed from actual availability

**Files:**
- `src/components/search/SearchSection.tsx` (line 20)

**Details:**
```typescript
availableNow: false, // TODO: compute from availability_slots
```

**Impact:**
- Trainer cards always show `availableNow: false`
- Users can't quickly find trainers with immediate slots
- Creates UX gap vs. product spec
- Code left incomplete (technical debt)

**Fix approach:**
- Query availability_slots for each trainer to check if any slots exist today/this week
- Compute availability with query:
  ```typescript
  const { data: slots } = await supabase
    .from('availability_slots')
    .select('id')
    .eq('trainer_id', trainerId)
    .is('booked', false)
    .gte('start_time', now)
    .lte('start_time', tomorrowEndOfDay)
    .limit(1);

  availableNow: slots && slots.length > 0
  ```
- Cache availability flags in trainer_profiles if expensive

---

### 13. Mock Data Fallback Hides Real Problems

**Issue:** Falls back to hardcoded mock trainers if no DB results, masking issues

**Files:**
- `src/components/search/SearchSection.tsx` (lines 45-52)

**Details:**
```typescript
useEffect(() => {
  if (!loading && dbTrainers.length === 0 && !location && !specialty && !priceRange && !error) {
    setUseMock(true);  // Falls back to mock data silently
  }
}, [loading, dbTrainers.length, location, specialty, priceRange, error]);
```

**Impact:**
- If Supabase query fails silently (e.g., RLS denies all rows), users see mock data
- Users think trainers exist in system but can't actually book
- Makes debugging production issues harder
- No indication that data is stale/mock

**Fix approach:**
- Only use mock data in development (check `import.meta.env.DEV`)
- In production, show "No trainers available" instead of mock data
- Log any scenarios where fallback is used (alerting/debugging)
- Explicitly mark UI when displaying test data

---

### 14. No Pagination on Trainer Search Results

**Issue:** All matching trainers loaded at once; no limit or pagination

**Files:**
- `src/hooks/useTrainers.ts` (lines 49)

**Impact:**
- If 10,000 trainers exist, all loaded in one query (huge payload)
- Page becomes slow with 1000s of trainer cards rendered
- Mobile users on slow connections hit memory limits
- No lazy loading

**Fix approach:**
- Add pagination to `useTrainers`:
  ```typescript
  const { trainers, hasMore, loading, loadMore } = useTrainers({
    limit: 20,
    offset: 0,
    ...otherFilters
  });
  ```
- Implement infinite scroll in SearchSection
- Use Supabase `range()` for efficient pagination

---

### 15. No Type Safety on Supabase Query Results

**Issue:** Type assertions using `as unknown as` bypass type checking

**Files:**
- `src/pages/BookSession.tsx` (line 138)
- `src/pages/MyBookings.tsx` (line 147)
- `src/hooks/useTrainers.ts` (lines 54, 83)

**Details:**
```typescript
setSlot(data as unknown as SlotWithTrainer | null);  // Dangerous assertion
setTrainers((data as TrainerWithProfile[]) || []);   // No validation
```

**Impact:**
- TypeScript doesn't verify shape of returned data
- If Supabase schema changes, queries return wrong data
- Runtime errors when accessing undefined properties
- Hard to debug data mismatches

**Fix approach:**
- Use Zod or similar for runtime validation of Supabase responses:
  ```typescript
  const SlotSchema = z.object({
    id: z.string().uuid(),
    start_time: z.string().datetime(),
    // ... all fields with proper types
  });

  const result = SlotSchema.parse(data);
  ```
- Create reusable validators in `src/lib/validators.ts`
- Validate all Supabase queries

---

### 16. Session Storage Risk in TrainerDashboard

**Issue:** SUPABASE_URL stored in component constant; accessed in every render

**Files:**
- `src/pages/TrainerDashboard.tsx` (line 7)

**Details:**
```typescript
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
```

**Impact:**
- Duplicates value (already in `supabase` client)
- Could be forgotten when URL changes
- Encourages direct fetch calls instead of using client

**Fix approach:**
- Import from centralized location: `src/lib/supabase.ts`
- Or use `supabase.auth.getSession()` + auth headers instead of manual fetch
- Centralize all API calls in hooks/API layer

---

### 17. Missing Loading States in Critical Flows

**Issue:** Some state-changing operations lack loading state feedback

**Files:**
- `src/pages/MyBookings.tsx` (line 193-205, handleCancel has no loading)

**Impact:**
- User clicks "Cancel Booking" button, nothing visible happens
- User clicks again thinking first click didn't work
- Double-cancellation attempts

**Fix approach:**
- Add `[cancellationLoading, setCancellationLoading]` state
- Disable button during API call
- Show "Cancelling..." text
- Handle errors with user-visible toast/alert

---

### 18. Timezone Handling Is Implicit

**Issue:** All dates stored in ISO format, but no explicit timezone handling

**Files:**
- `src/hooks/useAvailability.ts` (lines 27, 75-79)
- `src/components/trainer/AvailabilityManager.tsx` (lines 59-83)

**Impact:**
- Trainer in NY creates slot for 9am — stored as "2026-03-11T09:00:00Z" (UTC)
- Client in LA sees 9am but it's actually 6am their time
- No way to set slots in trainer's local timezone
- Date comparisons assume UTC

**Fix approach:**
- Store trainer's timezone in trainer_profiles table
- When creating slots, convert to UTC but store timezone_offset
- Display times in user's local timezone (detect via browser)
- Add timezone selector in AvailabilityManager

---

## Low-Priority Concerns / Design Improvements

### 19. Accessibility Gaps

**Issue:** Several interactive elements lack proper labels/semantic HTML

**Files:**
- `src/components/trainer/AvailabilityManager.tsx` (button cells, line 152)
- `src/components/search/SearchSection.tsx` (select dropdowns, line 105)

**Impact:**
- Screen readers can't properly describe availability grid
- Form inputs don't have associated labels
- Modal backdrop click handler (MyBookings.tsx:57) not keyboard accessible

**Fix approach:**
- Add `aria-label` to all interactive elements
- Use proper `<label>` elements for form inputs
- Add keyboard support (Escape to close modals, arrow keys for grid)
- Test with aXe or similar accessibility checker

---

### 20. Unused Dependencies

**Issue:** Several dependencies appear unused or redundant

**Files:**
- `package.json`

**Potential unused:**
- `recharts` — no charts visible in code
- `framer-motion` — no animations found in components
- `lucide-react` — good, actively used

**Impact:**
- Larger bundle size
- More maintenance surface area
- Unclear what's actually needed

**Fix approach:**
- Audit `package.json` for actual usage
- Remove unused deps, add back only if needed
- Document why heavy dependencies are included

---

## Missing Critical Features

### 21. Rate Limiting & DDoS Protection

**Issue:** No rate limiting on search, booking, or payment endpoints

**Impact:**
- Attackers could brute-force availability or booking endpoints
- Spam availability creation
- DDoS with large search queries

**Fix approach:**
- Implement rate limiting at Edge Function level
- Use headers like `X-RateLimit-Limit` in responses
- Block by IP after threshold (e.g., 100 requests/minute)

---

### 22. No Notification System

**Issue:** Users never notified about booking confirmations, cancellations, refunds

**Files:**
- `src/hooks/useNotifications.ts` (file exists but empty per git status)

**Impact:**
- Users don't know if booking succeeded
- Trainers don't know about new bookings
- Refunds processed silently

**Fix approach:**
- Implement email notifications via Supabase Functions
- Add in-app toast notifications
- Create notification preferences in user profile

---

### 23. No Audit Logging

**Issue:** No logging of sensitive operations (bookings, payments, profile changes)

**Impact:**
- Can't debug disputes (who cancelled? when?)
- Regulatory non-compliance (payment audits require logs)
- Can't detect suspicious activity

**Fix approach:**
- Create `audit_logs` table with:
  - action (booking_created, payment_processed, etc.)
  - user_id, timestamp
  - before/after data for mutations
  - IP address, user agent
- Log all state changes

---

## Summary Table

| Severity | Count | Categories |
|----------|-------|-----------|
| **Critical** | 5 | Payment race conditions, SQL injection risk, missing RLS, no Edge Function auth, token exposure |
| **High** | 6 | Cancellation/refunds, no input validation, cascading failures, GDPR, error handling, hardcoded rates |
| **Medium** | 7 | TODO incomplete, mock data hiding issues, no pagination, missing type validation, URL duplication, loading states, timezone |
| **Low** | 3 | Accessibility, unused deps, feature gaps (rate limiting, notifications, audit logs) |

---

*Concerns audit: 2026-03-11*
