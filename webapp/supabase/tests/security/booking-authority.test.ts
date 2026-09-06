import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  admin, createTrainer, createUser, createSlot, createBooking, cleanupUsers,
  type TestTrainer, type TestUser,
} from '../helpers/testClients';

// Acceptance spec for 20260905120000_live_repair_security_pricing.sql — the
// server-authoritative booking layer. Each exploit runs through a client
// authenticated AS a real user (RLS + the freeze trigger apply), then the
// outcome is read back with the admin (service-role) client. Verified live via
// role-switched SQL on 2026-09-05 (Docker/supabase-start harness not required
// to trust the guarantees, but this pins them for CI).
//
// Requires a local stack: `supabase start` then `npm run test:db`.

let trainer: TestTrainer;
let client: TestUser;

beforeAll(async () => {
  trainer = await createTrainer();
  client = await createUser();
  // A trainer must be 'live' for _create_booking to accept a booking.
  await admin.from('trainer_profiles').update({ availability_status: 'live', optimized_rate: 50 }).eq('id', trainer.trainerProfileId);
});

afterAll(async () => { await cleanupUsers(); });

async function bookingField<T = unknown>(id: string, field: string): Promise<T> {
  const { data } = await admin.from('bookings').select(field).eq('id', id).single();
  return (data as Record<string, T>)[field];
}

describe('create_booking_atomic — server-authoritative money + identity', () => {
  it('ignores a browser-supplied inflated trainer_payout (stores the quote)', async () => {
    const slot = await createSlot(trainer.trainerProfileId);
    const { data, error } = await client.client.rpc('create_booking_atomic', {
      p_slot_id: slot, p_client_id: client.userId, p_trainer_id: trainer.trainerProfileId,
      p_rate_charged: 99999, p_platform_fee: 99999, p_trainer_payout: 99999, p_notes: null,
    });
    expect(error).toBeNull();
    const bid = (data as { booking_id?: string })?.booking_id;
    expect(bid).toBeTruthy();
    // 0% platform fee live → payout == rate == 50, never 99999.
    expect(Number(await bookingField(bid!, 'trainer_payout'))).toBe(50);
    expect(Number(await bookingField(bid!, 'trainer_payout'))).not.toBe(99999);
  });

  it('refuses to book on behalf of another user (no booking_request)', async () => {
    const victim = await createUser();
    const slot = await createSlot(trainer.trainerProfileId);
    const { error } = await client.client.rpc('create_booking_atomic', {
      p_slot_id: slot, p_client_id: victim.userId, p_trainer_id: trainer.trainerProfileId,
      p_rate_charged: 50, p_platform_fee: 0, p_trainer_payout: 50, p_notes: null,
    });
    expect(error).not.toBeNull(); // 42501
  });

  it('blocks a direct client INSERT into bookings (policy dropped)', async () => {
    const slot = await createSlot(trainer.trainerProfileId);
    const { error } = await client.client.from('bookings').insert({
      client_id: client.userId, trainer_id: trainer.trainerProfileId, slot_id: slot,
      status: 'pending', rate_charged: 1, platform_fee: 0, trainer_payout: 1,
    });
    expect(error).not.toBeNull();
  });
});

describe('bookings freeze trigger — money/identity/status locked for JWT callers', () => {
  let bookingId: string;
  beforeAll(async () => {
    const slot = await createSlot(trainer.trainerProfileId);
    bookingId = await createBooking({ slotId: slot, clientUserId: client.userId, trainerProfileId: trainer.trainerProfileId });
  });

  it('client CANNOT change rate_charged', async () => {
    const before = Number(await bookingField(bookingId, 'rate_charged'));
    await client.client.from('bookings').update({ rate_charged: 1 }).eq('id', bookingId);
    expect(Number(await bookingField(bookingId, 'rate_charged'))).toBe(before);
  });

  it('client CANNOT self-confirm via status', async () => {
    await client.client.from('bookings').update({ status: 'confirmed' }).eq('id', bookingId);
    expect(await bookingField(bookingId, 'status')).toBe('pending');
  });

  it('client CAN edit an allowed field (notes)', async () => {
    await client.client.from('bookings').update({ notes: 'ok note' }).eq('id', bookingId);
    expect(await bookingField(bookingId, 'notes')).toBe('ok note');
  });
});

describe('guarded transition + release RPCs', () => {
  it('release_pending_booking cancels a pending booking for its client, and refuses a stranger', async () => {
    const slot = await createSlot(trainer.trainerProfileId);
    const bid = await createBooking({ slotId: slot, clientUserId: client.userId, trainerProfileId: trainer.trainerProfileId });
    const stranger = await createUser();
    const s = await stranger.client.rpc('release_pending_booking', { p_booking_id: bid });
    expect(s.error).not.toBeNull();
    const o = await client.client.rpc('release_pending_booking', { p_booking_id: bid });
    expect(o.error).toBeNull();
    expect(await bookingField(bid, 'status')).toBe('cancelled');
  });

  it('mark_booking_no_show / decline_pending_booking reject a non-owning trainer', async () => {
    const other = await createTrainer();
    const slot = await createSlot(trainer.trainerProfileId);
    const bid = await createBooking({ slotId: slot, clientUserId: client.userId, trainerProfileId: trainer.trainerProfileId });
    await admin.from('bookings').update({ status: 'confirmed' }).eq('id', bid);
    expect((await other.client.rpc('mark_booking_no_show', { p_booking_id: bid })).error).not.toBeNull();
    expect((await other.client.rpc('decline_pending_booking', { p_booking_id: bid })).error).not.toBeNull();
  });
});

describe('quote_booking_price fee math', () => {
  it('computes fee-on-top at the configured pct for a non-founding-window trainer', async () => {
    // Push the trainer out of the founding window and set a 13% fee, then restore.
    const { data: prev } = await admin.from('platform_settings').select('value').eq('key', 'platform_fee_pct').single();
    await admin.from('platform_settings').update({ value: '0.13' }).eq('key', 'platform_fee_pct');
    await admin.from('trainer_profiles').update({ founding_benefit_started_at: new Date(Date.now() - 400 * 864e5).toISOString(), optimized_rate: 43 }).eq('id', trainer.trainerProfileId);
    const slot = await createSlot(trainer.trainerProfileId);
    const { data } = await admin.rpc('quote_booking_price', { p_slot_id: slot, p_client_id: client.userId, p_apply_referral: false });
    const q = Array.isArray(data) ? data[0] : data;
    expect(Number(q.platform_fee)).toBeCloseTo(5.59, 2);
    expect(Number(q.total)).toBeCloseTo(48.59, 2);
    await admin.from('platform_settings').update({ value: prev?.value ?? '0' }).eq('key', 'platform_fee_pct');
  });
});
