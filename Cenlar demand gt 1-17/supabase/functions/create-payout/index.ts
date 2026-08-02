import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import Stripe from 'npm:stripe@14.25.0';
import { corsHeaders } from '../_shared/cors.ts';
import { requireEnv } from '../_shared/env.ts';

// 2026-08-01: synced from deployed v38 (repo copy had drifted), then added:
//   * RELEASE GATE — only payments whose booking is 'completed' are payable
//     (admin decision 2026-08-01; previously any non-cancelled/no_show booking
//     was payable the moment the charge succeeded).
//   * payout_on_hold check — admin can freeze a trainer's payouts entirely
//     (trainer_profiles.payout_on_hold, toggled via admin_set_payout_hold RPC).

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

    type TrainerRow = { id: string; stripe_account_id: string | null; user_id: string; payout_on_hold: boolean };
    let trainerProfile: TrainerRow;
    let initiatedBy: string;
    let initiatedByAdminId: string | null;

    if (isAdminOverride) {
      const { data: targetTrainer, error: targetTrainerError } = await adminClient
        .from('trainer_profiles')
        .select('id, stripe_account_id, user_id, payout_on_hold')
        .eq('id', body.target_trainer_profile_id)
        .single();
      if (targetTrainerError || !targetTrainer) {
        return new Response(JSON.stringify({ error: 'Target trainer profile not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      trainerProfile = targetTrainer as TrainerRow;
      initiatedBy = 'admin';
      initiatedByAdminId = user.id;
    } else {
      const { data: selfTrainer, error: trainerError } = await adminClient
        .from('trainer_profiles')
        .select('id, stripe_account_id, user_id, payout_on_hold')
        .eq('user_id', user.id)
        .single();
      if (trainerError || !selfTrainer) {
        return new Response(JSON.stringify({ error: 'Trainer profile not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      trainerProfile = selfTrainer as TrainerRow;
      initiatedBy = 'trainer';
      initiatedByAdminId = null;
    }

    if (trainerProfile.payout_on_hold) {
      return new Response(JSON.stringify({ error: 'Payouts are on hold for this trainer' }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!trainerProfile.stripe_account_id) {
      return new Response(JSON.stringify({ error: 'Stripe account not connected.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const stripeAccountId = trainerProfile.stripe_account_id as string;

    // RELEASE GATE: only payments whose booking is 'completed' count toward a
    // payout. (Also inherently excludes cancelled/no_show.) The embedded-join
    // form is the PAYOUT-1 fix — never pass a query builder to .in().
    const { data: eligibleRows, error: balanceError } = await adminClient
      .from('payments')
      .select('id, trainer_payout, bookings!inner(trainer_id, status)')
      .eq('bookings.trainer_id', trainerProfile.id)
      .eq('status', 'succeeded')
      .is('payout_transaction_id', null)
      .eq('bookings.status', 'completed');
    if (balanceError) {
      return new Response(JSON.stringify({ error: 'Failed to calculate balance' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const balance = (eligibleRows ?? []).reduce((sum: number, row: { trainer_payout: number }) => sum + Number(row.trainer_payout), 0);
    const eligiblePaymentIds = (eligibleRows ?? []).map((row: { id: string }) => row.id);

    if (balance <= 0) {
      return new Response(JSON.stringify({ error: 'No earnings available to pay out' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
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
    const insertPayload: Record<string, unknown> = {
      trainer_id: trainerProfile.id,
      amount: balance,
      status: 'pending',
      initiated_by: initiatedBy,
    };
    if (initiatedByAdminId) {
      insertPayload.initiated_by_admin_id = initiatedByAdminId;
    }
    let payoutRow: { id: string } | null = null;
    {
      const { data, error: insertError } = await adminClient
        .from('payout_transactions')
        .insert(insertPayload)
        .select('id').single();
      if (insertError) {
        // uniq_payout_active_per_trainer partial unique index — belt-and-suspenders
        // against the pre-insert maybeSingle() check above racing with a concurrent request.
        if ((insertError as { code?: string }).code === '23505') {
          return new Response(JSON.stringify({ error: 'A payout is already in progress' }), {
            status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ error: 'Failed to create payout record' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      payoutRow = data;
    }
    if (!payoutRow) {
      return new Response(JSON.stringify({ error: 'Failed to create payout record' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const payoutTransactionId = payoutRow.id as string;
    // Sweep exactly the payment rows counted above — not a fresh "all trainer bookings" query.
    if (eligiblePaymentIds.length > 0) {
      const { error: sweepError } = await adminClient.from('payments')
        .update({ payout_transaction_id: payoutTransactionId })
        .in('id', eligiblePaymentIds);
      if (sweepError) {
        await adminClient.from('payout_transactions').update({ status: 'failed' }).eq('id', payoutTransactionId);
        return new Response(JSON.stringify({ error: 'Failed to link payments to payout' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    // Post-sweep re-sum so payout_transactions.amount and the Stripe transfer
    // amount match exactly what got swept, not the pre-sweep balance estimate.
    const { data: sweptRows, error: sweptError } = await adminClient
      .from('payments').select('trainer_payout').eq('payout_transaction_id', payoutTransactionId);
    if (sweptError) {
      await adminClient.from('payout_transactions').update({ status: 'failed' }).eq('id', payoutTransactionId);
      return new Response(JSON.stringify({ error: 'Failed to verify swept payments' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const sweptAmount = (sweptRows ?? []).reduce((sum: number, row: { trainer_payout: number }) => sum + Number(row.trainer_payout), 0);
    if (sweptAmount <= 0) {
      await adminClient.from('payout_transactions').update({ status: 'failed' }).eq('id', payoutTransactionId);
      return new Response(JSON.stringify({ error: 'No earnings available to pay out' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    await adminClient.from('payout_transactions').update({ amount: sweptAmount }).eq('id', payoutTransactionId);
    let transfer: Stripe.Transfer;
    try {
      transfer = await stripe.transfers.create({
        amount: Math.round(sweptAmount * 100), currency: 'usd', destination: stripeAccountId,
        metadata: { trainer_id: trainerProfile.id, payout_transaction_id: payoutTransactionId },
      }, { idempotencyKey: payoutTransactionId });
    } catch (stripeErr) {
      const errorMessage = stripeErr instanceof Stripe.errors.StripeError ? stripeErr.message : 'Stripe transfer failed';
      const isInsufficientFunds = stripeErr instanceof Stripe.errors.StripeError && stripeErr.code === 'insufficient_funds';
      await adminClient.from('payout_transactions').update({ status: 'failed' }).eq('id', payoutTransactionId);
      await adminClient.from('payments').update({ payout_transaction_id: null }).eq('payout_transaction_id', payoutTransactionId);
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: isInsufficientFunds ? 402 : 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    await adminClient.from('payout_transactions').update({ status: 'processing', stripe_transfer_id: transfer.id }).eq('id', payoutTransactionId);
    try {
      // profiles has no email column — the address lives in auth.users
      const { data: userData } = await adminClient.auth.admin.getUserById(trainerProfile.user_id);
      const trainerEmail = userData?.user?.email as string | undefined;
      if (trainerEmail && resendApiKey) {
        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: 'FitRush <noreply@resend.dev>', to: [trainerEmail], subject: 'Your FitRush payout has been initiated', html: `<p>Your payout of $${sweptAmount.toFixed(2)} has been initiated. Funds expected within 2 business days.</p>` }),
        });
        if (!emailRes.ok) { const errBody = await emailRes.text(); console.warn('[create-payout] Resend email warning:', emailRes.status, errBody); }
      } else if (!resendApiKey) { console.log('[create-payout] No RESEND_API_KEY — skipping initiation email'); }
    } catch (emailErr) { console.warn('[create-payout] Email send failed (non-blocking):', emailErr); }

    return new Response(JSON.stringify({ success: true, amount: sweptAmount, transferId: transfer.id }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
