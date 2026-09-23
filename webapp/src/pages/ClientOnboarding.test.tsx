import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ClientOnboarding from './ClientOnboarding';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  updateProfile: vi.fn(),
  upsert: vi.fn(),
  from: vi.fn(),
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
  authState: {
    user: { id: 'client-1' },
    profile: { full_name: '', location: null as string | null },
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock('sonner', () => ({ toast: mocks.toast }));

vi.mock('@stripe/stripe-js', () => ({
  loadStripe: vi.fn(() => null),
}));

vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: ReactNode }) => <>{children}</>,
  PaymentElement: () => null,
  useStripe: () => null,
  useElements: () => null,
}));

vi.mock('@/lib/platform', () => ({
  isNativeiOS: () => false,
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: mocks.from,
    auth: { getSession: vi.fn() },
  },
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    ...mocks.authState,
    updateProfile: mocks.updateProfile,
  }),
}));

vi.mock('@/components/shared/LocationAutocomplete', () => ({
  default: ({
    value,
    onChange,
    placeholder,
  }: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  }) => (
    <input
      aria-label="City / service area"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
    />
  ),
}));

const completeRequiredSteps = () => {
  fireEvent.change(screen.getByPlaceholderText('Full name'), { target: { value: 'Casey Client' } });
  fireEvent.change(screen.getByPlaceholderText('City or service area'), { target: { value: '  Austin, TX  ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  fireEvent.click(screen.getByRole('button', { name: /^Slim/ }));
  fireEvent.click(screen.getByRole('button', { name: /^Beginner/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  fireEvent.click(screen.getByRole('button', { name: 'Weight Loss' }));
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  fireEvent.click(screen.getByRole('button', { name: 'Strength Training' }));
};

describe('ClientOnboarding location requirement', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.authState.profile = { full_name: '', location: null };
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.from.mockReturnValue({ upsert: mocks.upsert });
    mocks.updateProfile.mockResolvedValue(undefined);
  });

  afterEach(cleanup);

  it('keeps the first Continue action disabled until a valid city or service area is entered', () => {
    render(<ClientOnboarding />);
    const continueButton = screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement;

    expect(continueButton.disabled).toBe(true);
    fireEvent.change(screen.getByPlaceholderText('Full name'), { target: { value: 'Casey Client' } });
    expect(continueButton.disabled).toBe(true);

    fireEvent.change(screen.getByPlaceholderText('City or service area'), { target: { value: 'x'.repeat(101) } });
    expect(continueButton.disabled).toBe(true);

    fireEvent.change(screen.getByPlaceholderText('City or service area'), { target: { value: 'Austin, TX' } });
    expect(continueButton.disabled).toBe(false);
  });

  it('saves location before completion and keeps the value for a retry after location failure', async () => {
    mocks.updateProfile.mockRejectedValueOnce(new Error('location save failed'));
    render(<ClientOnboarding />);
    completeRequiredSteps();

    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));

    await waitFor(() => expect(mocks.updateProfile).toHaveBeenCalledWith({ location: 'Austin, TX' }));
    expect(mocks.updateProfile).not.toHaveBeenCalledWith(expect.objectContaining({ onboarding_complete: true }));
    for (let i = 0; i < 4; i += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    }
    expect((screen.getByPlaceholderText('City or service area') as HTMLInputElement).value).toBe('  Austin, TX  ');
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(mocks.toast.error).toHaveBeenCalledWith('Failed to save profile. Please try again.');
  });

  it('marks onboarding complete only after the location save succeeds', async () => {
    render(<ClientOnboarding />);
    completeRequiredSteps();

    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/trainers', { replace: true }));
    expect(mocks.updateProfile).toHaveBeenNthCalledWith(1, { location: 'Austin, TX' });
    expect(mocks.updateProfile).toHaveBeenNthCalledWith(2, {
      onboarding_complete: true,
      full_name: 'Casey Client',
    });
  });
});
