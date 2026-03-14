import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import Stripe from 'npm:stripe@14.25.0';
import { corsHeaders } from '../_shared/cors.ts';
import { requireEnv } from '../_shared/env.ts';

type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded';
type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = requireEnv('SUPABASE_URL');
    const supabaseServiceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    const stripeSecretKey = requireEnv('STRIPE_SECRET_KEY');
    const stripeWebhookSecret = requireEnv('STRIPE_WEBHOOK_SECRET');

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      return new Response(JSON.stringify({ error: 'Missing stripe-signature header' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const event = stripe.webhooks.constructEvent(body, signature, stripeWebhookSecret);

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    const updatePaymentAndBooking = async (
      paymentIntentId: string,
      paymentStatus: PaymentStatus,
      bookingStatus?: BookingStatus,
      cancellationReason?: string
    ) => {
      const { data: payment } = await adminClient
        .from('payments')
        .select('id, booking_id')
        .eq('stripe_payment_intent_id', paymentIntentId)
        .maybeSingle();

      if (!payment) {
        return;
      }

      await adminClient
        .from('payments')
        .update({ status: paymentStatus })
        .eq('id', payment.id);

      if (bookingStatus) {
        const bookingUpdate: Record<string, unknown> = { status: bookingStatus };
        if (cancellationReason) {
          bookingUpdate.cancellation_reason = cancellationReason;
        }
        if (bookingStatus === 'confirmed') {
          await adminClient
            .from('bookings')
            .update(bookingUpdate)
            .eq('id', payment.booking_id)
            .eq('status', 'pending');
        } else if (bookingStatus === 'cancelled') {
          await adminClient
            .from('bookings')
            .update(bookingUpdate)
            .eq('id', payment.booking_id)
            .in('status', ['pending', 'confirmed']);
        } else {
          await adminClient
            .from('bookings')
            .update(bookingUpdate)
            .eq('id', payment.booking_id);
        }
      }
    };

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await updatePaymentAndBooking(paymentIntent.id, 'succeeded', 'confirmed');
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await updatePaymentAndBooking(
          paymentIntent.id,
          'failed',
          'cancelled',
          paymentIntent.last_payment_error?.message || 'Payment failed'
        );
        break;
      }

      case 'payment_intent.canceled': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await updatePaymentAndBooking(paymentIntent.id, 'failed', 'cancelled', 'Payment was canceled');
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        if (charge.payment_intent && typeof charge.payment_intent === 'string') {
          await updatePaymentAndBooking(
            charge.payment_intent,
            'refunded',
            'cancelled',
            'Payment refunded'
          );
        }
        break;
      }

      case 'payout.paid': {
        // payout.paid fires on connected accounts when funds land in the trainer's bank.
        // The event.account identifies which connected account this belongs to.
        // NOTE: This event is a Connect event — the webhook endpoint must be configured
        // in Stripe Dashboard to listen to events on connected accounts.
        const payout = event.data.object as Stripe.Payout;
        const connectedAccountId = (event as any).account as string | undefined;

        if (!connectedAccountId) {
          console.warn('[stripe-webhook] payout.paid missing account field');
          break;
        }

        // Find the trainer by stripe_account_id
        const { data: trainer } = await adminClient
          .from('trainer_profiles')
          .select('id, user_id')
          .eq('stripe_account_id', connectedAccountId)
          .maybeSingle();

        if (!trainer) {
          console.warn('[stripe-webhook] payout.paid: no trainer for account', connectedAccountId);
          break;
        }

        // IMPORTANT: Stripe payouts bundle multiple transfers. A single payout.paid event
        // may cover multiple transfers. We cannot directly map payout -> transfer 1:1.
        // Strategy: Find all 'processing' payout_transactions for this trainer and check
        // if exactly one exists. If multiple exist (concurrent manual + auto payouts),
        // log a warning and skip to avoid marking the wrong transaction.
        const { data: processingTxns } = await adminClient
          .from('payout_transactions')
          .select('id, amount, stripe_transfer_id')
          .eq('trainer_id', trainer.id)
          .eq('status', 'processing');

        if (!processingTxns || processingTxns.length === 0) {
          console.log('[stripe-webhook] payout.paid: no processing transactions for trainer', trainer.id);
          break;
        }

        if (processingTxns.length > 1) {
          // GUARD: Multiple concurrent processing payouts for the same trainer.
          // Cannot safely determine which transfer this payout covers.
          // Log and skip -- these will need manual resolution or the next payout.paid
          // event (when only one remains) will resolve them.
          console.warn(
            '[stripe-webhook] payout.paid: multiple processing transactions for trainer',
            trainer.id,
            'count:', processingTxns.length,
            'ids:', processingTxns.map((t: { id: string }) => t.id),
            'Skipping automatic completion -- requires manual resolution.'
          );
          break;
        }

        // Exactly one processing transaction -- safe to mark as completed
        const payoutTx = processingTxns[0];

        await adminClient
          .from('payout_transactions')
          .update({ status: 'completed', updated_at: new Date().toISOString() })
          .eq('id', payoutTx.id);

        console.log('[stripe-webhook] payout.paid: marked payout_transaction completed', payoutTx.id, 'for trainer', trainer.id);

        // Get trainer's email for completion notification
        const { data: profile } = await adminClient
          .from('profiles')
          .select('email')
          .eq('id', trainer.user_id)
          .maybeSingle();

        if (profile?.email) {
          const resendApiKey = Deno.env.get('RESEND_API_KEY');
          if (resendApiKey) {
            const amount = Number(payoutTx.amount).toFixed(2);
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: 'FitRush <noreply@resend.dev>',
                to: [profile.email],
                subject: 'Your FitRush payout has arrived',
                html: `<p>Your payout of $${amount} has arrived in your bank account.</p>`,
              }),
            }).catch((err: unknown) => console.error('[stripe-webhook] Resend error:', err));
          } else {
            console.log('[stripe-webhook] No RESEND_API_KEY — skipping completion email for trainer', trainer.id);
          }
        }

        // Suppress unused variable warning for payout (used for type narrowing)
        void payout;
        break;
      }

      default:
        break;
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
