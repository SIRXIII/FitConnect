import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// ─── Hoist mock variables ─────────────────────────────────────────────────────
const { mockFromFn } = vi.hoisted(() => ({
  mockFromFn: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { from: mockFromFn },
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ user: { id: 'user-123' } }),
}));

// ─── Import subject under test after mocks ───────────────────────────────────
import { useNotificationPreferences } from './useNotificationPreferences';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** A universal chain supporting all query patterns the hook uses. */
function makeChain(opts: {
  selectData?: unknown[];
  upsertFn?: ReturnType<typeof vi.fn>;
  updateFn?: ReturnType<typeof vi.fn>;
} = {}) {
  const { selectData = [], upsertFn, updateFn } = opts;
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.limit = vi.fn(() => Promise.resolve({ data: selectData, error: null }));
  chain.upsert = upsertFn ?? vi.fn(() => Promise.resolve({ data: null, error: null }));
  chain.update = updateFn ?? vi.fn(() => chain);
  return chain;
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('useNotificationPreferences', () => {
  beforeEach(() => {
    mockFromFn.mockReset();
  });

  it('Test 1: fetchPreferences returns null when no preferences exist for user', async () => {
    mockFromFn.mockReturnValue(makeChain());

    const { result } = renderHook(() => useNotificationPreferences());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.preferences).toBeNull();
  });

  it('Test 2: savePreferences calls supabase upsert with correct fields', async () => {
    const upsertFn = vi.fn(() => Promise.resolve({ data: null, error: null }));
    // Single universal chain handles both fetch (select/eq/limit) and upsert
    mockFromFn.mockReturnValue(makeChain({ upsertFn }));

    const { result } = renderHook(() => useNotificationPreferences());

    await waitFor(() => expect(result.current.loading).toBe(false));

    await result.current.savePreferences({
      area_label: 'Downtown NYC',
      area_lat: 40.7128,
      area_lng: -74.006,
      notif_radius_miles: 5,
      notif_enabled: true,
    });

    expect(upsertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-123',
        area_label: 'Downtown NYC',
        area_lat: 40.7128,
        area_lng: -74.006,
        notif_radius_miles: 5,
        notif_enabled: true,
      }),
      expect.objectContaining({ onConflict: 'user_id' })
    );
  });

  it('Test 3: toggleEnabled flips notif_enabled boolean via supabase update', async () => {
    const updateFn = vi.fn(() => makeChain()); // update returns chain with .eq
    mockFromFn.mockReturnValue(makeChain({ updateFn }));

    const { result } = renderHook(() => useNotificationPreferences());

    await waitFor(() => expect(result.current.loading).toBe(false));

    await result.current.toggleEnabled(true);

    expect(updateFn).toHaveBeenCalledWith({ notif_enabled: true });
  });

  it('Test 4: isConfigured returns false when area_lat or area_lng is null', async () => {
    const prefData = [{
      id: 'pref-1', user_id: 'user-123', notif_enabled: true,
      area_label: 'NYC', area_lat: null, area_lng: -74.006,
      notif_radius_miles: 5,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }];
    mockFromFn.mockReturnValue(makeChain({ selectData: prefData }));

    const { result } = renderHook(() => useNotificationPreferences());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.isConfigured).toBe(false);
  });

  it('Test 5: isConfigured returns true when area_lat AND area_lng AND notif_enabled are set', async () => {
    const prefData = [{
      id: 'pref-1', user_id: 'user-123', notif_enabled: true,
      area_label: 'NYC', area_lat: 40.7128, area_lng: -74.006,
      notif_radius_miles: 5,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }];
    mockFromFn.mockReturnValue(makeChain({ selectData: prefData }));

    const { result } = renderHook(() => useNotificationPreferences());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.isConfigured).toBe(true);
  });
});
