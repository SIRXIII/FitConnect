import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { corsHeaders } from '../_shared/cors.ts';
import { requireEnv } from '../_shared/env.ts';
import { getValidAccessToken, withRetry, createGcalEvent } from '../_shared/gcal-helpers.ts';

interface SyncBookingRequest {
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
    const siteUrl = Deno.env.get('SITE_URL') ?? 'https://fitrush-app.netlify.app';

    const authHeader = req.headers.get('Authorization') || '';

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    // Accept both service-role auth (cron/automated) and user auth (manual trigger)
    const isServiceRole = authHeader.includes(supabaseServiceRoleKey);

    if (!isServiceRole) {
      // Validate user auth
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
    }

    const body = (await req.json().catch(() => ({}))) as SyncBookingRequest;
    const bookingId = body.booking_id;

    if (!bookingId) {
      return new Response(JSON.stringify({ error: 'booking_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Fetch booking with slot times and client name
    const { data: booking, error: bookingError } = await adminClient
      .from('bookings')
      .select(`
        id,
        trainer_id,
        status,
        notes,
        gcal_event_id,
        availability_slots!bookings_slot_id_fkey (
          start_time,
          end_time
        ),
        profiles!bookings_client_id_fkey (
          full_name
        )
      `)
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      return new Response(JSON.stringify({ error: 'Booking not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Skip if booking is not in a syncable state
    if (!['confirmed', 'pending'].includes(booking.status)) {
      return new Response(
        JSON.stringify({ skipped: true, reason: 'not_confirmed' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // 3. Idempotency guard — already synced
    if (booking.gcal_event_id) {
      return new Response(
        JSON.stringify({ skipped: true, reason: 'already_synced', gcal_event_id: booking.gcal_event_id }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // 4. Fetch trainer's active GCal connection
    const { data: connection } = await adminClient
      .from('google_calendar_connections')
      .select('*')
      .eq('trainer_id', booking.trainer_id)
      .eq('is_active', true)
      .maybeSingle();

    // 5. Trainer has no active GCal connection — silently skip
    if (!connection) {
      return new Response(
        JSON.stringify({ skipped: true, reason: 'no_gcal_connection' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // 6. Get valid access token (handles refresh transparently)
    let accessToken: string;
    try {
      accessToken = await getValidAccessToken(connection, adminClient);
    } catch (err) {
      if (err instanceof Error && err.message === 'gcal_token_revoked') {
        return new Response(
          JSON.stringify({ skipped: true, reason: 'gcal_token_revoked' }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }
      throw err;
    }

    // 7. Extract slot times and client name from joins
    const slot = Array.isArray(booking.availability_slots)
      ? booking.availability_slots[0]
      : booking.availability_slots as { start_time: string; end_time: string } | null;

    const clientProfile = Array.isArray(booking.profiles)
      ? booking.profiles[0]
      : booking.profiles as { full_name: string } | null;

    if (!slot?.start_time || !slot?.end_time) {
      return new Response(JSON.stringify({ error: 'Booking slot times not found' }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const clientName = clientProfile?.full_name || 'Client';

    // 8. Create GCal event with retry (exponential backoff, 3 attempts)
    const eventId = await withRetry(() =>
      createGcalEvent(accessToken, {
        summary: `FitRush Session - ${clientName}`,
        description: `Session booked via FitRush\nBooking: ${siteUrl}/trainer/bookings`,
        location: '',
        start: slot.start_time,
        end: slot.end_time,
      })
    );

    // 9. Store GCal event ID on booking record
    await adminClient
      .from('bookings')
      .update({ gcal_event_id: eventId })
      .eq('id', bookingId);

    return new Response(
      JSON.stringify({ success: true, gcal_event_id: eventId }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
