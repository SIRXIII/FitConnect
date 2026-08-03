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

    // Price lookup: resolve tier+interval to Stripe price ID
    const PRICE_MAP: Record<string, string> = {
      'pro:month':   Deno.env.get('STRIPE_PRICE_PRO_MONTHLY')!,
      'pro:year':    Deno.env.get('STRIPE_PRICE_PRO_YEARLY')!,
      'elite:month': Deno.env.get('STRIPE_PRICE_ELITE_MONTHLY')!,
      'elite:year':  Deno.env.get('STRIPE_PRICE_ELITE_YEARLY')!,
    };

    // Step 1: Parse request body — accepts priceId directly OR tier+interval
    let priceId: string;
    try {
      const body = await req.json();
      priceId = body?.priceId ?? PRICE_MAP[`${body?.tier}:${body?.interval}`];
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!priceId) {
      return new Response(JSON.stringify({ error: 'Provide priceId or valid tier+interval' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 2: Authenticate the trainer via JWT
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

    // Step 3: Use service-role client for all DB operations
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Step 4: Fetch trainer profile
    const { data: trainerProfile, error: trainerError } = await adminClient
      .from('trainer_profiles')
      .select('id, stripe_customer_id, subscription_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (trainerError || !trainerProfile) {
      return new Response(JSON.stringify({ error: 'Trainer profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 5: Guard — prevent duplicate subscriptions
    if (trainerProfile.subscription_id) {
      return new Response(
        JSON.stringify({ error: 'Trainer already has an active subscription' }),
        {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Step 6: Idempotent customer creation
    let customerId: string;

    if (trainerProfile.stripe_customer_id) {
      // Reuse existing customer
      customerId = trainerProfile.stripe_customer_id;
    } else {
      // Create new Stripe customer
      const newCustomer = await stripe.customers.create({
        email: user.email,
        metadata: { trainer_id: trainerProfile.id },
      });

      // Write stripe_customer_id to DB (only safe field to write here)
      const { error: updateError } = await adminClient
        .from('trainer_profiles')
        .update({ stripe_customer_id: newCustomer.id })
        .eq('id', trainerProfile.id);

      if (updateError) {
        return new Response(JSON.stringify({ error: 'Failed to save customer ID' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      customerId = newCustomer.id;
    }

    // Step 7: Create subscription with 30-day trial
    // DO NOT write subscription_tier or subscription_status — the webhook is the single writer of subscription state
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      trial_period_days: 30,
      payment_settings: { save_default_payment_method: 'on_subscription' },
      trial_settings: {
        end_behavior: { missing_payment_method: 'cancel' },
      },
    });

    // Step 8: Return subscriptionId and status (will be 'trialing')
    return new Response(
      JSON.stringify({ subscriptionId: subscription.id, status: subscription.status }),
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
