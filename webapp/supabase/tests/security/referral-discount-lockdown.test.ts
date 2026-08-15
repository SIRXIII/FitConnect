import { describe, it, expect, afterAll } from 'vitest';
import {
  admin, createUser, createTrainer, createSlot, createBooking, cleanupUsers,
} from '../helpers/testClients';

// Referral discount column lockdown acceptance spec. profiles_update_own
// (auth.uid() = id, no column scoping) lets any authenticated user set their
// own profiles.referral_discount_pending = true directly, any number of
// times -- a repeatable self-granted $5 booking discount. RED = open hole;
// goes green once the trigger + claim_signup_referral_discount() RPC land.
// Requires a local instance: `supabase start` before `npm run test:db`.

afterAll(async () => {
  await cleanupUsers();
});

describe('profiles.referral_discount_pending column lockdown', () => {
  it('authed user CANNOT flip own referral_discount_pending false->true directly', async () => {
    const user = await createUser();

    const { data: before } = await admin
      .from('profiles')
      .select('referral_discount_pending')
      .eq('id', user.userId)
      .single();
    expect(before?.referral_discount_pending).toBe(false);

    await user.client.from('profiles').update({ referral_discount_pending: true }).eq('id', user.userId);

    const { data: after } = await admin
      .from('profiles')
      .select('referral_discount_pending')
      .eq('id', user.userId)
      .single();
    expect(after?.referral_discount_pending).toBe(false);
  });

  it('authed user CAN clear own referral_discount_pending true->false', async () => {
    const user = await createUser();

    const { error: seedError } = await admin
      .from('profiles')
      .update({ referral_discount_pending: true })
      .eq('id', user.userId);
    expect(seedError).toBeNull();

    const { error: clearError } = await user.client
      .from('profiles')
      .update({ referral_discount_pending: false })
      .eq('id', user.userId);
    expect(clearError).toBeNull();

    const { data: after } = await admin
      .from('profiles')
      .select('referral_discount_pending')
      .eq('id', user.userId)
      .single();
    expect(after?.referral_discount_pending).toBe(false);
  });

  it('service-role (admin client) CAN still set the flag true directly', async () => {
    const user = await createUser();

    const { error } = await admin
      .from('profiles')
      .update({ referral_discount_pending: true })
      .eq('id', user.userId);
    expect(error).toBeNull();

    const { data } = await admin
      .from('profiles')
      .select('referral_discount_pending')
      .eq('id', user.userId)
      .single();
    expect(data?.referral_discount_pending).toBe(true);
  });
});

describe('claim_signup_referral_discount() RPC', () => {
  it('returns true and sets the flag for a referred user with no bookings', async () => {
    const referrer = await createUser();
    const referred = await createUser();

    const { error: refError } = await referred.client.from('referrals').insert({
      referrer_id: referrer.userId,
      referred_id: referred.userId,
      referred_role: 'client',
      status: 'pending',
    });
    expect(refError).toBeNull();

    const { data, error } = await referred.client.rpc('claim_signup_referral_discount');
    expect(error).toBeNull();
    expect(data).toBe(true);

    const { data: profileRow } = await admin
      .from('profiles')
      .select('referral_discount_pending')
      .eq('id', referred.userId)
      .single();
    expect(profileRow?.referral_discount_pending).toBe(true);
  });

  it('returns false and leaves the flag false for a user with no referrals row', async () => {
    const user = await createUser();

    const { data, error } = await user.client.rpc('claim_signup_referral_discount');
    expect(error).toBeNull();
    expect(data).toBe(false);

    const { data: profileRow } = await admin
      .from('profiles')
      .select('referral_discount_pending')
      .eq('id', user.userId)
      .single();
    expect(profileRow?.referral_discount_pending).toBe(false);
  });

  it('returns false for a referred user who already has a bookings row as client', async () => {
    const referrer = await createUser();
    const referred = await createUser();
    const trainer = await createTrainer();

    const { error: refError } = await referred.client.from('referrals').insert({
      referrer_id: referrer.userId,
      referred_id: referred.userId,
      referred_role: 'client',
      status: 'pending',
    });
    expect(refError).toBeNull();

    const slot = await createSlot(trainer.trainerProfileId);
    await createBooking({
      slotId: slot,
      clientUserId: referred.userId,
      trainerProfileId: trainer.trainerProfileId,
    });

    const { data, error } = await referred.client.rpc('claim_signup_referral_discount');
    expect(error).toBeNull();
    expect(data).toBe(false);

    const { data: profileRow } = await admin
      .from('profiles')
      .select('referral_discount_pending')
      .eq('id', referred.userId)
      .single();
    expect(profileRow?.referral_discount_pending).toBe(false);
  });
});
