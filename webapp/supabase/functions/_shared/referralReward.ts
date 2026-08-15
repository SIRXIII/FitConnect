// Referral reward decision. Pure functions for process-referral-reward.
//
// Reward matrix (see plans/should-we-add-referrals-velvety-church.md):
//
// | Referred | Referrer                                    | Decision        |
// |----------|----------------------------------------------|-----------------|
// | client   | trainer (has a trainer_profiles row)          | trainer_payout  |
// | client   | client (no trainer_profiles row)              | client_discount |
// | trainer  | the client on this booking                    | client_discount |
// | trainer  | anyone else                                   | none            |
//
// bookings.trainer_id stores trainer_profiles.id, NOT the trainer's
// profiles.id / auth.uid(). Callers must resolve the trainer's user_id
// (trainer_profiles.user_id) before comparing it against referrals.referrer_id
// or referrals.referred_id. That id-space mismatch is what made the
// trainer-referral branch dead code.
//
// resolveReferralReward also requires matchedSide (which side of the
// booking referred_id landed on) to agree with referredRole (what the
// referral row itself claims). RLS lets a user self-insert a referrals row
// with referred_id = own uid and any referred_role, so the two must be
// cross-checked here rather than trusting either alone.
//
// Import-free on purpose so it runs under BOTH Deno (the edge function) and Vitest.

export type ReferredRole = 'client' | 'trainer';
export type ReferralRewardDecision = 'trainer_payout' | 'client_discount' | 'none';

export interface ResolveReferralRewardInput {
  /**
   * Which side of the current booking referrals.referred_id matched
   * (client_id or the trainer's resolved user_id), or null if neither.
   * Computed by the caller from the booking row.
   */
  matchedSide: ReferredRole | null;
  /**
   * The role stored on the referral row itself (referrals.referred_role).
   * A self-inserted referral row can claim referred_id = own uid with any
   * referred_role it likes, so this must be cross-checked against
   * matchedSide below rather than trusted on its own.
   */
  referredRole: ReferredRole;
  /** Does the referrer (who shared the link) have a trainer_profiles row? */
  referrerHasTrainerProfile: boolean;
  /**
   * Only meaningful when referredRole === 'trainer': is the referrer the
   * client on THIS booking (the referring client booked the trainer they
   * referred)? Ignored when referredRole === 'client'.
   */
  referrerIsBookingClient: boolean;
}

export function resolveReferralReward(input: ResolveReferralRewardInput): ReferralRewardDecision {
  // The side the row matched on this booking must agree with the role
  // stored on the row. Without this, a user could self-insert a referral
  // row naming an accomplice as referrer with a fabricated referred_role
  // and collect a reward for a role they never actually held.
  if (input.matchedSide !== input.referredRole) return 'none';

  if (input.referredRole === 'client') {
    return input.referrerHasTrainerProfile ? 'trainer_payout' : 'client_discount';
  }
  // referredRole === 'trainer': only the referring client is rewarded, and
  // only when they are actually the client on this booking.
  return input.referrerIsBookingClient ? 'client_discount' : 'none';
}

export interface CallerAuthorizedForBookingInput {
  callerId: string;
  bookingClientId: string;
  /**
   * The booking trainer's profiles.id / auth.uid(), resolved from
   * trainer_profiles.user_id (NOT bookings.trainer_id, which is
   * trainer_profiles.id). Null when that row could not be resolved.
   */
  bookingTrainerUserId: string | null;
}

/** True when the caller is either the booking's client or its trainer. */
export function callerAuthorizedForBooking(input: CallerAuthorizedForBookingInput): boolean {
  return (
    input.callerId === input.bookingClientId ||
    (input.bookingTrainerUserId != null && input.callerId === input.bookingTrainerUserId)
  );
}
