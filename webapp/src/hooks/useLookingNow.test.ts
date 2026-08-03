import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLookingNow } from './useLookingNow';

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('useLookingNow', () => {
  const mockGeolocation = {
    getCurrentPosition: vi.fn(),
    watchPosition: vi.fn(),
    clearWatch: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(global.navigator, 'geolocation', {
      value: mockGeolocation,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Test 1: isActive starts as false, livePosition starts as null', () => {
    const { result } = renderHook(() => useLookingNow());

    expect(result.current.isActive).toBe(false);
    expect(result.current.livePosition).toBeNull();
  });

  it('Test 2: activate calls navigator.geolocation.getCurrentPosition and sets livePosition', async () => {
    mockGeolocation.getCurrentPosition.mockImplementation((successCb) => {
      successCb({ coords: { latitude: 40.7128, longitude: -74.006 } });
    });

    const { result } = renderHook(() => useLookingNow());

    await act(async () => {
      result.current.activate();
    });

    expect(mockGeolocation.getCurrentPosition).toHaveBeenCalledOnce();
    expect(result.current.livePosition).toEqual({ lat: 40.7128, lng: -74.006 });
    expect(result.current.isActive).toBe(true);
  });

  it('Test 3: activate sets 2-hour auto-disable timer', async () => {
    vi.useFakeTimers();

    mockGeolocation.getCurrentPosition.mockImplementation((successCb) => {
      successCb({ coords: { latitude: 40.7128, longitude: -74.006 } });
    });

    const { result } = renderHook(() => useLookingNow());

    await act(async () => {
      result.current.activate();
    });

    expect(result.current.isActive).toBe(true);

    // Advance 2 hours
    await act(async () => {
      vi.advanceTimersByTime(2 * 60 * 60 * 1000);
    });

    expect(result.current.isActive).toBe(false);
    expect(result.current.livePosition).toBeNull();
  });

  it('Test 4: deactivate clears timer and resets state', async () => {
    vi.useFakeTimers();

    mockGeolocation.getCurrentPosition.mockImplementation((successCb) => {
      successCb({ coords: { latitude: 40.7128, longitude: -74.006 } });
    });

    const { result } = renderHook(() => useLookingNow());

    await act(async () => {
      result.current.activate();
    });

    expect(result.current.isActive).toBe(true);

    await act(async () => {
      result.current.deactivate();
    });

    expect(result.current.isActive).toBe(false);
    expect(result.current.livePosition).toBeNull();

    // Timer should be cleared — advancing 2 hours should not re-trigger anything
    await act(async () => {
      vi.advanceTimersByTime(2 * 60 * 60 * 1000);
    });

    expect(result.current.isActive).toBe(false);
  });

  it('Test 5: cleanup on unmount clears the timeout', async () => {
    vi.useFakeTimers();
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

    mockGeolocation.getCurrentPosition.mockImplementation((successCb) => {
      successCb({ coords: { latitude: 40.7128, longitude: -74.006 } });
    });

    const { result, unmount } = renderHook(() => useLookingNow());

    await act(async () => {
      result.current.activate();
    });

    expect(result.current.isActive).toBe(true);

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});
