# Phase 17: Security Hardening — PLAN

**Goal:** Close remaining security gaps identified in audit. Most SEC requirements are already met.
**Requirements:** SEC-01 → SEC-07

## Pre-Audit Findings

| REQ | Status | Notes |
|-----|--------|-------|
| SEC-01 (JWT verification) | ✅ Already done | All 14 Edge Functions verify JWT |
| SEC-02 (SQL injection) | ✅ Already done | All queries parameterized via Supabase SDK |
| SEC-03 (RLS audit) | ✅ Mostly done | 40+ policies across 14 tables; needs formal doc |
| SEC-04 (Payment race condition) | ✅ Already done | Webhook-driven, not client-side |
| SEC-05 (Cancellation refunds) | ✅ Already done | 24-hour window, Stripe refund via Edge Function |
| SEC-06 (Zod validation) | ⚠️ Gaps | Only 3 schemas; onboarding + admin missing |
| SEC-07 (Audit log) | ❌ Missing | No audit_log table exists |

## Plan 1: Zod Validation Expansion (SEC-06)

### Tasks
1. Create `src/lib/validators.ts` with comprehensive Zod schemas:
   - `trainerProfileSchema` (bio: max 1000, location: max 100, hourly_rate: 10-10000, optimized_rate, specialty)
   - `clientProfileSchema` (health_notes: max 2000, age: 13-120, weight_lbs: 50-1000, fitness_goals, workout_types)
   - `adminTierOverrideSchema` (user_id: uuid, new_tier: enum, reason: max 500)
   - `bookingSchema` (slot_id: uuid, notes: max 500)
   - `platformSettingsSchema` (platform_fee_percentage: 1-50)
2. Wire validators into Edge Functions that accept user input:
   - `admin-set-tier-override`: validate payload with `adminTierOverrideSchema`
3. Wire validators into client-side forms:
   - TrainerOnboarding: validate before submit
   - ClientOnboarding: validate before submit
   - AdminDashboard platformFee input

### Acceptance
- All user-facing form inputs have Zod schemas
- Edge Functions reject invalid payloads with 400 + clear error

## Plan 2: Audit Log Table + Triggers (SEC-07)

### Tasks
1. Create migration `20260317_audit_log.sql`:
   - `audit_log` table: id, actor_id, action, table_name, record_id, old_values (jsonb), new_values (jsonb), ip_address, created_at
   - RLS: only admin and service_role can read; insert via trigger functions
   - Index on `created_at`, `actor_id`, `table_name`
2. Create audit trigger function `log_audit_event()`:
   - Captures INSERT/UPDATE/DELETE on security-sensitive tables
   - Records old vs new values as JSONB
3. Attach triggers to security-sensitive tables:
   - `trainer_profiles` (tier changes, rate changes)
   - `payments` (status changes)
   - `bookings` (cancellations)
   - `platform_settings` (fee changes)
4. Add admin audit log viewer to AdminDashboard (read-only table)

### Acceptance
- Audit log records all tier overrides, refunds, and admin actions
- Admin can view audit log from dashboard
- No performance degradation on audited tables

## Plan 3: RLS Formal Verification (SEC-03)

### Tasks
1. Document all RLS policies in a verification matrix
2. Write pgTAP tests verifying:
   - Unauthenticated users cannot read/write any table
   - Clients cannot read other clients' bookings
   - Trainers cannot modify their own subscription_tier
   - Admin policies are role-gated

### Acceptance
- RLS verification matrix documented
- Key policies have test coverage

## Execution Order

Plan 1 (Zod) → Plan 2 (Audit Log) → Plan 3 (RLS Verification)
