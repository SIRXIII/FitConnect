import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { admin, createTrainer, createUser, cleanupUsers, type TestTrainer } from '../helpers/testClients';

// Adversarial DB harness. Each exploit is attempted through a client authenticated
// AS a real user (RLS + column grants apply), then the outcome is read back with
// the admin client to assert the malicious change did NOT take effect.
//
// Reds here are OPEN HOLES, not flakes: the trainer_profiles column-lockdown
// migration is not applied yet, so the self-verify / un-freeze / re-own tests
// FAIL until it lands. They ARE the acceptance spec for that migration.
// Requires a local instance: `supabase start` before `npm run test:db`.

afterAll(async () => {
  await cleanupUsers();
});

describe('payments is service-role only (already enforced)', () => {
  it('an authenticated user cannot INSERT a payments row', async () => {
    const user = await createUser();
    const { error } = await user.client.from('payments').insert({
      booking_id: randomUUID(),
      client_id: user.userId,
      amount: 10,
      platform_fee: 0,
      trainer_payout: 10,
      status: 'succeeded',
    });
    // RLS has no INSERT policy for `authenticated`, so the write must be rejected.
    expect(error).not.toBeNull();
  });
});

describe('trainer_profiles column lockdown (acceptance spec — RED until the migration lands)', () => {
  let trainer: TestTrainer;

  beforeAll(async () => {
    trainer = await createTrainer();
  });

  it('trainer CANNOT self-verify (is_verified stays false)', async () => {
    // Establish the honest baseline via admin, then attempt the exploit as the trainer.
    await admin.from('trainer_profiles').update({ is_verified: false }).eq('id', trainer.trainerProfileId);

    await trainer.client
      .from('trainer_profiles')
      .update({ is_verified: true })
      .eq('user_id', trainer.userId);

    const { data } = await admin
      .from('trainer_profiles')
      .select('is_verified')
      .eq('id', trainer.trainerProfileId)
      .single();
    expect(data?.is_verified).toBe(false);
  });

  it('trainer CANNOT un-freeze their own payouts (payout_on_hold stays true)', async () => {
    await admin.from('trainer_profiles').update({ payout_on_hold: true }).eq('id', trainer.trainerProfileId);

    await trainer.client
      .from('trainer_profiles')
      .update({ payout_on_hold: false })
      .eq('user_id', trainer.userId);

    const { data } = await admin
      .from('trainer_profiles')
      .select('payout_on_hold')
      .eq('id', trainer.trainerProfileId)
      .single();
    expect(data?.payout_on_hold).toBe(true);
  });

  it('trainer CANNOT re-own their row (user_id cannot be reassigned to another user)', async () => {
    const other = await createUser();

    await trainer.client
      .from('trainer_profiles')
      .update({ user_id: other.userId })
      .eq('user_id', trainer.userId);

    const { data } = await admin
      .from('trainer_profiles')
      .select('user_id')
      .eq('id', trainer.trainerProfileId)
      .single();
    expect(data?.user_id).toBe(trainer.userId);
  });

  it('trainer CAN still edit an allowlisted field (location) — the lockdown must not over-block', async () => {
    const { error } = await trainer.client
      .from('trainer_profiles')
      .update({ location: 'Updated City' })
      .eq('user_id', trainer.userId);
    expect(error).toBeNull();

    const { data } = await admin
      .from('trainer_profiles')
      .select('location')
      .eq('id', trainer.trainerProfileId)
      .single();
    expect(data?.location).toBe('Updated City');
  });
});
