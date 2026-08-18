import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import NominateTrainer from './NominateTrainer';

describe('NominateTrainer', () => {
  beforeEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders the nomination form fields', () => {
    render(<NominateTrainer />);
    expect(screen.getByText('Want FitRush trainers in your city?')).toBeTruthy();
    expect(screen.getByPlaceholderText('Your first name')).toBeTruthy();
    expect(screen.getByPlaceholderText('Your city')).toBeTruthy();
    expect(screen.getByRole('combobox')).toBeTruthy();
    expect(screen.getByText('Know a great trainer? Tell us who (optional)')).toBeTruthy();
  });

  it('shows an inline error and does not call fetch when first name is missing', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(<NominateTrainer />);

    fireEvent.change(screen.getByPlaceholderText('Your city'), { target: { value: 'Fresno' } });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'CA' } });
    fireEvent.click(screen.getByRole('button', { name: /Nominate My City/i }));

    expect(await screen.findByText('First name is required')).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('shows an inline error and does not call fetch when first name is whitespace only', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(<NominateTrainer />);

    fireEvent.change(screen.getByPlaceholderText('Your first name'), { target: { value: '   ' } });
    fireEvent.change(screen.getByPlaceholderText('Your city'), { target: { value: 'Fresno' } });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'CA' } });
    fireEvent.click(screen.getByRole('button', { name: /Nominate My City/i }));

    expect(await screen.findByText('First name is required')).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('submits a valid nomination and shows the success screen with the vote count', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, cityCount: 7 }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<NominateTrainer />);

    fireEvent.change(screen.getByPlaceholderText('Your first name'), { target: { value: 'Jordan' } });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'CA' } });
    fireEvent.change(screen.getByPlaceholderText('Your city'), { target: { value: 'Fresno' } });
    fireEvent.click(screen.getByRole('button', { name: /Nominate My City/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/functions/v1/nominate-trainer');
    expect(options.headers.Authorization).toContain('test-anon-key');

    const successMsg = await screen.findByRole('heading', { level: 2, name: 'Nomination Received' });
    expect(successMsg.parentElement?.textContent).toContain("You're vote #7 for Fresno");
  });
});
