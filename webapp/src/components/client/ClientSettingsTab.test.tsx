import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ClientSettingsTab from './ClientSettingsTab';

const mocks = vi.hoisted(() => ({
  updateProfile: vi.fn(),
  fetchProfile: vi.fn(),
  invoke: vi.fn(),
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
  authState: {
    user: { id: 'client-1' },
    profile: {
      full_name: 'Casey Client',
      location: null as string | null,
      phone: null as string | null,
      avatar_url: null as string | null,
    },
  },
}));

vi.mock('sonner', () => ({ toast: mocks.toast }));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    functions: { invoke: mocks.invoke },
  },
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    ...mocks.authState,
    updateProfile: mocks.updateProfile,
    fetchProfile: mocks.fetchProfile,
  }),
}));

vi.mock('@/lib/stripe', () => ({
  stripePromise: null,
  STRIPE_CONFIGURED: false,
}));

vi.mock('@/lib/platform', () => ({
  isNativeiOS: () => false,
}));

vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: ReactNode }) => <>{children}</>,
  PaymentElement: () => null,
  useStripe: () => null,
  useElements: () => null,
}));

vi.mock('@/components/shared/AccountSecuritySection', () => ({
  default: () => <div />,
}));

vi.mock('@/components/shared/DeleteAccountModal', () => ({
  default: () => <div />,
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

describe('ClientSettingsTab location editing', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.authState.profile = {
      full_name: 'Casey Client',
      location: null,
      phone: null,
      avatar_url: null,
    };
    mocks.invoke.mockResolvedValue({ data: { paymentMethods: [] }, error: null });
    mocks.updateProfile.mockResolvedValue(undefined);
    mocks.fetchProfile.mockResolvedValue(undefined);
  });

  afterEach(cleanup);

  it('shows a missing location and saves a captured value through the auth profile', async () => {
    render(<ClientSettingsTab />);

    const locationInput = screen.getByPlaceholderText('City or service area') as HTMLInputElement;
    expect(screen.getByText('Missing city / service area')).toBeTruthy();

    fireEvent.change(locationInput, { target: { value: 'Denver, CO' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Profile' }));

    await waitFor(() => expect(mocks.updateProfile).toHaveBeenNthCalledWith(1, { location: 'Denver, CO' }));
    expect(mocks.updateProfile).toHaveBeenNthCalledWith(2, { full_name: 'Casey Client', phone: null });
  });

  it('disallows clearing a completed profile location', () => {
    mocks.authState.profile.location = 'Austin, TX';
    render(<ClientSettingsTab />);

    const locationInput = screen.getByPlaceholderText('City or service area') as HTMLInputElement;
    fireEvent.change(locationInput, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Profile' }));

    expect(mocks.updateProfile).not.toHaveBeenCalled();
    expect(locationInput.value).toBe('Austin, TX');
    expect(mocks.toast.error).toHaveBeenCalledWith('City / service area cannot be cleared.');
  });
});
