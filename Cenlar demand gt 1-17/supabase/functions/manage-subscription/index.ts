import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import Stripe from 'npm:stripe@14.25.0';
import { corsHeaders } from '../_shared/cors.ts';
import { requireEnv } from '../_shared/env.ts';

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

    // Step 1: Authenticate the trainer via JWT
    // No request body to parse — this function takes no input beyond the JWT
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

    // Step 2: Use service-role client for DB operations
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Step 3: Fetch trainer profile
    const { data: trainerProfile, error: trainerError } = await adminClient
      .from('trainer_profiles')
      .select('id, stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (trainerError || !trainerProfile) {
      return new Response(JSON.stringify({ error: 'Trainer profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 4: Guard — trainer must have started a subscription first
    if (!trainerProfile.stripe_customer_id) {
      return new Response(
        JSON.stringify({ error: 'No subscription found. Start a trial first.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Step 5: Build return_url (fallback if APP_URL not set)
    const appUrl = Deno.env.get('APP_URL') ?? 'https://app.fitrush.io';
    const returnUrl = `${appUrl}/trainer/dashboard?tab=subscription`;

    // Step 6: Create Stripe Customer Portal session
    // This is a pure URL generator — no DB writes needed.
    // The portal handles all subscription mutations (upgrade, downgrade, cancel, payment method update).
    // When the trainer returns from the portal, the webhook has already updated the DB state.
    const session = await stripe.billingPortal.sessions.create({
      customer: trainerProfile.stripe_customer_id,
      return_url: returnUrl,
    });

    // Step 7: Return portal URL for frontend redirect
    return new Response(
      JSON.stringify({ url: session.url }),
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
