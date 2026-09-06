import { describe, it, expect, vi } from 'vitest';
import { computeDisplayQuote, applyServerQuote } from './bookingQuote';

// usePlatformFee (imported for effectivePlatformFee) pulls in the Supabase client.
vi.mock('@/lib/supabase', () => ({ supabase: {} }));

const trainer = { optimized_rate: '60', discount_percentage: 10 };
const individual = { slot_type: 'individual', group_rate: null };
const group = { slot_type: 'group', group_rate: 25 };
const base = { feePct: 0.13, foundingStartedAt: null, isFounding: false, referralPending: false };

describe('computeDisplayQuote', () => {
  it('individual slots use optimized_rate minus discount_percentage, fee on top', () => {
    const q = computeDisplayQuote({ slot: individual, trainerProfile: trainer, ...base });
    expect(q.isGroup).toBe(false);
    expect(q.baseRate).toBe(60);
    expect(q.discountPct).toBe(10);
    expect(q.rate).toBe(54);
    expect(q.referralDiscount).toBe(0);
    expect(q.rateCharged).toBe(54);
    expect(q.platformFee).toBe(7.02);
    expect(q.total).toBe(61.02);
    expect(q.trainerPayout).toBe(54);
  });

  it('group slots use group_rate and ignore trainer + referral discounts', () => {
    const q = computeDisplayQuote({ slot: group, trainerProfile: trainer, ...base, referralPending: true });
    expect(q.isGroup).toBe(true);
    expect(q.baseRate).toBe(25);
    expect(q.discountPct).toBe(0);
    expect(q.rate).toBe(25);
    expect(q.referralDiscount).toBe(0);
    expect(q.rateCharged).toBe(25);
    expect(q.platformFee).toBe(3.25);
    expect(q.total).toBe(28.25);
  });

  it('applies the $5 referral discount to individual slots only, never below $0', () => {
    const q = computeDisplayQuote({ slot: individual, trainerProfile: trainer, ...base, referralPending: true });
    expect(q.referralDiscount).toBe(5);
    expect(q.rateCharged).toBe(49);
    expect(q.platformFee).toBe(6.37);
    expect(q.total).toBe(55.37);

    const cheap = computeDisplayQuote({
      slot: individual,
      trainerProfile: { optimized_rate: 3, discount_percentage: 0 },
      ...base,
      referralPending: true,
    });
    expect(cheap.referralDiscount).toBe(3);
    expect(cheap.rateCharged).toBe(0);
    expect(cheap.total).toBe(0);
  });

  it('charges 0% while the founding window is active', () => {
    const now = new Date('2026-09-05T00:00:00Z');
    const notStarted = computeDisplayQuote({ slot: individual, trainerProfile: trainer, ...base, isFounding: true, now });
    expect(notStarted.feePct).toBe(0);
    expect(notStarted.platformFee).toBe(0);
    expect(notStarted.total).toBe(54);

    const inWindow = computeDisplayQuote({
      slot: individual, trainerProfile: trainer, ...base, isFounding: true, foundingStartedAt: '2026-06-18T00:00:00Z', now,
    });
    expect(inWindow.platformFee).toBe(0);

    const expired = computeDisplayQuote({
      slot: individual, trainerProfile: trainer, ...base, isFounding: true, foundingStartedAt: '2025-06-18T00:00:00Z', now,
    });
    expect(expired.feePct).toBe(0.13);
    expect(expired.platformFee).toBe(7.02);
  });

  it('rounds the 13% fee to cents: $43 -> $5.59 fee / $48.59 total', () => {
    const q = computeDisplayQuote({
      slot: individual,
      trainerProfile: { optimized_rate: 43, discount_percentage: 0 },
      ...base,
    });
    expect(q.rateCharged).toBe(43);
    expect(q.platformFee).toBe(5.59);
    expect(q.total).toBe(48.59);
  });
});

describe('applyServerQuote', () => {
  it('overlays the RPC numbers and derives fee_pct when the server omits it', () => {
    const display = computeDisplayQuote({ slot: individual, trainerProfile: trainer, ...base });
    const q = applyServerQuote(display, { rate_charged: 43, platform_fee: 5.59, total: 48.59, trainer_payout: 43 });
    expect(q.rateCharged).toBe(43);
    expect(q.platformFee).toBe(5.59);
    expect(q.total).toBe(48.59);
    expect(q.trainerPayout).toBe(43);
    expect(q.feePct).toBe(0.13);
    // untouched display fields survive
    expect(q.discountPct).toBe(10);
  });
});
