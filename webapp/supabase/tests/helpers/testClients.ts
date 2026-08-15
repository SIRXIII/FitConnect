// Test clients for the local Supabase adversarial harness.
//
// Talks ONLY to a local `supabase start` instance (127.0.0.1:54321) — never prod.
// The keys below are the standard, public local-dev demo keys (they only work
// against the default local JWT secret); override via env if your local differs.
//
// createUser()  -> a plain authenticated user (its client carries the user's JWT,
//                  so RLS + column grants apply exactly as they would in prod).
// createTrainer -> an authenticated user with a trainer_profiles row, so we can
//                  attempt the "trainer edits their own row" exploits.
// The admin client uses the service_role key (bypasses RLS) only for fixture setup
// and teardown — never for the exploit assertions themselves.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

export const LOCAL_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const ANON_KEY = process.env.SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

export const admin: SupabaseClient = createClient(LOCAL_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const createdUserIds: string[] = [];

export interface TestUser {
  userId: string;
  email: string;
  /** A client authenticated AS this user — RLS + grants apply. */
  client: SupabaseClient;
}

export interface TestTrainer extends TestUser {
  trainerProfileId: string;
}

async function newAuthedUser(): Promise<TestUser> {
  const email = `sec-test-${randomUUID()}@example.test`;
  const password = `pw-${randomUUID()}`;

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr || !created.user) {
    throw new Error(`createUser failed: ${createErr?.message ?? 'no user'}`);
  }
  const userId = created.user.id;
  createdUserIds.push(userId);

  // A fresh anon client, then sign in so every request carries this user's JWT.
  const client = createClient(LOCAL_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password });
  if (signInErr) throw new Error(`signIn failed: ${signInErr.message}`);

  return { userId, email, client };
}

export async function createUser(): Promise<TestUser> {
  return newAuthedUser();
}

export async function createTrainer(): Promise<TestTrainer> {
  const user = await newAuthedUser();
  // Fixture only — inserted via service role (bypasses RLS). The exploit tests
  // then act through `user.client`, which does NOT bypass RLS.
  const { data: tp, error } = await admin
    .from('trainer_profiles')
    .insert({
      user_id: user.userId,
      specialty: 'strength_training',
      hourly_rate: 50,
      optimized_rate: 50,
      location: 'Test City',
      availability_status: 'live', // create_booking_atomic requires the trainer be 'live'
    })
    .select('id')
    .single();
  if (error || !tp) throw new Error(`createTrainer profile insert failed: ${error?.message}`);
  return { ...user, trainerProfileId: tp.id as string };
}

let slotSeq = 0;

/** Fixture: a bookable slot for a trainer (start in the past so completion guards pass). */
export async function createSlot(trainerProfileId: string): Promise<string> {
  // Each slot gets a distinct past window so multiple slots don't trip the
  // no_overlap exclusion constraint.
  const n = ++slotSeq;
  const start = new Date(Date.now() - (n + 1) * 3600_000).toISOString();
  const end = new Date(Date.now() - (n + 0.5) * 3600_000).toISOString();
  const { data, error } = await admin
    .from('availability_slots')
    .insert({ trainer_id: trainerProfileId, start_time: start, end_time: end })
    .select('id')
    .single();
  if (error || !data) throw new Error(`createSlot failed: ${error?.message}`);
  return data.id as string;
}

/**
 * Create a booking via the create_booking_atomic RPC. Pass `as` to choose the
 * caller: the admin (fixture setup) or a specific user's client (to exercise the
 * browser-supplied money-args exploit). Returns the new booking id.
 */
export async function createBooking(opts: {
  slotId: string;
  clientUserId: string;
  trainerProfileId: string;
  rate?: number;
  fee?: number;
  payout?: number;
  as?: SupabaseClient;
}): Promise<string> {
  const rate = opts.rate ?? 50;
  const fee = opts.fee ?? 6.5;
  const payout = opts.payout ?? 43.5;
  const caller = opts.as ?? admin;
  const { data, error } = await caller.rpc('create_booking_atomic', {
    p_slot_id: opts.slotId,
    p_client_id: opts.clientUserId,
    p_trainer_id: opts.trainerProfileId,
    p_rate_charged: rate,
    p_platform_fee: fee,
    p_trainer_payout: payout,
    p_notes: null,
  });
  if (error) throw new Error(`create_booking_atomic failed: ${error.message}`);
  const result = data as { booking_id?: string; error?: string } | null;
  if (!result?.booking_id) throw new Error(`create_booking_atomic returned no id: ${JSON.stringify(result)}`);
  return result.booking_id;
}

/** Delete every user created during the run (cascades to their rows). */
export async function cleanupUsers(): Promise<void> {
  for (const id of createdUserIds.splice(0)) {
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
}
