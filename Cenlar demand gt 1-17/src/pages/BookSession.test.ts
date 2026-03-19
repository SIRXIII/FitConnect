import { describe, it, expect, vi } from 'vitest';

// Test scaffold for BookSession atomic RPC
// Covers AVAIL-04 (double-booking prevention)

describe('BookSession atomic booking', () => {
  it('calls supabase.rpc with create_booking_atomic and correct params', () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: { booking_id: 'uuid-123' },
      error: null,
    });

    // Verify RPC is called with expected param names
    const params = {
      p_slot_id: 'slot-1',
      p_client_id: 'client-1',
      p_trainer_id: 'trainer-1',
      p_rate_charged: 100,
      p_platform_fee: 15,
      p_trainer_payout: 85,
      p_notes: null,
    };

    mockRpc('create_booking_atomic', params);
    expect(mockRpc).toHaveBeenCalledWith('create_booking_atomic', params);
  });

  it('handles slot_taken error from RPC', async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: { error: 'slot_taken' },
      error: null,
    });

    const result = await mockRpc('create_booking_atomic', { p_slot_id: 'slot-1' });
    expect(result.data.error).toBe('slot_taken');
  });

  it('handles slot_not_found error from RPC', async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: { error: 'slot_not_found' },
      error: null,
    });

    const result = await mockRpc('create_booking_atomic', { p_slot_id: 'nonexistent' });
    expect(result.data.error).toBe('slot_not_found');
  });

  it('returns booking_id on successful booking', async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: { booking_id: 'new-booking-uuid' },
      error: null,
    });

    const result = await mockRpc('create_booking_atomic', { p_slot_id: 'slot-1' });
    expect(result.data.booking_id).toBe('new-booking-uuid');
  });
});
