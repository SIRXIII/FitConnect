import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AccountSecuritySection from './AccountSecuritySection';

const mocks = vi.hoisted(() => ({
  updateUser: vi.fn(),
  authState: {
    user: { email: 'trainer@example.com' },
    profile: { role: 'trainer' },
  },
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      updateUser: mocks.updateUser,
    },
  },
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: (selector?: (state: typeof mocks.authState) => unknown) =>
    selector ? selector(mocks.authState) : mocks.authState,
}));

const openForm = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Change Password' }));
};

const fillPasswords = (password: string, confirmation = password) => {
  fireEvent.change(screen.getByLabelText('New Password'), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: confirmation } });
};

describe('AccountSecuritySection', () => {
  beforeEach(() => {
    mocks.updateUser.mockReset();
    mocks.updateUser.mockResolvedValue({ error: null });
    mocks.authState.user.email = 'trainer@example.com';
    mocks.authState.profile.role = 'trainer';
  });

  afterEach(cleanup);

  it.each([
    ['trainer', 'trainer@example.com'],
    ['client', 'client@example.com'],
    ['admin', 'admin@example.com'],
  ])('renders the signed-in email in the %s settings context', (role, email) => {
    mocks.authState.profile.role = role;
    mocks.authState.user.email = email;

    render(<AccountSecuritySection />);

    expect(screen.getByRole('heading', { name: 'Account Security' })).toBeTruthy();
    expect(screen.getByText(email)).toBeTruthy();
  });

  it('expands the form and exposes accessible password instructions', () => {
    render(<AccountSecuritySection />);
    const toggle = screen.getByRole('button', { name: 'Change Password' });

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    openForm();

    expect(screen.getByRole('button', { name: 'Cancel' }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText(/Use at least 8 characters/)).toBeTruthy();
    expect(screen.getByLabelText('New Password').getAttribute('autocomplete')).toBe('new-password');
  });

  it('clears sensitive fields when the user cancels', () => {
    render(<AccountSecuritySection />);
    openForm();
    fillPasswords('long-password');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText('New Password')).toBeNull();

    openForm();
    expect((screen.getByLabelText('New Password') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Confirm New Password') as HTMLInputElement).value).toBe('');
  });

  it('announces short-password validation without calling Supabase', async () => {
    render(<AccountSecuritySection />);
    openForm();
    fillPasswords('short');

    fireEvent.click(screen.getByRole('button', { name: 'Update Password' }));

    expect((await screen.findByRole('alert')).textContent).toContain('at least 8 characters');
    expect(screen.getByLabelText('New Password').getAttribute('aria-invalid')).toBe('true');
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it('announces password mismatches without calling Supabase', async () => {
    render(<AccountSecuritySection />);
    openForm();
    fillPasswords('long-password', 'other-password');

    fireEvent.click(screen.getByRole('button', { name: 'Update Password' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Passwords do not match');
    expect(screen.getByLabelText('Confirm New Password').getAttribute('aria-invalid')).toBe('true');
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it('gives actionable guidance for stale-session API errors', async () => {
    const authError = Object.assign(new Error('Auth session missing'), { code: 'session_not_found' });
    mocks.updateUser.mockResolvedValue({ error: authError });
    render(<AccountSecuritySection />);
    openForm();
    fillPasswords('long-password');

    fireEvent.click(screen.getByRole('button', { name: 'Update Password' }));

    await waitFor(() => expect(mocks.updateUser).toHaveBeenCalledWith({ password: 'long-password' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Sign out, sign back in');
  });

  it('announces other API errors and leaves the form available to retry', async () => {
    mocks.updateUser.mockResolvedValue({ error: new Error('Password is too common') });
    render(<AccountSecuritySection />);
    openForm();
    fillPasswords('long-password');

    fireEvent.click(screen.getByRole('button', { name: 'Update Password' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Password is too common');
    expect(screen.getByLabelText('New Password')).toBeTruthy();
  });

  it('announces success, collapses the form, and clears its fields', async () => {
    render(<AccountSecuritySection />);
    openForm();
    fillPasswords('long-password');

    fireEvent.click(screen.getByRole('button', { name: 'Update Password' }));

    expect((await screen.findByRole('status')).textContent).toContain('Password updated successfully');
    expect(screen.queryByLabelText('New Password')).toBeNull();

    openForm();
    expect((screen.getByLabelText('New Password') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Confirm New Password') as HTMLInputElement).value).toBe('');
  });

  it('supports independent show and hide controls', () => {
    render(<AccountSecuritySection />);
    openForm();
    const password = screen.getByLabelText('New Password');

    expect(password.getAttribute('type')).toBe('password');
    fireEvent.click(screen.getByRole('button', { name: 'Show new password' }));
    expect(password.getAttribute('type')).toBe('text');
    fireEvent.click(screen.getByRole('button', { name: 'Hide new password' }));
    expect(password.getAttribute('type')).toBe('password');
  });

  it('disables submission until both fields are present and while updating', async () => {
    let resolveUpdate: ((value: { error: null }) => void) | undefined;
    mocks.updateUser.mockReturnValue(new Promise((resolve) => { resolveUpdate = resolve; }));
    render(<AccountSecuritySection />);
    openForm();
    const submit = screen.getByRole('button', { name: 'Update Password' }) as HTMLButtonElement;

    expect(submit.disabled).toBe(true);
    fillPasswords('long-password');
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);

    expect((await screen.findByRole('button', { name: 'Updating...' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText('New Password') as HTMLInputElement).disabled).toBe(true);
    resolveUpdate?.({ error: null });
    await screen.findByRole('status');
  });
});
