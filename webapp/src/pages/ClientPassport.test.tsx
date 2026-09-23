import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ClientPassport from './ClientPassport';

const mocks = vi.hoisted(() => ({
  updateProfile: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  single: vi.fn(),
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
  authState: {
    user: { id: 'client-1' },
    profile: {
      full_name: 'Casey Client',
      location: null as string | null,
      avatar_url: null as string | null,
    },
  },
}));

vi.mock('react-router-dom', () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/client/dashboard">{children}</a>,
}));

vi.mock('sonner', () => ({ toast: mocks.toast }));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: mocks.from,
  },
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    ...mocks.authState,
    updateProfile: mocks.updateProfile,
  }),
}));

vi.mock('@/lib/matchScoring', () => ({
  clearMatchCache: vi.fn(),
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

vi.mock('@/components/client/ProfileProgressRing', () => ({
  default: ({ missingFields }: { missingFields: string[] }) => <div>{missingFields.join(', ')}</div>,
}));

vi.mock('@/components/client/HealthConditionsChecklist', () => ({
  default: () => <div />,
}));

vi.mock('@/components/client/IntensitySlider', () => ({
  default: () => <div />,
}));

vi.mock('@/components/client/GoalRankPicker', () => ({
  default: () => <div />,
}));

vi.mock('@/components/shared/ClientWorkoutSummary', () => ({
  default: () => <div />,
}));

describe('ClientPassport location editing', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.authState.profile = {
      full_name: 'Casey Client',
      location: null,
      avatar_url: null,
    };
    mocks.single.mockResolvedValue({ data: null });
    mocks.eq.mockReturnValue({ single: mocks.single });
    mocks.select.mockReturnValue({ eq: mocks.eq });
    mocks.from.mockReturnValue({ select: mocks.select });
    mocks.updateProfile.mockResolvedValue(undefined);
  });

  afterEach(cleanup);

  it('shows missing historical locations and saves a captured value through the auth profile', async () => {
    render(<ClientPassport />);

    const locationInput = await screen.findByPlaceholderText('City or service area') as HTMLInputElement;
    expect(screen.getByText('Missing')).toBeTruthy();

    fireEvent.change(locationInput, { target: { value: 'Denver, CO' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Location' }));

    await waitFor(() => expect(mocks.updateProfile).toHaveBeenCalledWith({ location: 'Denver, CO' }));
  });

  it('restores a saved location instead of allowing it to be cleared', async () => {
    mocks.authState.profile.location = 'Austin, TX';
    render(<ClientPassport />);

    const locationInput = await screen.findByPlaceholderText('City or service area') as HTMLInputElement;
    fireEvent.change(locationInput, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Location' }));

    expect(mocks.updateProfile).not.toHaveBeenCalled();
    expect(locationInput.value).toBe('Austin, TX');
    expect(mocks.toast.error).toHaveBeenCalledWith('City / service area cannot be cleared.');
  });
});
