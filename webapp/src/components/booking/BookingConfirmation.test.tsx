import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BookingConfirmation } from './BookingConfirmation';

const { read } = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock('@/lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: read }) }) }) },
}));

describe('BookingConfirmation', () => {
  beforeEach(() => { vi.useFakeTimers(); read.mockReset(); });
  afterEach(() => vi.useRealTimers());

  const mount = async () => {
    const confirmed = vi.fn();
    const view = render(<MemoryRouter><BookingConfirmation bookingId="booking-1" onConfirmed={confirmed} /></MemoryRouter>);
    await act(async () => {});
    return { confirmed, ...view };
  };

  it('waits for the matching persisted confirmed booking', async () => {
    read.mockResolvedValueOnce({ data: { id: 'booking-1', status: 'pending' } })
      .mockResolvedValueOnce({ data: { id: 'other', status: 'confirmed' } })
      .mockResolvedValue({ data: { id: 'booking-1', status: 'confirmed' } });
    const { confirmed } = await mount();
    expect(confirmed).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(confirmed).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(confirmed).toHaveBeenCalledOnce();
  });

  it('recovers from returned and thrown read errors', async () => {
    read.mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ data: null, error: { message: 'offline' } })
      .mockResolvedValue({ data: { id: 'booking-1', status: 'confirmed' } });
    const { confirmed } = await mount();
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(confirmed).toHaveBeenCalledOnce();
  });

  it('offers status-only retry on timeout', async () => {
    read.mockResolvedValue({ data: null });
    const { confirmed } = await mount();
    await act(() => vi.advanceTimersByTimeAsync(15000));
    expect(confirmed).not.toHaveBeenCalled();
    expect(screen.getByText('Confirmation is taking longer')).toBeTruthy();
    read.mockResolvedValue({ data: { id: 'booking-1', status: 'confirmed' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Check Status' })));
    expect(confirmed).toHaveBeenCalledOnce();
  });

  it('does not confirm a cancelled booking', async () => {
    read.mockResolvedValue({ data: { id: 'booking-1', status: 'cancelled' } });
    const { confirmed } = await mount();
    expect(screen.getByText('Booking unavailable')).toBeTruthy();
    expect(confirmed).not.toHaveBeenCalled();
  });

  it('ignores reads completing after unmount', async () => {
    let resolve!: (value: unknown) => void;
    read.mockReturnValue(new Promise((done) => { resolve = done; }));
    const { confirmed, unmount } = await mount();
    unmount();
    await act(async () => resolve({ data: { id: 'booking-1', status: 'confirmed' } }));
    expect(confirmed).not.toHaveBeenCalled();
  });
});
