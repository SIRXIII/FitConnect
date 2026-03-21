# Phase 37 Context — Group Sessions

**Phase:** 37
**Milestone:** v6.0 Growth Engine
**Status:** Ready to plan

## Goal

Trainers can create group session slots with a max capacity. Multiple clients book the same slot at a lower per-person rate. Clients see remaining spots. Trainer sees all participants.

## Requirements

- GROUP-01: New slot type "group" with `max_capacity` (2–10) and `group_rate` fields
- GROUP-02: Group slot shows "X/Y spots remaining" on trainer profile
- GROUP-03: Trainer sets group rate separately from 1-on-1 rate
- GROUP-04: Booking flow handles group slots (multiple clients per slot)
- GROUP-05: Trainer sees all participants for a group session
- GROUP-06: Group cancellation only removes that client, not the whole slot

## Success Criteria

1. Trainer can create a group slot with capacity and per-person rate
2. Client sees "3/5 spots left" and books at the group rate
3. Multiple clients can book the same slot
4. Trainer dashboard shows all participants for group sessions

## Technical Context

### Current Slot Infrastructure
- `availability_slots` table: `id`, `trainer_id`, `start_time`, `end_time`, `is_available`, `is_booked`, `price`
- `bookings` table: `id`, `slot_id`, `client_id`, `trainer_id`, `status`, `amount_paid`, etc.
- Current constraint: one booking per slot (`is_booked` flips to true on booking)
- Slot creation UI in trainer dashboard availability tab
- Booking wizard reads slot data, creates payment intent, creates booking record

### Schema Migration
```sql
-- Add group session fields to availability_slots
ALTER TABLE availability_slots
  ADD COLUMN slot_type TEXT NOT NULL DEFAULT 'individual' CHECK (slot_type IN ('individual', 'group')),
  ADD COLUMN max_capacity INTEGER DEFAULT NULL CHECK (max_capacity IS NULL OR (max_capacity >= 2 AND max_capacity <= 10)),
  ADD COLUMN group_rate NUMERIC DEFAULT NULL;

-- Update is_booked logic: for group slots, only mark booked when full
-- New computed approach: query booking count against max_capacity in RPCs
```

### Booking Logic Change
Current flow: slot `is_booked = true` after first booking (individual).
Group flow: slot stays available (`is_available = true`, `is_booked = false`) until booking count = `max_capacity`.
- New RPC `get_slot_booking_count(slot_id)` returns confirmed booking count
- Booking wizard checks: for group slots, allow booking if `count < max_capacity`
- `create-payment-intent` edge function checks capacity before creating booking

### UI Changes
**Trainer availability tab** — slot creation form:
- Toggle: Individual / Group
- If Group: show `Max Capacity` number input (2-10) + `Group Rate (per person)` price input
- Existing `price` field remains for individual slots

**Trainer profile (client view)** — slot display:
- Group slots show "X/Y spots left" badge instead of just time
- Book button uses `group_rate` for display price

**Booking wizard:**
- Detect `slot_type === 'group'` and show group rate + "spots remaining" in review step
- Payment uses `group_rate` not `price`

**Trainer dashboard — booking details:**
- Group session card shows participant list (names, avatar thumbnails)
- Pulled via query: `bookings WHERE slot_id = X AND status = 'confirmed'` + profiles join

### Cancellation
`cancel-booking` edge function already removes individual booking and marks slot available.
For group slots: remove booking record only — do NOT change `is_available` or `is_booked` on the slot (other participants remain).
Need to differentiate: check `slot_type` in cancel function.

## Constraints

- Additive migration only — existing `individual` slots unaffected, default `slot_type = 'individual'`
- No group payment splitting — each client pays independently via existing `create-payment-intent`
- Group session notifications (booking confirmation) use same `send-notification-email` infrastructure
