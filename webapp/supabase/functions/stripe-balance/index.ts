import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import Stripe from 'npm:stripe@14.25.0';
import { corsHeaders } from '../_shared/cors.ts';
import { requireEnv } from '../_shared/env.ts';

// Admin-only read of the PLATFORM Stripe balance (2026-08-03).
//
// Model B holds client funds on the platform and pays trainers via
// stripe.transfers.create in create-payout. A transfer can only draw on the
// AVAILABLE balance, so it fails with balance_insufficient while the money is
// still sitting in PENDING (card funds settle in ~2 business days). It also
// fails if automatic payouts have already swept the available balance to the
// bank. Neither state is visible anywhere in the app today, which is why the
// $86 release looked like an unexplained error.
//
// This endpoint exposes both facts so the admin dashboard can show why Release
// will fail BEFORE it is pressed. Read-only: it moves no money.

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  try {
    const supabaseUrl = requireEnv('SUPABASE_URL');
    const supabaseAnonKey = requireEnv('SUPABASE_ANON_KEY');
    const supabaseServiceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    const stripeSecretKey = requireEnv('STRIPE_SECRET_KEY');

    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false } });
    const { data: callerProfile } = await adminClient
      .from('profiles').select('role').eq('id', user.id).single();
    if (callerProfile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const balance = await stripe.balance.retrieve();
    // Stripe reports one entry per currency. FitRush charges usd only, but sum
    // defensively rather than assuming index 0 is usd.
    const sumUsd = (buckets: Array<{ amount: number; currency: string }> | undefined) =>
      (buckets ?? []).filter((b) => b.currency === 'usd').reduce((sum, b) => sum + b.amount, 0);

    // Recent payouts answer "is an automatic schedule draining the float?".
    // automatic: true means Stripe moved it to the bank on a schedule, not us.
    const payouts = await stripe.payouts.list({ limit: 3 });

    return new Response(JSON.stringify({
      available_cents: sumUsd(balance.available),
      pending_cents: sumUsd(balance.pending),
      currency: 'usd',
      livemode: balance.livemode,
      recent_payouts: payouts.data.map((p) => ({
        id: p.id,
        amount_cents: p.amount,
        status: p.status,
        automatic: p.automatic,
        arrival_date: p.arrival_date, // unix epoch SECONDS
      })),
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Stripe.errors.StripeError
      ? error.message
      : error instanceof Error ? error.message : 'Internal server error';
    console.error('[stripe-balance] failed:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
