import { describe, it, expect, afterAll } from 'vitest';
import {
  admin, createUser, createTrainer, createSlot, createIntroSlot, createBooking, cleanupUsers,
  type TestTrainer, type TestUser,
} from '../helpers/testClients';

// Complimentary 30-min intro session DB harness (migration
// 20260910130000_complimentary_intro_sessions.sql). Two independent
// defenses are exercised: the availability_slots shape trigger (a slot can
// only be flagged is_intro if it matches free_intro_minutes and its trainer
// currently offers the complimentary intro), and the quote_booking_price /
// _create_booking guards (checked again at booking time, since a trainer can
// turn the offer off after a slot already exists). Money assertions go
// through the real RPC path (create_booking_atomic -> _create_booking ->
// quote_booking_price), never a direct bookings insert.
// Requires a local instance: `supabase start` before `npm run test:db`.

afterAll(async () => {
  await cleanupUsers();
});

async function getSetting(key: string): Promise<string> {
  const { data, error } = await admin.from('platform_settings').select('value').eq('key', key).single();
  if (error || !data) throw new Error(`getSetting(${key}) failed: ${error?.message}`);
  return data.value as string;
}

async function setSetting(key: string, value: string): Promise<void> {
  const { error } = await admin.from('platform_settings').update({ value }).eq('key', key);
  if (error) throw new Error(`setSetting(${key}) failed: ${error.message}`);
}

/** Raw create_booking_atomic call as a given client. Returns {data, error} instead of throwing. */
function bookAsClient(opts: { slotId: string; client: TestUser; trainerProfileId: string }) {
  return opts.client.client.rpc('create_booking_atomic', {
    p_slot_id: opts.slotId,
    p_client_id: opts.client.userId,
    p_trainer_id: opts.trainerProfileId,
    p_rate_charged: 0,
    p_platform_fee: 0,
    p_trainer_payout: 0,
  });
}

describe('enforce_intro_slot_shape trigger', () => {
  it('rejects an intro slot for a trainer who has not opted in', async () => {
    const trainer = await createTrainer();
    await expect(createIntroSlot(trainer.trainerProfileId)).rejects.toThrow();
  });

  it('rejects a 45-minute intro slot even for an opted-in trainer', async () => {
    const trainer = await createTrainer({ offersFreeIntro: true });
    await expect(createIntroSlot(trainer.trainerProfileId, 45)).rejects.toThrow();
  });

  it('accepts a 30-minute intro slot for an opted-in trainer', async () => {
    const trainer = await createTrainer({ offersFreeIntro: true });
    await expect(createIntroSlot(trainer.trainerProfileId)).resolves.toBeTypeOf('string');
  });
});

describe('quote_booking_price: trainer must currently offer the complimentary intro', () => {
  it('rejects a booking once the trainer has since turned the offer off', async () => {
    const trainer = await createTrainer({ offersFreeIntro: true });
    const client = await createUser();
    const slotId = await createIntroSlot(trainer.trainerProfileId);

    await admin.from('trainer_profiles').update({ offers_free_intro: false }).eq('id', trainer.trainerProfileId);

    const { error } = await bookAsClient({ slotId, client, trainerProfileId: trainer.trainerProfileId });
    expect(error).not.toBeNull();
    expect(error?.message).toContain('not currently offering');
  });
});

describe('quote_booking_price: free_intro_until window', () => {
  it('rejects a booking once free_intro_until has passed', async () => {
    const original = await getSetting('free_intro_until');
    try {
      await setSetting('free_intro_until', '2020-01-01');
      const trainer = await createTrainer({ offersFreeIntro: true });
      const client = await createUser();
      const slotId = await createIntroSlot(trainer.trainerProfileId);

      const { error } = await bookAsClient({ slotId, client, trainerProfileId: trainer.trainerProfileId });
      expect(error).not.toBeNull();
      expect(error?.message).toContain('no longer available');
    } finally {
      await setSetting('free_intro_until', original);
    }
  });
});

