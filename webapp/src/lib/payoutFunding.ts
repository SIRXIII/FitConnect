// Can the platform actually fund the payouts it owes right now?
//
// create-payout draws on the Stripe platform AVAILABLE balance. Money that
// clients have paid but Stripe has not settled yet sits in PENDING and cannot
// be transferred, which surfaces as balance_insufficient. This turns those two
// numbers plus what we owe trainers into one answer.
//
// Unit discipline: Stripe speaks integer cents, the get_admin_payout_balances()
// RPC returns numeric dollars. Everything is converted to cents on the way in
// so the two never mix, and 0.1 + 0.2 never becomes 0.30000000000000004.

const toCents = (dollars: number) => Math.round((Number(dollars) || 0) * 100);

export interface StripePlatformBalance {
  available_cents: number;
  pending_cents: number;
}

export interface TrainerBalanceRow {
  releasable_balance: number;
  not_yet_completed_balance: number;
  payout_on_hold: boolean;
}

export interface PayoutFunding {
  availableCents: number;
  pendingCents: number;
  /** Owed for completed sessions, excluding trainers whose payouts are held. */
  releasableCents: number;
  /** Paid by the client, session not yet completed, so not payable yet. */
  awaitingSessionCents: number;
  /** How much more available balance is needed to clear every release. */
  shortfallCents: number;
  /** False when the balance is unknown, so the UI never implies "all good". */
  canReleaseAll: boolean;
}

export function summarizePayoutFunding(
  balance: StripePlatformBalance | null,
  trainerBalances: TrainerBalanceRow[],
): PayoutFunding {
  // Held trainers are excluded: their money cannot be released, so counting it
  // would overstate the shortfall and show a warning that no action can clear.
  const releasableCents = trainerBalances
    .filter((b) => !b.payout_on_hold)
    .reduce((sum, b) => sum + toCents(b.releasable_balance), 0);

  const awaitingSessionCents = trainerBalances
    .reduce((sum, b) => sum + toCents(b.not_yet_completed_balance), 0);

  const availableCents = balance?.available_cents ?? 0;
  const pendingCents = balance?.pending_cents ?? 0;

  return {
    availableCents,
    pendingCents,
    releasableCents,
    awaitingSessionCents,
    shortfallCents: Math.max(0, releasableCents - availableCents),
    canReleaseAll: balance !== null && availableCents >= releasableCents,
  };
}

export const formatCents = (cents: number) =>
  `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
