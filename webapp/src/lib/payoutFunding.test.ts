import { describe, it, expect } from 'vitest';
import {
  summarizePayoutFunding,
  formatCents,
  isReleasableSession,
  sessionSelectionTotalCents,
  type TrainerSession,
} from './payoutFunding';

const session = (over: Partial<TrainerSession> = {}): TrainerSession => ({
  booking_id: 'b',
  booking_status: 'completed',
  is_comp: false,
  start_time: '2026-07-29T18:00:00Z',
  end_time: '2026-07-29T19:00:00Z',
  client_name: 'Xman',
  rate_charged: 43,
  trainer_payout: 43,
  payment_id: 'pay',
  payment_status: 'succeeded',
  payment_trainer_payout: 43,
  payout_transaction_id: null,
  ...over,
});

const row = (over: Partial<{ releasable_balance: number; not_yet_completed_balance: number; payout_on_hold: boolean }> = {}) => ({
  releasable_balance: 0,
  not_yet_completed_balance: 0,
  payout_on_hold: false,
  ...over,
});

describe('summarizePayoutFunding', () => {
  it('reproduces the failing release: $86 owed, nothing available', () => {
    const f = summarizePayoutFunding(
      { available_cents: 0, pending_cents: 8600 },
      [row({ releasable_balance: 86 })],
    );
    expect(f.releasableCents).toBe(8600);
    expect(f.shortfallCents).toBe(8600);
    expect(f.canReleaseAll).toBe(false);
  });

  it('clears once the pending funds settle', () => {
    const f = summarizePayoutFunding(
      { available_cents: 8600, pending_cents: 0 },
      [row({ releasable_balance: 86 })],
    );
    expect(f.shortfallCents).toBe(0);
    expect(f.canReleaseAll).toBe(true);
  });

  it('excludes held trainers from what must be funded', () => {
    const f = summarizePayoutFunding(
      { available_cents: 4300, pending_cents: 0 },
      [row({ releasable_balance: 43 }), row({ releasable_balance: 43, payout_on_hold: true })],
    );
    expect(f.releasableCents).toBe(4300);
    expect(f.shortfallCents).toBe(0);
    expect(f.canReleaseAll).toBe(true);
  });

  it('counts awaiting-session money separately and never as releasable', () => {
    const f = summarizePayoutFunding(
      { available_cents: 0, pending_cents: 0 },
      [row({ not_yet_completed_balance: 120.5 })],
    );
    expect(f.awaitingSessionCents).toBe(12050);
    expect(f.releasableCents).toBe(0);
    expect(f.shortfallCents).toBe(0);
  });

  it('sums in cents so float addition cannot drift', () => {
    const f = summarizePayoutFunding(
      { available_cents: 0, pending_cents: 0 },
      [row({ releasable_balance: 0.1 }), row({ releasable_balance: 0.2 })],
    );
    expect(f.releasableCents).toBe(30);
    expect(formatCents(f.releasableCents)).toBe('$0.30');
  });

  it('does not claim funding is fine when the balance is unknown', () => {
    const f = summarizePayoutFunding(null, [row({ releasable_balance: 86 })]);
    expect(f.canReleaseAll).toBe(false);
    expect(f.shortfallCents).toBe(8600);
  });
});

describe('isReleasableSession', () => {
  it('accepts a completed, paid, unswept session', () => {
    expect(isReleasableSession(session())).toBe(true);
  });

  it.each([
    ['booking not completed', { booking_status: 'confirmed' }],
    ['payment not succeeded', { payment_status: 'pending' }],
    ['no payment row (comp)', { payment_id: null, payment_status: null, is_comp: true }],
    ['already swept into a payout', { payout_transaction_id: 'po_1' }],
  ])('rejects when %s', (_label, over) => {
    expect(isReleasableSession(session(over as Partial<TrainerSession>))).toBe(false);
  });
});

describe('sessionSelectionTotalCents', () => {
  it("sums Derek's two selected sessions to $86.00", () => {
    const sessions = [
      session({ payment_id: 'a' }),
      session({ payment_id: 'b' }),
    ];
    const total = sessionSelectionTotalCents(sessions, new Set(['a', 'b']));
    expect(total).toBe(8600);
    expect(formatCents(total)).toBe('$86.00');
  });

  it('counts only the ticked sessions', () => {
    const sessions = [session({ payment_id: 'a' }), session({ payment_id: 'b' })];
    expect(sessionSelectionTotalCents(sessions, new Set(['a']))).toBe(4300);
  });

  it('ignores sessions with no payment id', () => {
    const sessions = [session({ payment_id: null, payment_trainer_payout: null })];
    expect(sessionSelectionTotalCents(sessions, new Set())).toBe(0);
  });

  it('sums in cents so mixed rates cannot drift', () => {
    const sessions = [
      session({ payment_id: 'a', payment_trainer_payout: 0.1 }),
      session({ payment_id: 'b', payment_trainer_payout: 0.2 }),
    ];
    expect(sessionSelectionTotalCents(sessions, new Set(['a', 'b']))).toBe(30);
  });
});
