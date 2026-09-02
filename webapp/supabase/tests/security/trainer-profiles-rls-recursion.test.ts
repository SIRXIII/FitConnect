import { describe, it, expect, afterAll } from 'vitest';
import { admin, createUser, createTrainer, createSlot, createBooking, cleanupUsers } from '../helpers/testClients';

// Migration 20260902010000 made the trainer_profiles SELECT policy subquery
// public.bookings, whose own SELECT policy subqueries trainer_profiles -> Postgres
// 42P17 "infinite recursion detected in policy" for every authenticated user.
// Migration 20260902120000_fix_trainer_profiles_select_rls_recursion.sql fixes it
// by routing the "client already booked this trainer" branch through a
// SECURITY DEFINER predicate public.client_has_booking_with_trainer(uuid).
//
// These tests are the acceptance spec: RED on 20260902010000, GREEN on
// 20260902120000. Requires a local instance: `supabase start` before `npm run test:db`.

afterAll(cleanupUsers);

describe('trainer_profiles is readable by authenticated users (no RLS recursion)', () => {
  it('a plain authenticated user can read trainer_profiles', async () => {
    const user = await createUser();
    const { data, error } = await user.client.from('trainer_profiles').select('id').limit(1);
    expect(error?.code).not.toBe('42P17');
    expect(error).toBeNull();
    expect(data).not.toBeNull();
  });

  it('a trainer can read their own row regardless of approval_status', async () => {
    const trainer = await createTrainer();
    const { data, error } = await trainer.client
      .from('trainer_profiles')
      .select('id')
      .eq('user_id', trainer.userId)
      .maybeSingle();
    expect(error?.code).not.toBe('42P17');
    expect(error).toBeNull();
    expect(data?.id).toBe(trainer.trainerProfileId);
  });
});

describe('client who already booked a trainer keeps seeing them after suspension (escape hatch preserved)', () => {
  it('booked client still sees the suspended trainer; an unrelated stranger does not', async () => {
    const trainer = await createTrainer();
    const client = await createUser();
    const slotId = await createSlot(trainer.trainerProfileId);
    await createBooking({
      slotId,
      clientUserId: client.userId,
      trainerProfileId: trainer.trainerProfileId,
    });

    // Suspend the trainer, which hides them from the "public" branch of the
    // policy. approval_status of the fixture row is whatever the default is —
    // do NOT rely on the public branch here; only the booking escape hatch.
    const { error: suspendErr } = await admin
      .from('profiles')
      .update({ is_suspended: true })
      .eq('id', trainer.userId);
    expect(suspendErr).toBeNull();

    const { data: seen, error: seenErr } = await client.client
      .from('trainer_profiles')
      .select('id')
      .eq('id', trainer.trainerProfileId)
      .maybeSingle();
    expect(seenErr?.code).not.toBe('42P17');
    expect(seenErr).toBeNull();
    expect(seen?.id).toBe(trainer.trainerProfileId);

    const stranger = await createUser();
    const { data: hidden, error: hiddenErr } = await stranger.client
      .from('trainer_profiles')
      .select('id')
      .eq('id', trainer.trainerProfileId)
      .maybeSingle();
    expect(hiddenErr?.code).not.toBe('42P17');
    expect(hiddenErr).toBeNull();
    expect(hidden).toBeNull();
  });
});
