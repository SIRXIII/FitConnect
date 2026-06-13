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
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  try {
    const supabaseUrl = requireEnv('SUPABASE_URL');
    const supabaseAnonKey = requireEnv('SUPABASE_ANON_KEY');
    const supabaseServiceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    const stripeSecretKey = requireEnv('STRIPE_SECRET_KEY');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

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
    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16', httpClient: Stripe.createFetchHttpClient() });

    // Parse request body once
    const body = await req.json().catch(() => ({}));

    // Determine caller's role
    const { data: callerProfile, error: callerProfileError } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (callerProfileError || !callerProfile) {
      return new Response(JSON.stringify({ error: 'Caller profile not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isAdminOverride = callerProfile.role === 'admin' && !!body.target_trainer_profile_id;

    let trainerProfile: { id: string; stripe_account_id: string | null; user_id: string };
    let initiatedBy: string;
    let initiatedByAdminId: string | null;

    if (isAdminOverride) {
      // Admin path: resolve target trainer by trainer_profiles.id
      const { data: targetTrainer, error: targetTrainerError } = await adminClient
        .from('trainer_profiles')
        .select('id, stripe_account_id, user_id')
        .eq('id', body.target_trainer_profile_id)
        .single();
      if (targetTrainerError || !targetTrainer) {
        return new Response(JSON.stringify({ error: 'Target trainer profile not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      trainerProfile = targetTrainer as { id: string; stripe_account_id: string | null; user_id: string };
      initiatedBy = 'admin';
      initiatedByAdminId = user.id;
    } else {
      // Trainer self-service path: resolve by user.id (original behavior)
      const { data: selfTrainer, error: trainerError } = await adminClient
        .from('trainer_profiles')
        .select('id, stripe_account_id, user_id')
        .eq('user_id', user.id)
        .single();
      if (trainerError || !selfTrainer) {
        return new Response(JSON.stringify({ error: 'Trainer profile not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      trainerProfile = selfTrainer as { id: string; stripe_account_id: string | null; user_id: string };
      initiatedBy = 'trainer';
      initiatedByAdminId = null;
    }

    if (!trainerProfile.stripe_account_id) {
      return new Response(JSON.stringify({ error: 'Stripe account not connected.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const stripeAccountId = trainerProfile.stripe_account_id as string;

    // Step 3: Calculate available balance
    const { data: balanceRows, error: balanceError } = await adminClient
      .from('payments').select('trainer_payout')
      .eq('status', 'succeeded').is('payout_transaction_id', null)
      .in('booking_id', adminClient.from('bookings').select('id').eq('trainer_id', trainerProfile.id));
    if (balanceError) {
      return new Response(JSON.stringify({ error: 'Failed to calculate balance' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const balance = (balanceRows ?? []).reduce((sum: number, row: { trainer_payout: number }) => sum + Number(row.trainer_payout), 0);

    // Step 4: min $50 (applies to both trainer self-service and admin paths)
    if (balance < 50) {
      return new Response(JSON.stringify({ error: 'Minimum payout amount is $50' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // Step 5: no duplicate
    const { data: existingPayout, error: existingPayoutError } = await adminClient
      .from('payout_transactions').select('id').eq('trainer_id', trainerProfile.id)
      .in('status', ['pending', 'processing']).maybeSingle();
    if (existingPayoutError) {
      return new Response(JSON.stringify({ error: 'Failed to check existing payouts' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (existingPayout) {
      return new Response(JSON.stringify({ error: 'A payout is already in progress' }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // Step 6a: insert pending
    const insertPayload: Record<string, unknown> = {
      trainer_id: trainerProfile.id,
      amount: balance,
      status: 'pending',
      initiated_by: initiatedBy,
    };
    if (initiatedByAdminId) {
      insertPayload.initiated_by_admin_id = initiatedByAdminId;
    }
    const { data: payoutRow, error: insertError } = await adminClient
      .from('payout_transactions')
      .insert(insertPayload)
      .select('id').single();
    if (insertError || !payoutRow) {
      return new Response(JSON.stringify({ error: 'Failed to create payout record' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const payoutTransactionId = payoutRow.id as string;
    // Step 6b: sweep
    const { data: bookingRows } = await adminClient.from('bookings').select('id').eq('trainer_id', trainerProfile.id);
    const bookingIds = (bookingRows ?? []).map((b: { id: string }) => b.id);
    if (bookingIds.length > 0) {
      const { error: sweepError } = await adminClient.from('payments')
        .update({ payout_transaction_id: payoutTransactionId })
        .eq('status', 'succeeded').is('payout_transaction_id', null).in('booking_id', bookingIds);
      if (sweepError) {
        await adminClient.from('payout_transactions').update({ status: 'failed' }).eq('id', payoutTransactionId);
        return new Response(JSON.stringify({ error: 'Failed to link payments to payout' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    // Step 6c: transfer
    let transfer: Stripe.Transfer;
    try {
      transfer = await stripe.transfers.create({
        amount: Math.round(balance * 100), currency: 'usd', destination: stripeAccountId,
        metadata: { trainer_id: trainerProfile.id, payout_transaction_id: payoutTransactionId },
      });
    } catch (stripeErr) {
      const errorMessage = stripeErr instanceof Stripe.errors.StripeError ? stripeErr.message : 'Stripe transfer failed';
      const isInsufficientFunds = stripeErr instanceof Stripe.errors.StripeError && stripeErr.code === 'insufficient_funds';
      await adminClient.from('payout_transactions').update({ status: 'failed' }).eq('id', payoutTransactionId);
      await adminClient.from('payments').update({ payout_transaction_id: null }).eq('payout_transaction_id', payoutTransactionId);
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: isInsufficientFunds ? 402 : 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // Step 6d
    await adminClient.from('payout_transactions').update({ status: 'processing', stripe_transfer_id: transfer.id }).eq('id', payoutTransactionId);
    // Step 7: email (non-blocking) — always sends to TARGET trainer's email (trainerProfile.user_id)
    try {
      const { data: profileData } = await adminClient.from('profiles').select('email').eq('id', trainerProfile.user_id).single();
      const trainerEmail = profileData?.email as string | undefined;
      if (trainerEmail && resendApiKey) {
        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: 'FitRush <noreply@resend.dev>', to: [trainerEmail], subject: 'Your FitRush payout has been initiated', html: `<p>Your payout of $${balance.toFixed(2)} has been initiated. Funds expected within 2 business days.</p>` }),
        });
        if (!emailRes.ok) { const errBody = await emailRes.text(); console.warn('[create-payout] Resend email warning:', emailRes.status, errBody); }
      } else if (!resendApiKey) { console.log('[create-payout] No RESEND_API_KEY — skipping initiation email'); }
    } catch (emailErr) { console.warn('[create-payout] Email send failed (non-blocking):', emailErr); }

    return new Response(JSON.stringify({ success: true, amount: balance, transferId: transfer.id }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
