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
