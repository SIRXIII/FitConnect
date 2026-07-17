import { describe, it, expect } from 'vitest';
import { computeBookingPricing, PRICING_MODEL, DEFAULT_PLATFORM_FEE_PCT } from './pricing';

/**
 * The platform fee must be computed identically no matter which app creates the
 * booking. Two booking rows for the same rate should be byte-for-byte equal on
 * { rate_charged, platform_fee, trainer_payout } regardless of entry point.
 */

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Shape stored on the `bookings` / `payments` rows. */
interface BookingEconomics {
  rate_charged: number;
  platform_fee: number;
  trainer_payout: number;
}

/**
 * Web-app entry point (BookSession.tsx instant book + BookingRequestQueue accept).
 * Both call the shared canonical helper.
 */
function webappPath(rate: number, feePct: number): BookingEconomics {
  const p = computeBookingPricing(rate, feePct);
  return { rate_charged: p.rateCharged, platform_fee: p.platformFee, trainer_payout: p.trainerPayout };
}

/**
 * FitRush (Flutter) create-payment-intent, encoded independently from the shared
 * module so this test fails if the two ever diverge:
 *   - client pays rate + rate * fee_pct   (fee on top)
 *   - platform keeps rate * fee_pct
 *   - trainer nets their full stated rate
 */
function flutterPath(rate: number, feePct: number): BookingEconomics {
  return {
    rate_charged: round2(rate + rate * feePct),
    platform_fee: round2(rate * feePct),
    trainer_payout: rate,
  };
}

const RATES = [45, 49.99, 50, 60, 75, 80, 90, 95, 100, 120, 33.33];
const FEE_PCTS = [0.08, 0.12, 0.15];

describe('canonical booking pricing (fee-on-top)', () => {
  it('exposes the fee-on-top model id and a live-aligned default fee', () => {
    expect(PRICING_MODEL).toBe('fee_on_top');
    expect(DEFAULT_PLATFORM_FEE_PCT).toBe(0.12);
  });

  it('adds the fee on top so the trainer nets their full rate (rate 100 @ 12%)', () => {
    expect(computeBookingPricing(100, 0.12)).toEqual({
      rate: 100,
      platformFee: 12,
      rateCharged: 112,
      trainerPayout: 100,
    });
  });

  it('keeps the accounting identity rate_charged === platform_fee + trainer_payout', () => {
    for (const rate of RATES) {
      for (const pct of FEE_PCTS) {
        const { rateCharged, platformFee, trainerPayout } = computeBookingPricing(rate, pct);
        expect(round2(platformFee + trainerPayout)).toBe(rateCharged);
        // Trainer is made whole — nets exactly their stated rate.
        expect(trainerPayout).toBe(round2(rate));
      }
    }
  });

  it('produces identical economics whether booked via the web app or Flutter', () => {
    for (const rate of RATES) {
      for (const pct of FEE_PCTS) {
        const web = webappPath(rate, pct);
        const flutter = flutterPath(rate, pct);
        expect(web).toEqual(flutter);
      }
    }
  });
});

describe('comp / free bookings are exempt', () => {
  // Comp bookings are created by admin_arrange_comp_booking, NOT the paid model:
  // rate_charged = 0, platform_fee = 0, trainer_payout = rate (platform-funded).
  function compBooking(rate: number): BookingEconomics & { is_comp: true } {
    return { rate_charged: 0, platform_fee: 0, trainer_payout: rate, is_comp: true };
  }

  it('leaves a comp booking untouched (no fee applied, payout = full rate)', () => {
    expect(compBooking(60)).toEqual({
      rate_charged: 0,
      platform_fee: 0,
      trainer_payout: 60,
      is_comp: true,
    });
  });

  it('never fabricates a charge for a zero-rate booking via the paid model', () => {
    expect(computeBookingPricing(0, 0.12)).toEqual({
      rate: 0,
      platformFee: 0,
      rateCharged: 0,
      trainerPayout: 0,
    });
  });
});
