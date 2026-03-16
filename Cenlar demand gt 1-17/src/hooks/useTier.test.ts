import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// Mock the Zustand store before importing the hook
vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(),
}));

import { useAuthStore } from '@/stores/auth';
import { useTier, useCan } from './useTier';

const mockStore = (tier: string | null, status: string | null = null) => {
  (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    trainerProfile: tier ? { subscription_tier: tier, subscription_status: status, trial_ends_at: null } : null,
    loading: false,
  });
};

describe('useTier', () => {
  it('returns free when trainerProfile is null', () => {
    mockStore(null);
    const { result } = renderHook(() => useTier());
    expect(result.current.tier).toBe('free');
    expect(result.current.isTrialing).toBe(false);
  });
  it('returns isTrialing=true when status=trialing', () => {
    mockStore('pro', 'trialing');
    const { result } = renderHook(() => useTier());
    expect(result.current.isTrialing).toBe(true);
  });
});

describe('useCan', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('free non-trialing cannot access analytics_advanced', () => {
    mockStore('free', 'active');
    const { result } = renderHook(() => useCan('analytics_advanced'));
    expect(result.current).toBe(false);
  });
  it('trialing trainer CAN access analytics_advanced (full pro access during trial)', () => {
    mockStore('free', 'trialing');
    const { result } = renderHook(() => useCan('analytics_advanced'));
    expect(result.current).toBe(true);
  });
  it('pro trainer can access analytics_advanced', () => {
    mockStore('pro', 'active');
    const { result } = renderHook(() => useCan('analytics_advanced'));
    expect(result.current).toBe(true);
  });
  it('free cannot access extended_bio', () => {
    mockStore('free');
    const { result } = renderHook(() => useCan('extended_bio'));
    expect(result.current).toBe(false);
  });
  it('pro cannot access featured_landing', () => {
    mockStore('pro', 'active');
    const { result } = renderHook(() => useCan('featured_landing'));
    expect(result.current).toBe(false);
  });
  it('elite can access featured_landing', () => {
    mockStore('elite', 'active');
    const { result } = renderHook(() => useCan('featured_landing'));
    expect(result.current).toBe(true);
  });
});
