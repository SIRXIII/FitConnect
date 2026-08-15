import { describe, it, expect } from 'vitest';
import {
  resolveReferralReward,
  callerAuthorizedForBooking,
  type ResolveReferralRewardInput,
} from './referralReward';

// The reward matrix under test (see plans/should-we-add-referrals-velvety-church.md):
//   client  / trainer (has trainer_profiles row) -> trainer_payout
//   client  / client (no trainer_profiles row)   -> client_discount
//   trainer / the client on this booking          -> client_discount
//   trainer / anyone else                         -> none

describe('resolveReferralReward', () => {
  it('rewards trainer_payout when a referred client was referred by a trainer', () => {
    expect(
      resolveReferralReward({
        matchedSide: 'client',
        referredRole: 'client',
        referrerHasTrainerProfile: true,
        referrerIsBookingClient: false,
      }),
    ).toBe('trainer_payout');
  });

  it('rewards client_discount when a referred client was referred by another client', () => {
    expect(
      resolveReferralReward({
        matchedSide: 'client',
        referredRole: 'client',
        referrerHasTrainerProfile: false,
        referrerIsBookingClient: false,
      }),
    ).toBe('client_discount');
  });

  it('rewards client_discount when a referred trainer books with the referring client', () => {
    expect(
      resolveReferralReward({
        matchedSide: 'trainer',
        referredRole: 'trainer',
        referrerHasTrainerProfile: false,
        referrerIsBookingClient: true,
      }),
    ).toBe('client_discount');
  });

  it('rewards none when a referred trainer completes a booking with someone else', () => {
    expect(
      resolveReferralReward({
        matchedSide: 'trainer',
        referredRole: 'trainer',
        referrerHasTrainerProfile: false,
        referrerIsBookingClient: false,
      }),
    ).toBe('none');
  });

  it('ignores referrerHasTrainerProfile for trainer-referred rows (client_discount still wins)', () => {
    // A referrer can hold a trainer_profiles row and also be the client on
    // this specific booking (a trainer who books sessions as a client).
    const input: ResolveReferralRewardInput = {
      matchedSide: 'trainer',
      referredRole: 'trainer',
      referrerHasTrainerProfile: true,
      referrerIsBookingClient: true,
    };
    expect(resolveReferralReward(input)).toBe('client_discount');
  });

  it('rewards none when the row says trainer but matched the client side of the booking', () => {
    // Attack case: a user self-inserts referred_id = own uid (which lands on
    // the client side of this booking) but claims referred_role = 'trainer'
    // naming an accomplice trainer as referrer. Even though that accomplice
    // has a trainer_profiles row (which would normally earn trainer_payout),
    // the side/role mismatch must still block the reward.
    expect(
      resolveReferralReward({
        matchedSide: 'client',
        referredRole: 'trainer',
        referrerHasTrainerProfile: true,
        referrerIsBookingClient: false,
      }),
    ).toBe('none');
  });

  it('rewards none when the row says client but matched the trainer side of the booking', () => {
    expect(
      resolveReferralReward({
        matchedSide: 'trainer',
        referredRole: 'client',
        referrerHasTrainerProfile: true,
        referrerIsBookingClient: true,
      }),
    ).toBe('none');
  });
});

describe('callerAuthorizedForBooking', () => {
  it('authorizes the booking client', () => {
    expect(
      callerAuthorizedForBooking({
        callerId: 'client-1',
        bookingClientId: 'client-1',
        bookingTrainerUserId: 'trainer-user-1',
      }),
    ).toBe(true);
  });

  it('authorizes the booking trainer, matched by resolved user_id not trainer_profiles.id', () => {
    expect(
      callerAuthorizedForBooking({
        callerId: 'trainer-user-1',
        bookingClientId: 'client-1',
        bookingTrainerUserId: 'trainer-user-1',
      }),
    ).toBe(true);
  });

  it('rejects a stranger who is neither the client nor the trainer', () => {
    expect(
      callerAuthorizedForBooking({
        callerId: 'stranger-1',
        bookingClientId: 'client-1',
        bookingTrainerUserId: 'trainer-user-1',
      }),
    ).toBe(false);
  });

  it('rejects the trainer, and still authorizes the client, when trainer user_id could not be resolved', () => {
    expect(
      callerAuthorizedForBooking({
        callerId: 'trainer-user-1',
        bookingClientId: 'client-1',
        bookingTrainerUserId: null,
      }),
    ).toBe(false);
    expect(
      callerAuthorizedForBooking({
        callerId: 'client-1',
        bookingClientId: 'client-1',
        bookingTrainerUserId: null,
      }),
    ).toBe(true);
  });
});
