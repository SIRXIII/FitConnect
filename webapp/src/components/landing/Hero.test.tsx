import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Hero from './Hero';

// Mock framer-motion to avoid animation complexity in tests
vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  },
}));

// Mock sonner
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: any[]) => mockToastSuccess(...args),
    error: (...args: any[]) => mockToastError(...args),
  },
}));

// Mock import.meta.env
vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');

describe('Hero waitlist', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockToastSuccess.mockClear();
    mockToastError.mockClear();
  });

  it('renders email input and Get Early Access button in idle state', () => {
    render(<Hero />);
    expect(screen.getByPlaceholderText('Enter your email')).toBeTruthy();
    expect(screen.getByText('Get Early Access')).toBeTruthy();
  });

  it('shows error on invalid email submit without calling fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(<Hero />);
    const input = screen.getByPlaceholderText('Enter your email');
    fireEvent.change(input, { target: { value: 'notanemail' } });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => {
      expect(screen.getByText('Please enter a valid email address')).toBeTruthy();
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('calls waitlist-signup and transitions to submitted state on valid email', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    );
    render(<Hero />);
    const input = screen.getByPlaceholderText('Enter your email');
    fireEvent.change(input, { target: { value: 'test@example.com' } });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => {
      expect(screen.getByText(/In\./)).toBeTruthy();
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://test.supabase.co/functions/v1/waitlist-signup',
      expect.objectContaining({ method: 'POST' })
    );
    expect(mockToastSuccess).toHaveBeenCalledWith('You are on the early access list.');
  });

  it('submitted state does not show position number', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    );
    render(<Hero />);
    const input = screen.getByPlaceholderText('Enter your email');
    fireEvent.change(input, { target: { value: 'test@example.com' } });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => {
      expect(screen.getByText(/In\./)).toBeTruthy();
    });
    // Verify no position number text exists
    const body = document.body.textContent ?? '';
    expect(body).not.toMatch(/#\d+/);
    expect(body.toLowerCase()).not.toContain('position');
  });
});
