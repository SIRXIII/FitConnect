import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

vi.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: vi.fn() } } }));

import { supabase } from '@/lib/supabase';
import { setupPaymentMethod, listPaymentMethods, detachPaymentMethod } from './paymentMethods';

const invoke = supabase.functions.invoke as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('setupPaymentMethod', () => {
  it('calls invoke with the setup action and returns the client secret', async () => {
    invoke.mockResolvedValue({ data: { setupIntentClientSecret: 'seti_secret_123' }, error: null });

    const secret = await setupPaymentMethod();

    expect(invoke).toHaveBeenCalledWith('manage-payment-methods', { body: { action: 'setup' } });
    expect(secret).toBe('seti_secret_123');
  });
});

describe('listPaymentMethods', () => {
  it('maps Stripe payment methods to SavedCard', async () => {
    invoke.mockResolvedValue({
      data: { paymentMethods: [{ id: 'pm_1', card: { brand: 'visa', last4: '4242' } }] },
      error: null,
    });

    const cards = await listPaymentMethods();

    expect(invoke).toHaveBeenCalledWith('manage-payment-methods', { body: { action: 'list' } });
    expect(cards).toEqual([{ id: 'pm_1', brand: 'visa', last4: '4242' }]);
  });

  it('falls back to card/•••• when card is null', async () => {
    invoke.mockResolvedValue({
      data: { paymentMethods: [{ id: 'pm_2', card: null }] },
      error: null,
    });

    const cards = await listPaymentMethods();

    expect(cards).toEqual([{ id: 'pm_2', brand: 'card', last4: '••••' }]);
  });
});

describe('detachPaymentMethod', () => {
  it('sends the detach action with the payment method id', async () => {
    invoke.mockResolvedValue({ data: { ok: true }, error: null });

    await detachPaymentMethod('pm_1');

    expect(invoke).toHaveBeenCalledWith('manage-payment-methods', {
      body: { action: 'detach', payment_method_id: 'pm_1' },
    });
  });

  it('rejects with the edge function error message on non-2xx', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: { context: new Response(JSON.stringify({ error: 'not_owner' }), { status: 403 }) },
    });

    await expect(detachPaymentMethod('pm_1')).rejects.toThrow('not_owner');
  });
});

describe('client screens use the canonical card-on-file path', () => {
  const ONBOARDING_SOURCE = readFileSync(resolve(__dirname, '../pages/ClientOnboarding.tsx'), 'utf-8');
  const SETTINGS_SOURCE = readFileSync(resolve(__dirname, '../components/client/ClientSettingsTab.tsx'), 'utf-8');

  it.each([
    ['ClientOnboarding.tsx', ONBOARDING_SOURCE],
    ['ClientSettingsTab.tsx', SETTINGS_SOURCE],
  ])('%s does not reference the stale create-setup-intent path', (_name, source) => {
    expect(source).not.toContain('create-setup-intent');
    expect(source).not.toContain('stripe_payment_');
    expect(source).toContain("from '@/lib/paymentMethods'");
  });

  // Regression: reporting success before the list catches up renders the
  // "No payment method saved" empty state alongside the success toast.
  it("ClientSettingsTab refreshes the card list before reporting success", () => {
    expect(SETTINGS_SOURCE).toMatch(
      /await refreshCards\(\);\s*\n\s*toast\.success\(.Payment method saved\..\);/,
    );
    expect(SETTINGS_SOURCE).toMatch(
      /await detachPaymentMethod\(id\);\s*\n\s*await refreshCards\(\);\s*\n\s*toast\.success\(.Card removed\..\);/,
    );
  });
});
