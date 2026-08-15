import { describe, it, expect } from 'vitest';
import {
  isPayoutRowConsistent,
  findInconsistentPayoutRows,
  PAYOUT_TOLERANCE,
  type PayoutRow,
} from './payoutValidation';

// The invariant under test: trainer_payout + platform_fee == amount.
// amount is what Stripe actually charged, so this is the money-exit guard that
// makes an inflated booking-time trainer_payout un-payable.

describe('isPayoutRowConsistent', () => {
  it('accepts a standard 13% fee split', () => {
    // rate 100, fee 13, payout 87
    expect(isPayoutRowConsistent({ id: 'a', amount: 100, platform_fee: 13, trainer_payout: 87 })).toBe(true);
  });

  it('accepts a founding-trainer 0% row (fee 0, payout == amount)', () => {
    expect(isPayoutRowConsistent({ id: 'a', amount: 50, platform_fee: 0, trainer_payout: 50 })).toBe(true);
  });

  it('accepts a comp/free row (0/0/0)', () => {
    expect(isPayoutRowConsistent({ id: 'a', amount: 0, platform_fee: 0, trainer_payout: 0 })).toBe(true);
  });

  it('accepts a comp row where the platform pays the trainer (amount 0, fee 0, payout > 0)', () => {
    // Comp: client charged nothing, platform subsidizes the trainer. Legit — payout is
    // bounded at creation, not here.
    expect(isPayoutRowConsistent({ id: 'a', amount: 0, platform_fee: 0, trainer_payout: 43, is_comp: true })).toBe(true);
  });

  it('REJECTS a comp row that charged the client (is_comp but amount > 0)', () => {
    expect(isPayoutRowConsistent({ id: 'a', amount: 43, platform_fee: 0, trainer_payout: 43, is_comp: true })).toBe(false);
  });

  it('REJECTS a comp row that booked a platform fee (is_comp but fee > 0)', () => {
    expect(isPayoutRowConsistent({ id: 'a', amount: 0, platform_fee: 5, trainer_payout: 43, is_comp: true })).toBe(false);
  });

  it('still applies the strict sum check to a NON-comp row with amount 0', () => {
    // A non-comp row claiming payout against a $0 charge is the fraud case.
    expect(isPayoutRowConsistent({ id: 'a', amount: 0, platform_fee: 0, trainer_payout: 43, is_comp: false })).toBe(false);
  });

  it('REJECTS the classic inflated payout (5000 payout against a $50 charge)', () => {
    expect(isPayoutRowConsistent({ id: 'a', amount: 50, platform_fee: 0, trainer_payout: 5000 })).toBe(false);
  });

  it('REJECTS a comp row that carries a non-zero payout (amount 0, payout 50)', () => {
    expect(isPayoutRowConsistent({ id: 'a', amount: 0, platform_fee: 0, trainer_payout: 50 })).toBe(false);
  });

  it('REJECTS when payout+fee overshoots amount even slightly beyond tolerance', () => {
    // 50 + 0.02 drift; a full cent is well over the half-cent tolerance
    expect(isPayoutRowConsistent({ id: 'a', amount: 50, platform_fee: 0, trainer_payout: 50.02 })).toBe(false);
  });

  it('coerces string numerics (Supabase returns numeric(10,2) as strings on some paths)', () => {
    expect(isPayoutRowConsistent({ id: 'a', amount: '100.00', platform_fee: '13.00', trainer_payout: '87.00' })).toBe(true);
    expect(isPayoutRowConsistent({ id: 'a', amount: '50.00', platform_fee: '0.00', trainer_payout: '5000.00' })).toBe(false);
  });

  it('absorbs sub-cent rounding within tolerance', () => {
    // 33.34 + 66.66 = 100.00 exactly; and a 0.004 drift stays within PAYOUT_TOLERANCE
    expect(isPayoutRowConsistent({ id: 'a', amount: 100, platform_fee: 66.66, trainer_payout: 33.34 })).toBe(true);
    expect(isPayoutRowConsistent({ id: 'a', amount: 50, platform_fee: 0, trainer_payout: 50 - PAYOUT_TOLERANCE / 2 })).toBe(true);
  });

  it('fails closed on non-numeric / NaN values', () => {
    expect(isPayoutRowConsistent({ id: 'a', amount: 'not-a-number', platform_fee: 0, trainer_payout: 0 })).toBe(false);
    // @ts-expect-error deliberately malformed input
    expect(isPayoutRowConsistent({ id: 'a', amount: null, platform_fee: 0, trainer_payout: 0 })).toBe(false);
  });
});

describe('findInconsistentPayoutRows', () => {
  it('returns [] when every row is consistent', () => {
    const rows: PayoutRow[] = [
      { id: '1', amount: 100, platform_fee: 13, trainer_payout: 87 },
      { id: '2', amount: 50, platform_fee: 0, trainer_payout: 50 },
      { id: '3', amount: 0, platform_fee: 0, trainer_payout: 0 },
    ];
    expect(findInconsistentPayoutRows(rows)).toEqual([]);
  });

  it('returns only the ids of the tampered rows in a mixed batch', () => {
    const rows: PayoutRow[] = [
      { id: 'ok1', amount: 100, platform_fee: 13, trainer_payout: 87 },
      { id: 'bad1', amount: 50, platform_fee: 0, trainer_payout: 5000 },
      { id: 'ok2', amount: 50, platform_fee: 0, trainer_payout: 50 },
      { id: 'bad2', amount: 0, platform_fee: 0, trainer_payout: 50 },
    ];
    expect(findInconsistentPayoutRows(rows)).toEqual(['bad1', 'bad2']);
  });

  it('handles an empty batch', () => {
    expect(findInconsistentPayoutRows([])).toEqual([]);
  });
});
