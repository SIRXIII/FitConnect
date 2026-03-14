/**
 * Rule-based slot classification engine (REQ-AI-01, REQ-AI-02)
 * No ML — pure deterministic rules based on booking state and timing.
 *
 * Classifications:
 *   BOOKED  — slot is already reserved
 *   BLOCKED — slot is in the past or soft-deleted
 *   BUFFER  — unbooked, future, but starting within 2 hours (hard to fill last-minute)
 *   IDLE    — unbooked, future, > 2 hours away — prime candidate for discount-driven booking
 */

export type SlotClass = 'booked' | 'blocked' | 'buffer' | 'idle';

/** Slots starting within this window are classified BUFFER, not IDLE */
const BUFFER_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours

export interface ClassifiableSlot {
  is_booked: boolean;
  deleted_at: string | null;
  start_time: string;
}

export function classifySlot(slot: ClassifiableSlot, now = new Date()): SlotClass {
  if (slot.deleted_at) return 'blocked';
  if (slot.is_booked) return 'booked';

  const startMs = new Date(slot.start_time).getTime();
  if (startMs <= now.getTime()) return 'blocked';
  if (startMs - now.getTime() < BUFFER_WINDOW_MS) return 'buffer';
  return 'idle';
}

export function isIdleSlot(slot: ClassifiableSlot, now = new Date()): boolean {
  return classifySlot(slot, now) === 'idle';
}

export function isBufferSlot(slot: ClassifiableSlot, now = new Date()): boolean {
  return classifySlot(slot, now) === 'buffer';
}

/** Count idle slots in a list */
export function countIdleSlots(slots: ClassifiableSlot[]): number {
  const now = new Date();
  return slots.filter((s) => isIdleSlot(s, now)).length;
}

/** Build per-trainer idle slot counts from a flat slot list */
export function buildIdleSlotCounts(
  slots: Array<ClassifiableSlot & { trainer_id: string }>
): Record<string, number> {
  const now = new Date();
  return slots.reduce(
    (acc, s) => {
      if (isIdleSlot(s, now)) {
        acc[s.trainer_id] = (acc[s.trainer_id] || 0) + 1;
      }
      return acc;
    },
    {} as Record<string, number>
  );
}
