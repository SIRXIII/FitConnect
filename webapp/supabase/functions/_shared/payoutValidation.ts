// Payout integrity invariant — enforced at the money EXIT (create-payout).
//
// Every payable payment row MUST satisfy:  trainer_payout + platform_fee == amount
//
// Why this closes the fraud chain without touching the booking entrance:
// payments.amount is what Stripe actually charged (create-payment-intent uses
// bookings.rate_charged), and payments has DB CHECKs that amount/platform_fee/
// trainer_payout are all >= 0. So an inflated trainer_payout (a browser-supplied
// p_trainer_payout at booking time) can only pass this check if `amount` is inflated
// too — which means Stripe really charged that much, so there is nothing to steal.
// A tampered row (e.g. payout=5000, fee=0, amount=50) fails the sum and the whole
// release is refused.
//
// ponytail: sum-consistency only. The fee-percent cross-check
// (platform_fee == round(amount * effective_fee_pct)) waits on the confirmed prod
// platform_fee_pct — three values currently disagree (0.13 / 0.08 / 0). Add it here
// once T8 pins the real value; this file is the one place both edge + tests read.
//
// Import-free on purpose so it runs under BOTH Deno (the edge function) and Vitest.

export interface PayoutRow {
  id: string;
  // Supabase returns numeric(10,2) as string or number depending on the client path,
  // so accept both and coerce.
  amount: number | string;
  platform_fee: number | string;
  trainer_payout: number | string;
  // Comp (free) sessions: the client pays $0 but the platform still pays the trainer,
  // so amount==0 while trainer_payout>0 is LEGITIMATE and must not be flagged here.
  // The comp payout is bounded to the trainer's real rate at CREATION, not at the exit.
  is_comp?: boolean | null;
}

// Half a cent: absorbs numeric(10,2) rounding without admitting any real inflation
// (the smallest storable difference is a full cent).
export const PAYOUT_TOLERANCE = 0.005;

export function isPayoutRowConsistent(row: PayoutRow): boolean {
  // Fail closed on null/undefined BEFORE Number() — Number(null) is 0, which would
  // silently treat an unknown charge as $0 rather than rejecting it.
  if (row.amount == null || row.platform_fee == null || row.trainer_payout == null) {
    return false;
  }
  const amount = Number(row.amount);
  const fee = Number(row.platform_fee);
  const payout = Number(row.trainer_payout);
  // A non-numeric value is treated as inconsistent (fail closed), never allowed through.
  if (!Number.isFinite(amount) || !Number.isFinite(fee) || !Number.isFinite(payout)) {
    return false;
  }
  if (row.is_comp) {
    // Comp: the client was charged nothing and there is no platform fee. A "comp" row
    // that charged the client (amount>0) or booked a fee (fee>0) is inconsistent.
    // trainer_payout>0 is allowed — the platform subsidizes it; the payout is bounded
    // to the trainer's canonical rate at the comp-creation path, not here.
    return amount === 0 && fee === 0;
  }
  // Paid booking: money must conserve — what the client paid == trainer payout + fee.
  return Math.abs(payout + fee - amount) <= PAYOUT_TOLERANCE;
}

/** Ids of rows that violate the invariant. Empty array => every row is consistent. */
export function findInconsistentPayoutRows(rows: PayoutRow[]): string[] {
  return rows.filter((row) => !isPayoutRowConsistent(row)).map((row) => row.id);
}
