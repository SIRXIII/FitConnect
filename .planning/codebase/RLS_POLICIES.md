# Supabase RLS Policy Audit

**Audited:** 2026-03-13
**Source:** `supabase/migrations/20260311143000_fitconnect_current_schema.sql` (lines 595–807)
**Status:** All 7 tables have RLS enabled. No critical gaps found.

---

## Summary

| Table | RLS Enabled | Policy Count | Verdict |
|-------|-------------|--------------|---------|
| `profiles` | ✅ | 2 | ✅ Correct |
| `trainer_profiles` | ✅ | 4 | ✅ Correct |
| `availability_slots` | ✅ | 4 | ✅ Correct |
| `bookings` | ✅ | 3 | ✅ Correct — no DELETE by design |
| `reviews` | ✅ | 2 | ✅ Correct |
| `notifications` | ✅ | 3 | ⚠️ Minor: users can insert own notifications |
| `payments` | ✅ | 3 | ✅ Correct — service_role only for writes |

---

## Table: `profiles`

| Policy | Operation | Expression | Verdict |
|--------|-----------|------------|---------|
| `profiles_select_public` | SELECT | `true` | ✅ Public profile directory is expected |
| `profiles_update_own` | UPDATE | `auth.uid() = id` | ✅ Users can only edit their own profile |

**No INSERT policy** — auth trigger creates the profile row on signup via `handle_new_user()` using service_role. Users cannot insert directly. ✅

---

## Table: `trainer_profiles`

| Policy | Operation | Expression | Verdict |
|--------|-----------|------------|---------|
| `trainer_profiles_select_public` | SELECT | `true` | ✅ Trainer discovery requires public access |
| `trainer_profiles_insert_own` | INSERT | `auth.uid() = user_id` | ✅ Trainers can only create their own profile |
| `trainer_profiles_update_own` | UPDATE | `auth.uid() = user_id` | ✅ Trainers can only modify their own profile |
| `trainer_profiles_delete_own` | DELETE | `auth.uid() = user_id` | ✅ Trainers can only delete their own profile |

---

## Table: `availability_slots`

| Policy | Operation | Expression | Verdict |
|--------|-----------|------------|---------|
| `availability_select_public_or_owner` | SELECT | `is_booked = false` OR trainer is owner OR client has booking for slot | ✅ Clients see open slots; trainers see all their slots; clients see their booked slots |
| `availability_insert_owner` | INSERT | trainer_id maps to `auth.uid()` via trainer_profiles | ✅ Trainers can only create their own slots |
| `availability_update_owner` | UPDATE | trainer_id maps to `auth.uid()` | ✅ Trainers can only update their own slots |
| `availability_delete_owner` | DELETE | trainer_id maps to `auth.uid()` | ✅ Trainers can only delete their own slots |

**Note:** The SELECT policy uses a subquery join through `trainer_profiles` to resolve `trainer_id → user_id`. This is correct and prevents a trainer from seeing another trainer's booked slots.

---

## Table: `bookings`

| Policy | Operation | Expression | Verdict |
|--------|-----------|------------|---------|
| `bookings_select_involved` | SELECT | `client_id = auth.uid()` OR trainer via join | ✅ Parties can see only their own bookings |
| `bookings_insert_client` | INSERT | `client_id = auth.uid()` | ✅ Clients can only book as themselves |
| `bookings_update_involved` | UPDATE | `client_id = auth.uid()` OR trainer via join | ✅ Both parties can update (status changes, cancellation) |

**No DELETE policy** — intentional. Bookings are never hard-deleted; they are soft-cancelled via status update. The `cleanup_abandoned_bookings()` DB function uses `SECURITY DEFINER` to bypass RLS for automated cleanup; it is not exposed as a client-callable RPC. ✅

---

## Table: `reviews`

| Policy | Operation | Expression | Verdict |
|--------|-----------|------------|---------|
| `reviews_select_public` | SELECT | `true` | ✅ Reviews are public (trainer star ratings) |
| `reviews_insert_completed_booking_client` | INSERT | `client_id = auth.uid()` AND booking exists AND booking is `completed` | ✅ Only the client of a completed booking can leave a review |

**Strong policy:** The INSERT check validates both ownership and booking status in one expression — no way to review without a completed booking. ✅

---

## Table: `notifications`

| Policy | Operation | Expression | Verdict |
|--------|-----------|------------|---------|
| `notifications_select_own` | SELECT | `user_id = auth.uid()` | ✅ Users see only their own notifications |
| `notifications_update_own` | UPDATE | `user_id = auth.uid()` | ✅ Users can only mark their own notifications read |
| `notifications_insert_service_or_owner` | INSERT | `auth.role() = 'service_role'` OR `user_id = auth.uid()` | ⚠️ See note |

**⚠️ Minor concern:** The INSERT policy allows users to insert notifications for themselves (`user_id = auth.uid()`). This means a user could create fake "You have a new booking!" notifications for themselves. Since notifications are only visible to the creating user, the practical impact is nil — this is not a privilege escalation. If desired, this could be restricted to `service_role` only in a future cleanup. Not blocking for Phase 1.

---

## Table: `payments`

| Policy | Operation | Expression | Verdict |
|--------|-----------|------------|---------|
| `payments_select_involved` | SELECT | EXISTS subquery: booking.client_id = uid OR booking via trainer | ✅ Payment details visible only to parties involved in the booking |
| `payments_insert_service_role` | INSERT | `auth.role() = 'service_role'` | ✅ Only Edge Functions (service_role) can create payment records |
| `payments_update_service_role` | UPDATE | `auth.role() = 'service_role'` | ✅ Only Edge Functions can update payment status |

**Strongest table:** Clients cannot insert or update payment records at all. All payment state changes go through Edge Functions using the service_role key. ✅

---

## Gaps and Recommendations

| Gap | Severity | Recommendation |
|-----|----------|----------------|
| `notifications` INSERT allows self-insert | Low | Restrict to `service_role` only in a future phase cleanup |
| `bookings` UPDATE: client can change `trainer_id` | Low | Add explicit field-level guards if needed (requires DB trigger or check constraint) |
| No rate limiting on any RLS policy | Info | Rate limiting is at API gateway level, not DB — acceptable |

**Overall:** RLS implementation is solid. The `payments` table is correctly locked to service_role for writes. The booking isolation correctly uses subquery joins rather than direct foreign key checks, preventing cross-user access even for related data.