describe('quote_booking_price: one complimentary intro per (client, trainer)', () => {
  it('rejects a second intro booking with the same trainer', async () => {
    const trainer = await createTrainer({ offersFreeIntro: true });
    const client = await createUser();

    const slot1 = await createIntroSlot(trainer.trainerProfileId);
    await createBooking({ slotId: slot1, clientUserId: client.userId, trainerProfileId: trainer.trainerProfileId, as: client.client });

    const slot2 = await createIntroSlot(trainer.trainerProfileId);
    const { error } = await bookAsClient({ slotId: slot2, client, trainerProfileId: trainer.trainerProfileId });
    expect(error).not.toBeNull();
    expect(error?.message).toContain('already used your complimentary intro');
  });
});

describe('quote_booking_price: free_intro_max_per_client total cap', () => {
  it('rejects a third intro booking once the client has used the cap (2) across different trainers', async () => {
    await setSetting('free_intro_max_per_client', '2');
    const client = await createUser();
    const trainerA = await createTrainer({ offersFreeIntro: true });
    const trainerB = await createTrainer({ offersFreeIntro: true });
    const trainerC = await createTrainer({ offersFreeIntro: true });

    const slotA = await createIntroSlot(trainerA.trainerProfileId);
    await createBooking({ slotId: slotA, clientUserId: client.userId, trainerProfileId: trainerA.trainerProfileId, as: client.client });

    const slotB = await createIntroSlot(trainerB.trainerProfileId);
    await createBooking({ slotId: slotB, clientUserId: client.userId, trainerProfileId: trainerB.trainerProfileId, as: client.client });

    const slotC = await createIntroSlot(trainerC.trainerProfileId);
    const { error } = await bookAsClient({ slotId: slotC, client, trainerProfileId: trainerC.trainerProfileId });
    expect(error).not.toBeNull();
    expect(error?.message).toContain('reached the limit');
  });
});

describe('happy path: complimentary intro booking', () => {
  it('is confirmed, zero-cost, is_comp + is_intro, and settles as a $0 payment with no payout row', async () => {
    const trainer = await createTrainer({ offersFreeIntro: true });
    const client = await createUser();
    const slotId = await createIntroSlot(trainer.trainerProfileId);

    const bookingId = await createBooking({
      slotId, clientUserId: client.userId, trainerProfileId: trainer.trainerProfileId, as: client.client,
    });

    const { data: booking } = await admin
      .from('bookings')
      .select('status, rate_charged, platform_fee, trainer_payout, is_comp, is_intro')
      .eq('id', bookingId)
      .single();
    expect(booking?.status).toBe('confirmed');
    expect(Number(booking?.rate_charged)).toBe(0);
    expect(Number(booking?.platform_fee)).toBe(0);
    expect(Number(booking?.trainer_payout)).toBe(0);
    expect(booking?.is_comp).toBe(true);
    expect(booking?.is_intro).toBe(true);

    await admin.from('bookings').update({ status: 'completed' }).eq('id', bookingId);

    const { data: payment } = await admin
      .from('payments')
      .select('amount, platform_fee, trainer_payout, status, is_comp, payout_transaction_id')
      .eq('booking_id', bookingId)
      .single();
    expect(Number(payment?.amount)).toBe(0);
    expect(Number(payment?.platform_fee)).toBe(0);
    expect(Number(payment?.trainer_payout)).toBe(0);
    expect(payment?.status).toBe('succeeded');
    expect(payment?.is_comp).toBe(true);
    expect(payment?.payout_transaction_id).toBeNull();
  });
});

describe('non-intro booking pricing is unaffected', () => {
  it('a normal slot still charges the trainer optimized_rate and is not marked comp/intro', async () => {
    const trainer = await createTrainer();
    const client = await createUser();
    const slotId = await createSlot(trainer.trainerProfileId);

    const bookingId = await createBooking({
      slotId, clientUserId: client.userId, trainerProfileId: trainer.trainerProfileId, as: client.client,
    });

    const { data } = await admin
      .from('bookings')
      .select('rate_charged, is_intro, is_comp')
      .eq('id', bookingId)
      .single();
    expect(Number(data?.rate_charged)).toBe(50);
    expect(data?.is_intro).toBe(false);
    expect(data?.is_comp).toBe(false);
  });
});

