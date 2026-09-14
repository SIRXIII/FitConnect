// release-stale-bookings — frees slots held by abandoned webapp checkouts.
//
// 2026-09-14: public._create_booking marks availability_slots.is_booked = true
// and inserts a 'pending' booking the moment the client picks a slot, before
// any payment. The only thing that releases that hold is
// release_pending_booking, called from BookSession.tsx's catch block — and it
// hard-requires auth.uid() = client_id, so it can only ever run from that one
// browser session. Close the tab, navigate away, or simply never press pay,
// and the slot stays held forever. No cron released it.
//
// The hole was invisible until today because create-payment-intent-web
// returned 500 on every booking, which always tripped that catch and always
// auto-released the slot. Fixing the 500 removed the accidental cleanup.
//
// ORDER MATTERS — cancel the PaymentIntent BEFORE the booking. A reaper that
// cancels the booking first opens a charge-with-no-session hole: the client
// sits on the payment form past the cutoff, we cancel the booking, they press
// pay, Stripe charges them, and stripe-webhook's confirm is scoped
// .eq('status','pending') so it silently no-ops against the now-cancelled row.
// Client charged, booking gone, no refund. So: cancel the PI first, and if it
// is not provably dead afterwards, leave the booking alone.
//
// Fails safe. If Stripe is unreachable nothing is released — a held slot is
// recoverable, a wrong cancel after a charge is not.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import Stripe from 'npm:stripe@14.25.0';
import { corsHeaders } from '../_shared/cors.ts';
import { requireEnv } from '../_shared/env.ts';

// Generous: a slow checkout (card lookup, 3DS, digging out a wallet) must not
// lose its slot mid-payment.
const STALE_AFTER_MINUTES = 30;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const supabaseUrl = requireEnv('SUPABASE_URL');
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    const stripeSecretKey = requireEnv('STRIPE_SECRET_KEY');

    // Service-role only: this is a cron target, never a user-facing endpoint.
    const bearer = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    if (bearer !== serviceRoleKey) {
      return json({ error: 'Forbidden' }, 403);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const cutoff = new Date(Date.now() - STALE_AFTER_MINUTES * 60_000).toISOString();

    const { data: stale, error: staleError } = await admin
      .from('bookings')
      .select('id, client_id, slot_id, created_at, payments ( id, status, stripe_payment_intent_id )')
      .eq('status', 'pending')
      .lt('created_at', cutoff);

    if (staleError) {
      return json({ error: staleError.message }, 500);
    }

    const released: string[] = [];
    const skipped: { booking_id: string; reason: string }[] = [];

    for (const booking of stale ?? []) {
      const payment = Array.isArray(booking.payments) ? booking.payments[0] : booking.payments;
      const intentId = payment?.stripe_payment_intent_id;

      // Never touch a booking we already know is paid.
      if (payment?.status === 'succeeded') {
        skipped.push({ booking_id: booking.id, reason: 'payment_succeeded' });
        continue;
      }

      if (intentId) {
        try {
          await stripe.paymentIntents.cancel(intentId);
        } catch {
          // Cancel is rejected when the PI is no longer cancelable — it
          // succeeded, is processing (ACH in flight), or is already canceled.
          // Only the last of those is safe to release, so re-read and insist.
          let live: Stripe.PaymentIntent | null = null;
          try {
            live = await stripe.paymentIntents.retrieve(intentId);
          } catch {
            skipped.push({ booking_id: booking.id, reason: 'stripe_unreachable' });
            continue;
          }
          if (live.status !== 'canceled') {
            skipped.push({ booking_id: booking.id, reason: `pi_${live.status}` });
            continue;
          }
        }
      }

      // The PaymentIntent is dead, so the client can no longer be charged for
      // this booking. Safe to release. handle_booking_status_change frees the
      // slot; notify_on_booking_update stays silent on pending -> cancelled.
      const { error: cancelError } = await admin
        .from('bookings')
        .update({
          status: 'cancelled',
          cancelled_by: booking.client_id,
          cancellation_reason: 'checkout_timeout',
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.id)
        .eq('status', 'pending');

      if (cancelError) {
        skipped.push({ booking_id: booking.id, reason: cancelError.message });
        continue;
      }

      if (payment?.id) {
        await admin
          .from('payments')
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('id', payment.id)
          .neq('status', 'succeeded');
      }

      released.push(booking.id);
    }

    return json({
      ok: true,
      stale_after_minutes: STALE_AFTER_MINUTES,
      examined: (stale ?? []).length,
      released,
      skipped,
    });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500
    );
  }
});
