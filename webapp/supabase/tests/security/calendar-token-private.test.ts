import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { admin, createTrainer, createUser, cleanupUsers, type TestTrainer } from '../helpers/testClients';

// Acceptance spec for the calendar-token → private-storage move
// (20260905120000_live_repair_security_pricing.sql). The bearer token used by
// the public calendar-export feed URL must be readable ONLY by its owner.
// Requires a local stack: `supabase start` then `npm run test:db`.

let trainer: TestTrainer;
beforeAll(async () => { trainer = await createTrainer(); });
afterAll(async () => { await cleanupUsers(); });

describe('calendar_export_token privacy', () => {
  it('another authenticated user cannot read the token from trainer_private_details', async () => {
    // Mint the owner's token first.
    await trainer.client.rpc('get_calendar_export_token');
    const other = await createUser();
    const { data } = await other.client
      .from('trainer_private_details')
      .select('calendar_export_token')
      .eq('user_id', trainer.userId);
    expect(data ?? []).toHaveLength(0); // owner-only RLS
  });

  it('the owner reads a stable, non-null token via the RPC', async () => {
    const first = await trainer.client.rpc('get_calendar_export_token');
    expect(first.error).toBeNull();
    expect(typeof first.data).toBe('string');
    const second = await trainer.client.rpc('get_calendar_export_token');
    expect(second.data).toBe(first.data); // idempotent, does not re-mint
  });

  it('reset_calendar_export_token rotates to a new value the owner can read back', async () => {
    const before = (await trainer.client.rpc('get_calendar_export_token')).data;
    const reset = await trainer.client.rpc('reset_calendar_export_token');
    expect(reset.error).toBeNull();
    expect(reset.data).not.toBe(before);
    const after = (await trainer.client.rpc('get_calendar_export_token')).data;
    expect(after).toBe(reset.data);
  });
});