describe('offers_free_intro stays behind the existing per-row RLS ownership policy', () => {
  it('a different trainer cannot flip offers_free_intro on someone else\'s row', async () => {
    const trainerA = await createTrainer({ offersFreeIntro: false });
    const trainerB = await createTrainer({ offersFreeIntro: false });

    await trainerB.client
      .from('trainer_profiles')
      .update({ offers_free_intro: true })
      .eq('id', trainerA.trainerProfileId);

    const { data } = await admin
      .from('trainer_profiles')
      .select('offers_free_intro')
      .eq('id', trainerA.trainerProfileId)
      .single();
    expect(data?.offers_free_intro).toBe(false);
  });

  it('a client (non-trainer) cannot set offers_free_intro on a trainer row', async () => {
    const trainer = await createTrainer({ offersFreeIntro: false });
    const client = await createUser();

    await client.client
      .from('trainer_profiles')
      .update({ offers_free_intro: true })
      .eq('id', trainer.trainerProfileId);

    const { data } = await admin
      .from('trainer_profiles')
      .select('offers_free_intro')
      .eq('id', trainer.trainerProfileId)
      .single();
    expect(data?.offers_free_intro).toBe(false);
  });
});

describe('admin_set_offers_free_intro', () => {
  it('rejects a non-admin caller and makes no change', async () => {
    const trainer = await createTrainer({ offersFreeIntro: false });
    const other = await createUser();

    const { error } = await other.client.rpc('admin_set_offers_free_intro', {
      p_user_ids: [trainer.userId],
      p_enabled: true,
    });
    expect(error).not.toBeNull();

    const { data } = await admin
      .from('trainer_profiles')
      .select('offers_free_intro')
      .eq('id', trainer.trainerProfileId)
      .single();
    expect(data?.offers_free_intro).toBe(false);
  });

  it('lets an admin bulk-enable the offer for multiple trainers and returns the row count', async () => {
    const trainerA = await createTrainer({ offersFreeIntro: false });
    const trainerB = await createTrainer({ offersFreeIntro: false });
    const adminUser = await createUser();
    await admin.from('profiles').update({ role: 'admin' }).eq('id', adminUser.userId);

    const { data: updatedCount, error } = await adminUser.client.rpc('admin_set_offers_free_intro', {
      p_user_ids: [trainerA.userId, trainerB.userId],
      p_enabled: true,
    });
    expect(error).toBeNull();
    expect(updatedCount).toBe(2);

    const { data } = await admin
      .from('trainer_profiles')
      .select('id, offers_free_intro')
      .in('id', [trainerA.trainerProfileId, trainerB.trainerProfileId]);
    expect(data?.every((r) => r.offers_free_intro)).toBe(true);
  });
});

describe('concurrency: per-client cap enforced under a race (advisory lock)', () => {
  it('two simultaneous intro bookings for one client at two different trainers, cap 1, leaves exactly one booking', async () => {
    const original = await getSetting('free_intro_max_per_client');
    try {
      await setSetting('free_intro_max_per_client', '1');

      const client = await createUser();
      const trainerA = await createTrainer({ offersFreeIntro: true });
      const trainerB = await createTrainer({ offersFreeIntro: true });
      const slotA = await createIntroSlot(trainerA.trainerProfileId);
      const slotB = await createIntroSlot(trainerB.trainerProfileId);

      const [resA, resB] = await Promise.all([
        bookAsClient({ slotId: slotA, client, trainerProfileId: trainerA.trainerProfileId }),
        bookAsClient({ slotId: slotB, client, trainerProfileId: trainerB.trainerProfileId }),
      ]);

      const succeeded = [resA, resB].filter((r) => !r.error);
      const failed = [resA, resB].filter((r) => r.error);
      expect(succeeded).toHaveLength(1);
      expect(failed).toHaveLength(1);
      expect(failed[0]?.error?.message).toContain('reached the limit');

      const { data: introBookings } = await admin
        .from('bookings')
        .select('id')
        .eq('client_id', client.userId)
        .eq('is_intro', true);
      expect(introBookings?.length ?? 0).toBe(1);
    } finally {
      await setSetting('free_intro_max_per_client', original);
    }
  });
});
