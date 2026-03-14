import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import Stripe from 'npm:stripe@14.25.0';
import { corsHeaders } from '../_shared/cors.ts';
import { requireEnv } from '../_shared/env.ts';

interface CancelBookingRequest {
  booking_id?: string;
}

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

    // Authenticate the caller
    const authHeader = req.headers.get('Authorization') || '';
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
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

    const body = (await req.json().catch(() => ({}))) as CancelBookingRequest;
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

    // Fetch booking with slot time and payment info
    const { data: booking, error: bookingError } = await adminClient
      .from('bookings')
      .select(`
        id,
        client_id,
        trainer_id,
        status,
        availability_slots!bookings_slot_id_fkey (
          start_time
        ),
        payments!inner (
          id,
          stripe_payment_intent_id,
          status
        )
      `)
      .eq('id', bookingId)
      .maybeSingle();

    if (bookingError || !booking) {
      return new Response(JSON.stringify({ error: 'Booking not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Only the client who booked can cancel via this endpoint
    if (booking.client_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Booking must be cancellable
    if (!['pending', 'confirmed'].includes(booking.status)) {
      return new Response(
        JSON.stringify({ error: 'Booking cannot be cancelled in its current state' }),
        {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Enforce 24-hour cancellation policy
    const slotStart = Array.isArray(booking.availability_slots)
      ? booking.availability_slots[0]?.start_time
      : (booking.availability_slots as { start_time: string } | null)?.start_time;

    if (slotStart) {
      const hoursUntilSession = (new Date(slotStart).getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursUntilSession < 24) {
        return new Response(
          JSON.stringify({
            error: 'Cancellations must be made at least 24 hours before the session',
          }),
          {
            status: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Attempt Stripe refund if a succeeded payment exists
    const payment = Array.isArray(booking.payments)
      ? booking.payments[0]
      : booking.payments;

    let refunded = false;

    if (payment?.status === 'succeeded' && payment.stripe_payment_intent_id) {
      const stripe = new Stripe(stripeSecretKey, {
        apiVersion: '2023-10-16',
        httpClient: Stripe.createFetchHttpClient(),
      });

      await stripe.refunds.create({
        payment_intent: payment.stripe_payment_intent_id,
        reason: 'requested_by_customer',
      });

      // Mark payment as refunded
      await adminClient
        .from('payments')
        .update({ status: 'refunded' })
        .eq('id', payment.id);

      refunded = true;
    }

    // Cancel the booking
    const { error: cancelError } = await adminClient
      .from('bookings')
      .update({
        status: 'cancelled',
        cancelled_by: user.id,
        cancellation_reason: 'Cancelled by client',
      })
      .eq('id', bookingId);

    if (cancelError) {
      return new Response(JSON.stringify({ error: cancelError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ success: true, refunded }),
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
