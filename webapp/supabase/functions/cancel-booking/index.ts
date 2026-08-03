import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import Stripe from 'npm:stripe@14.25.0';
import { corsHeaders } from '../_shared/cors.ts';
import { requireEnv } from '../_shared/env.ts';
import { getValidAccessToken, deleteGcalEvent } from '../_shared/gcal-helpers.ts';

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

    // Fetch booking with slot time, slot type, and payment info
    const { data: booking, error: bookingError } = await adminClient
      .from('bookings')
      .select(`
        id,
        client_id,
        trainer_id,
        slot_id,
        status,
        gcal_event_id,
        availability_slots!bookings_slot_id_fkey (
          start_time,
          slot_type
        ),
        payments!inner (
          id,
          stripe_payment_intent_id,
          status
        ),
        trainer_profiles!bookings_trainer_id_fkey (
          user_id,
          display_name
        ),
        profiles!bookings_client_id_fkey (
          full_name
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
    const slotData = Array.isArray(booking.availability_slots)
      ? booking.availability_slots[0]
      : (booking.availability_slots as { start_time: string; slot_type: string } | null);
    const slotStart = slotData?.start_time;
    const slotType = slotData?.slot_type ?? 'individual';

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

    // Fire-and-forget push notification to trainer (client cancelled their booking)
    const trainerUserIdForPush = Array.isArray(booking.trainer_profiles)
      ? booking.trainer_profiles[0]?.user_id
      : (booking.trainer_profiles as { user_id?: string; display_name?: string } | null)?.user_id;
    const clientNameForPush = Array.isArray(booking.profiles)
      ? booking.profiles[0]?.full_name
      : (booking.profiles as { full_name?: string } | null)?.full_name;

    if (trainerUserIdForPush) {
      fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceRoleKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_ids: [trainerUserIdForPush],
          title: 'Booking Cancelled',
          body: clientNameForPush
            ? `${clientNameForPush} cancelled their booking`
            : 'A booking was cancelled by a client',
          data: { type: 'booking_cancelled', booking_id: bookingId, cancelled_by: 'client' },
        }),
      }).catch(() => {});
    }

    // Best-effort GCal event deletion (non-blocking per locked decision)
    if (booking.gcal_event_id) {
      try {
        const { data: gcalConn } = await adminClient
          .from('google_calendar_connections')
          .select('*')
          .eq('trainer_id', booking.trainer_id)
          .eq('is_active', true)
          .maybeSingle();

        if (gcalConn) {
          const accessToken = await getValidAccessToken(gcalConn, adminClient);
          await deleteGcalEvent(accessToken, booking.gcal_event_id);
        }
      } catch (gcalErr) {
        console.error('GCal event deletion failed (non-blocking):', gcalErr);
        // Per locked decision: GCal deletion failure MUST NOT block the cancellation
      }
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
