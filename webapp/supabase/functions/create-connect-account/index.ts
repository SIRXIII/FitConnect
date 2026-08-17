import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import Stripe from 'npm:stripe@14.25.0';
import { corsHeaders } from '../_shared/cors.ts';
import { requireEnv } from '../_shared/env.ts';

interface ConnectAccountRequest {
  return_url?: string;
  refresh_url?: string;
  sync_only?: boolean;
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

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const body = (await req.json().catch(() => ({}))) as ConnectAccountRequest;

    // Derive base URL from request origin, falling back to SITE_URL env var or localhost
    const origin = req.headers.get('origin') || Deno.env.get('SITE_URL') || 'http://localhost:3000';
    const defaultDashboard = `${origin}/trainer/dashboard`;

    const returnUrl =
      typeof body.return_url === 'string' && body.return_url.length > 0
        ? body.return_url
        : defaultDashboard;
    const refreshUrl =
      typeof body.refresh_url === 'string' && body.refresh_url.length > 0
        ? body.refresh_url
        : defaultDashboard;

    const { data: trainerProfile, error: trainerError } = await adminClient
      .from('trainer_profiles')
      .select('id, stripe_account_id')
      .eq('user_id', user.id)
      .single();

    if (trainerError || !trainerProfile) {
      return new Response(JSON.stringify({ error: 'Trainer profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let stripeAccountId = trainerProfile.stripe_account_id as string | null;

    if (stripeAccountId) {
      const account = await stripe.accounts.retrieve(stripeAccountId);

      const { error: syncError } = await adminClient
        .from('trainer_profiles')
        .update({
          payouts_enabled: account.payouts_enabled === true,
          stripe_details_submitted: account.details_submitted === true,
        })
        .eq('id', trainerProfile.id);

      if (syncError) {
        console.error('[create-connect-account] Failed to sync Stripe status:', syncError.message);
      }

      if (body.sync_only) {
        return new Response(
          JSON.stringify({
            accountId: stripeAccountId,
            payouts_enabled: account.payouts_enabled === true,
            details_submitted: account.details_submitted === true,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      if (account.details_submitted) {
        const loginLink = await stripe.accounts.createLoginLink(stripeAccountId);

        return new Response(
          JSON.stringify({
            url: loginLink.url,
            accountId: stripeAccountId,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    } else if (body.sync_only) {
      return new Response(
        JSON.stringify({ accountId: null, payouts_enabled: false, details_submitted: false }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'US',
        business_type: 'individual',
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: {
          trainer_profile_id: trainerProfile.id,
          user_id: user.id,
        },
      });

      stripeAccountId = account.id;

      const { error: updateError } = await adminClient
        .from('trainer_profiles')
        .update({ stripe_account_id: stripeAccountId })
        .eq('id', trainerProfile.id);

      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    let onboardingReturnUrl = returnUrl;
    try {
      const url = new URL(returnUrl);
      url.searchParams.set('stripe_return', '1');
      onboardingReturnUrl = url.toString();
    } catch {
      onboardingReturnUrl = returnUrl;
    }

    let onboardingRefreshUrl = refreshUrl;
    try {
      const url = new URL(refreshUrl);
      url.searchParams.set('stripe_return', '1');
      onboardingRefreshUrl = url.toString();
    } catch {
      onboardingRefreshUrl = refreshUrl;
    }

    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      type: 'account_onboarding',
      return_url: onboardingReturnUrl,
      refresh_url: onboardingRefreshUrl,
    });

    return new Response(
      JSON.stringify({
        url: accountLink.url,
        accountId: stripeAccountId,
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
