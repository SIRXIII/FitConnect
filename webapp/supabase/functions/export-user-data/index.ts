import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { corsHeaders } from '../_shared/cors.ts';
import { requireEnv } from '../_shared/env.ts';

// GDPR data export: returns all personal data for the authenticated user (REQ-SEC-09)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = requireEnv('SUPABASE_URL');
    const supabaseAnonKey = requireEnv('SUPABASE_ANON_KEY');
    const supabaseServiceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

    // Authenticate caller
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

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    // Collect all personal data in parallel
    const [
      profileResult,
      trainerProfileResult,
      bookingsResult,
      reviewsResult,
      notificationsResult,
      paymentsResult,
    ] = await Promise.all([
      adminClient
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single(),

      adminClient
        .from('trainer_profiles')
        .select('id, specialty, bio, hourly_rate, optimized_rate, location, certifications, rating, review_count, created_at, updated_at')
        .eq('user_id', user.id)
        .maybeSingle(),

      adminClient
        .from('bookings')
        .select(`
          id, status, rate_charged, platform_fee, trainer_payout, notes,
          cancellation_reason, created_at, updated_at,
          availability_slots!bookings_slot_id_fkey (start_time, end_time)
        `)
        .eq('client_id', user.id)
        .order('created_at', { ascending: false }),

      adminClient
        .from('reviews')
        .select('id, rating, comment, created_at')
        .eq('client_id', user.id)
        .order('created_at', { ascending: false }),

      adminClient
        .from('notifications')
        .select('id, type, title, message, read, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),

      adminClient
        .from('payments')
        .select(`
          id, amount, platform_fee, currency, payment_method, status, created_at,
          bookings!inner (client_id)
        `)
        .eq('bookings.client_id', user.id),
    ]);

    const exportData = {
      exported_at: new Date().toISOString(),
      user_id: user.id,
      email: user.email,
      profile: profileResult.data,
      trainer_profile: trainerProfileResult.data,
      bookings: bookingsResult.data || [],
      reviews: reviewsResult.data || [],
      notifications: notificationsResult.data || [],
      payments: paymentsResult.data || [],
    };

    return new Response(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="fitconnect-data-${user.id}.json"`,
      },
    });
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
