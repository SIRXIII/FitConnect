import { describe, it, expect, afterAll } from 'vitest';
import { admin, createUser, cleanupUsers } from '../helpers/testClients';

// Referral give-side DB harness. Mirrors the self-attribution writes RoleSelect
// performs on signup: the referred user inserts their own referrals row, then
// sets their own referral_discount_pending flag. Both are attempted through a
// client authenticated AS the referred user (RLS applies), then verified via
// the admin client.
// Requires a local instance: `supabase start` before `npm run test:db`.

afterAll(async () => {
  await cleanupUsers();
});

describe('referral self-attribution (mirrors RoleSelect give-side writes)', () => {
  it('a referred user can insert their own referrals row and set their own discount flag', async () => {
    const referrer = await createUser();
    const referred = await createUser();

    const { error: insertError } = await referred.client.from('referrals').insert({
      referrer_id: referrer.userId,
      referred_id: referred.userId,
      referred_role: 'client',
      status: 'pending',
    });
    expect(insertError).toBeNull();

    const { data: referralRow } = await admin
      .from('referrals')
      .select('referrer_id, referred_id, status')
      .eq('referrer_id', referrer.userId)
      .eq('referred_id', referred.userId)
      .single();
    expect(referralRow?.referrer_id).toBe(referrer.userId);
    expect(referralRow?.referred_id).toBe(referred.userId);
    expect(referralRow?.status).toBe('pending');

    const { error: updateError } = await referred.client
      .from('profiles')
      .update({ referral_discount_pending: true })
      .eq('id', referred.userId);
    expect(updateError).toBeNull();

    const { data: profileRow } = await admin
      .from('profiles')
      .select('referral_discount_pending')
      .eq('id', referred.userId)
      .single();
    expect(profileRow?.referral_discount_pending).toBe(true);
  });
});

describe('referrals_no_self_referral CHECK constraint', () => {
  it('rejects a row where referrer_id === referred_id', async () => {
    const user = await createUser();

    const { error } = await admin.from('referrals').insert({
      referrer_id: user.userId,
      referred_id: user.userId,
      referred_role: 'client',
      status: 'pending',
    });
    expect(error).not.toBeNull();

    const { data } = await admin
      .from('referrals')
      .select('id')
      .eq('referrer_id', user.userId)
      .eq('referred_id', user.userId);
    expect(data?.length ?? 0).toBe(0);
  });
});
