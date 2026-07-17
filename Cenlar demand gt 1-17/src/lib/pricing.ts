/**
 * Canonical booking-pricing model shared across every entry point.
 *
 * FEE-ON-TOP model: the platform fee is added on top of the trainer's rate, so
 * a trainer always nets their full stated rate regardless of which app created
 * the booking (FitRush / Flutter and the web app must agree).
 *
 *   client pays    = rate + fee   (this is what Stripe charges -> rate_charged)
 *   platform keeps = fee          (the Stripe application_fee_amount)
 *   trainer nets   = rate         (rate_charged - fee, the full stated rate)
 *
 * This matches the FitRush (Flutter) create-payment-intent function. Both apps
 * write the same three columns to `bookings` / `payments`, which keeps the admin
 * Transactions/Analytics accounting identity exact:
 *
 *   rate_charged === platform_fee + trainer_payout
 *
 * The web app's create-payment-intent edge function relies on this identity: it
 * charges `rate_charged`, takes `platform_fee` as the application fee, and the
 * destination (trainer) receives `rate_charged - platform_fee === trainer_payout`.
 *
 * Comp / free sessions (is_comp = true, rate_charged = 0) do NOT use this model.
 * They are arranged via the admin_arrange_comp_booking RPC, where the platform
 * (not the client) covers the trainer payout. Never run a comp booking through
 * this function; see computeBookingPricing's zero-rate guard.
 */

/** Identifier for the canonical model, handy for logs/assertions. */
export const PRICING_MODEL = 'fee_on_top' as const;

/**
 * Fallback platform fee fraction used only when `platform_settings.platform_fee_pct`
 * cannot be loaded. Kept in sync with the live value (12%).
 */
export const DEFAULT_PLATFORM_FEE_PCT = 0.12;

export interface BookingPricing {
  /** Trainer's session rate after any discounts. The economic input. */
  rate: number;
  /** Platform fee, charged on top of the rate. */
  platformFee: number;
  /** Total charged to the client (rate + fee) === Stripe charge amount === bookings.rate_charged. */
  rateCharged: number;
  /** Amount the trainer nets — their full stated rate. */
  trainerPayout: number;
}

/** Round to cents, avoiding binary-float drift (e.g. 1.005 -> 1.01). */
const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Compute the canonical fee-on-top economics for a paid booking.
 *
 * Deriving `rateCharged = rate + fee` (rather than `rate * (1 + pct)`) and then
 * `trainerPayout = rateCharged - fee` guarantees the Stripe/accounting identity
 * holds to the cent and that the trainer always nets exactly `rate`.
 *
 * @param rate            Trainer's session rate after discounts (>= 0).
 * @param platformFeePct  Platform fee fraction, e.g. 0.12 for 12%.
 */
export function computeBookingPricing(rate: number, platformFeePct: number): BookingPricing {
  const safeRate = Number.isFinite(rate) && rate > 0 ? rate : 0;
  const safePct = Number.isFinite(platformFeePct) && platformFeePct > 0 ? platformFeePct : 0;

  // Zero-rate (incl. comp/free) bookings have no paid economics here.
  if (safeRate === 0) {
    return { rate: 0, platformFee: 0, rateCharged: 0, trainerPayout: 0 };
  }

  const platformFee = round2(safeRate * safePct);
  const rateCharged = round2(safeRate + platformFee);
  const trainerPayout = round2(rateCharged - platformFee);

  return { rate: round2(safeRate), platformFee, rateCharged, trainerPayout };
}
