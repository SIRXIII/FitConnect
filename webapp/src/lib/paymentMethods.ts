// This is the only web client of the `manage-payment-methods` edge function.
// The Stripe customer mapping lives server-side in `profile_private_details` — never write Stripe ids to `client_profiles`.
import { supabase } from '@/lib/supabase';
import { edgeFunctionError } from '@/lib/errorMessages';

export interface SavedCard { id: string; brand: string; last4: string }

interface StripePaymentMethod { id: string; card?: { brand?: string; last4?: string } | null }

async function manage<T>(body: Record<string, unknown>, fallback: string): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>('manage-payment-methods', { body });
  if (error) throw new Error(await edgeFunctionError(error, fallback));
  return data as T;
}

/** Idempotent Stripe customer + SetupIntent; confirm the returned secret with Stripe Elements. */
export async function setupPaymentMethod(): Promise<string> {
  const { setupIntentClientSecret } = await manage<{ setupIntentClientSecret: string }>(
    { action: 'setup' }, 'Failed to initialize payment setup');
  return setupIntentClientSecret;
}

export async function listPaymentMethods(): Promise<SavedCard[]> {
  const { paymentMethods } = await manage<{ paymentMethods: StripePaymentMethod[] }>(
    { action: 'list' }, 'Failed to load saved cards');
  return paymentMethods.map(pm => ({ id: pm.id, brand: pm.card?.brand ?? 'card', last4: pm.card?.last4 ?? '••••' }));
}

export async function detachPaymentMethod(paymentMethodId: string): Promise<void> {
  await manage({ action: 'detach', payment_method_id: paymentMethodId }, 'Failed to remove card');
}
