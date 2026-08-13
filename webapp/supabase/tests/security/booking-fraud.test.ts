import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  admin, createTrainer, createUser, createSlot, createBooking, cleanupUsers,
  type TestTrainer, type TestUser,
} from '../helpers/testClients';

// Booking fraud-chain acceptance spec. Each exploit is attempted AS the trainer
// (RLS + column grants apply), then read back via admin to assert it did NOT take
// effect. RED = open hole; goes green when the bookings column-lockdown lands.
//
// The linchpin: only the webhook/server should set bookings.status='confirmed'/
// 'completed', and money columns must never be client-writable.

let trainer: TestTrainer;
let client: TestUser;
let bookingId: string;

beforeAll(async () => {
  trainer = await createTrainer();
  client = await createUser();
  const slot = await createSlot(trainer.trainerProfileId);
  // A normal pending booking, created via admin (fixture).
  bookingId = await createBooking({
    slotId: slot,
    clientUserId: client.userId,
    trainerProfileId: trainer.trainerProfileId,
  });
});

afterAll(async () => {
  await cleanupUsers();
});

async function bookingField<T = unknown>(field: string): Promise<T> {
  const { data } = await admin.from('bookings').select(field).eq('id', bookingId).single();
  return (data as Record<string, T>)[field];
}

describe('bookings status/money lockdown (acceptance spec — RED until the migration lands)', () => {
  it('trainer CANNOT self-confirm a pending booking (status stays pending)', async () => {
    await trainer.client.from('bookings').update({ status: 'confirmed' }).eq('id', bookingId);
    expect(await bookingField('status')).toBe('pending');
  });

  it('trainer CANNOT self-complete a booking (status stays pending)', async () => {
    await trainer.client.from('bookings').update({ status: 'completed' }).eq('id', bookingId);
    expect(await bookingField('status')).toBe('pending');
  });

  it('trainer CANNOT edit a booking money column (trainer_payout unchanged)', async () => {
    const before = await bookingField<number | string>('trainer_payout');
    await trainer.client.from('bookings').update({ trainer_payout: 9999 }).eq('id', bookingId);
    const after = await bookingField<number | string>('trainer_payout');
    expect(Number(after)).toBe(Number(before));
    expect(Number(after)).not.toBe(9999);
  });
});

describe('create_booking_atomic money args (entrance — requires server rewrite, RED-deferred)', () => {
  it('a client-supplied inflated trainer_payout must NOT be stored verbatim', async () => {
    const slot = await createSlot(trainer.trainerProfileId);
    const id = await createBooking({
      slotId: slot,
      clientUserId: client.userId,
      trainerProfileId: trainer.trainerProfileId,
      rate: 50,
      fee: 0,
      payout: 9999, // browser-supplied inflation
      as: client.client,
    });
    const { data } = await admin.from('bookings').select('trainer_payout').eq('id', id).single();
    // Secure spec: the server computes payout from the trainer's rate, so 9999 is impossible.
    // This stays RED until create_booking_atomic is made server-authoritative (deferred).
    expect(Number(data?.trainer_payout)).not.toBe(9999);
  });
});

describe('guarded transition RPCs (replace the webapp direct writes; work despite the lockdown)', () => {
  it('trainer CAN no_show their own confirmed booking via mark_booking_no_show', async () => {
    const slot = await createSlot(trainer.trainerProfileId);
    const id = await createBooking({ slotId: slot, clientUserId: client.userId, trainerProfileId: trainer.trainerProfileId });
    await admin.from('bookings').update({ status: 'confirmed' }).eq('id', id); // simulate webhook confirm
    const { error } = await trainer.client.rpc('mark_booking_no_show', { p_booking_id: id });
    expect(error).toBeNull();
    const { data } = await admin.from('bookings').select('status').eq('id', id).single();
    expect(data?.status).toBe('no_show');
  });

  it("a DIFFERENT trainer CANNOT no_show someone else's booking", async () => {
    const other = await createTrainer();
    const slot = await createSlot(trainer.trainerProfileId);
    const id = await createBooking({ slotId: slot, clientUserId: client.userId, trainerProfileId: trainer.trainerProfileId });
    await admin.from('bookings').update({ status: 'confirmed' }).eq('id', id);
    const { error } = await other.client.rpc('mark_booking_no_show', { p_booking_id: id });
    expect(error).not.toBeNull(); // 'not your booking'
    const { data } = await admin.from('bookings').select('status').eq('id', id).single();
    expect(data?.status).toBe('confirmed'); // unchanged
  });

  it('trainer CAN decline their own pending booking via decline_pending_booking', async () => {
    const slot = await createSlot(trainer.trainerProfileId);
    const id = await createBooking({ slotId: slot, clientUserId: client.userId, trainerProfileId: trainer.trainerProfileId });
    const { error } = await trainer.client.rpc('decline_pending_booking', { p_booking_id: id });
    expect(error).toBeNull();
    const { data } = await admin.from('bookings').select('status').eq('id', id).single();
    expect(data?.status).toBe('cancelled');
  });
});
