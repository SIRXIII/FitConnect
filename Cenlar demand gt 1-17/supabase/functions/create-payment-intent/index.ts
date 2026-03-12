import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import Stripe from 'npm:stripe@14.25.0';
import { corsHeaders } from '../_shared/cors.ts';
import { requireEnv } from '../_shared/env.ts';

interface CreatePaymentIntentRequest {
  booking_id?: string;
}

type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded';

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
    const supabaseAnonKey = requireEnv('SUPABASE_ANON_KEY');
    const supabaseServiceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    const stripeSecretKey = requireEnv('STRIPE_SECRET_KEY');

    const authHeader = req.headers.get('Authorization') || '';
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
      auth: { persistSession: false },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json().catch(() => ({}))) as CreatePaymentIntentRequest;
    const bookingId = body.booking_id;

    if (!bookingId) {
      return new Response(JSON.stringify({ error: 'booking_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const { data: booking, error: bookingError } = await adminClient
      .from('bookings')
      .select(
        `
          id,
          client_id,
          trainer_id,
          status,
          rate_charged,
          platform_fee,
          trainer_payout,
          trainer_profiles!bookings_trainer_id_fkey (
            id,
            stripe_account_id
          )
        `
      )
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      return new Response(JSON.stringify({ error: 'Booking not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (booking.client_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!['pending', 'confirmed'].includes(booking.status)) {
      return new Response(JSON.stringify({ error: 'Booking is not payable in its current state' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const trainerProfile = Array.isArray(booking.trainer_profiles)
      ? booking.trainer_profiles[0]
      : booking.trainer_profiles;

    const connectedAccountId = trainerProfile?.stripe_account_id;

    if (!connectedAccountId) {
      return new Response(
        JSON.stringify({ error: 'Trainer has not completed payout setup yet' }),
        {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: existingPayment } = await adminClient
      .from('payments')
      .select('id, stripe_payment_intent_id, status')
      .eq('booking_id', booking.id)
      .maybeSingle();

    if (existingPayment?.status === 'succeeded') {
      return new Response(JSON.stringify({ error: 'Booking already paid' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (existingPayment?.stripe_payment_intent_id) {
      const existingIntent = await stripe.paymentIntents.retrieve(existingPayment.stripe_payment_intent_id);

      if (existingIntent.status === 'succeeded') {
        await adminClient
          .from('payments')
          .update({ status: 'succeeded' satisfies PaymentStatus })
          .eq('id', existingPayment.id);

        return new Response(JSON.stringify({ error: 'Booking already paid' }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (existingIntent.client_secret) {
        return new Response(
          JSON.stringify({
            clientSecret: existingIntent.client_secret,
            paymentIntentId: existingIntent.id,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    const amountCents = Math.round(Number(booking.rate_charged) * 100);
    const feeCents = Math.round(Number(booking.platform_fee) * 100);

    if (amountCents <= 0) {
      return new Response(JSON.stringify({ error: 'Invalid booking amount' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: amountCents,
        currency: 'usd',
        automatic_payment_methods: { enabled: true },
        application_fee_amount: feeCents,
        transfer_data: {
          destination: connectedAccountId,
        },
        metadata: {
          booking_id: booking.id,
          trainer_id: booking.trainer_id,
          client_id: booking.client_id,
        },
        description: `FitConnect booking ${booking.id}`,
      },
      {
        idempotencyKey: `fitconnect_booking_${booking.id}`,
      }
    );

    const paymentStatus: PaymentStatus = paymentIntent.status === 'succeeded' ? 'succeeded' : 'processing';

    const { error: paymentError } = await adminClient
      .from('payments')
      .upsert(
        {
          booking_id: booking.id,
          stripe_payment_intent_id: paymentIntent.id,
          amount: Number(booking.rate_charged),
          platform_fee: Number(booking.platform_fee),
          trainer_payout: Number(booking.trainer_payout),
          currency: 'usd',
          payment_method: 'card',
          status: paymentStatus,
        },
        { onConflict: 'booking_id' }
      );

    if (paymentError) {
      return new Response(JSON.stringify({ error: paymentError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
