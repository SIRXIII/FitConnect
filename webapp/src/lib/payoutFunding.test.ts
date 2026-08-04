import { describe, it, expect } from 'vitest';
import { summarizePayoutFunding, formatCents } from './payoutFunding';

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
