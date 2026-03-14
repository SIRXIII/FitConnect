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
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    // Step 1: Authenticate the trainer
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

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Step 2: Fetch trainer profile and stripe_account_id
    const { data: trainerProfile, error: trainerError } = await adminClient
      .from('trainer_profiles')
      .select('id, stripe_account_id, user_id')
      .eq('user_id', user.id)
      .single();

    if (trainerError || !trainerProfile) {
      return new Response(JSON.stringify({ error: 'Trainer profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!trainerProfile.stripe_account_id) {
      return new Response(JSON.stringify({ error: 'Stripe account not connected.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const stripeAccountId = trainerProfile.stripe_account_id as string;

    // Step 3: Calculate available balance
    // Sum trainer_payout from succeeded payments that have not yet been swept into a payout
    const { data: balanceRows, error: balanceError } = await adminClient
      .from('payments')
      .select('trainer_payout')
      .eq('status', 'succeeded')
      .is('payout_transaction_id', null)
      .in(
        'booking_id',
        adminClient
          .from('bookings')
          .select('id')
          .eq('trainer_id', trainerProfile.id)
      );

    if (balanceError) {
      return new Response(JSON.stringify({ error: 'Failed to calculate balance' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const balance = (balanceRows ?? []).reduce(
      (sum: number, row: { trainer_payout: number }) => sum + Number(row.trainer_payout),
      0
    );

    // Step 4: Guard — minimum payout $50
    if (balance < 50) {
      return new Response(
        JSON.stringify({ error: 'Minimum payout amount is $50' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Step 5: Guard — no duplicate in-progress payout
    const { data: existingPayout, error: existingPayoutError } = await adminClient
      .from('payout_transactions')
      .select('id')
      .eq('trainer_id', trainerProfile.id)
      .in('status', ['pending', 'processing'])
      .maybeSingle();

    if (existingPayoutError) {
      return new Response(JSON.stringify({ error: 'Failed to check existing payouts' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (existingPayout) {
      return new Response(
        JSON.stringify({ error: 'A payout is already in progress' }),
        {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Step 6a: Insert payout_transactions row (pending)
    const { data: payoutRow, error: insertError } = await adminClient
      .from('payout_transactions')
      .insert({
        trainer_id: trainerProfile.id,
        amount: balance,
        status: 'pending',
        initiated_by: 'trainer',
      })
      .select('id')
      .single();

    if (insertError || !payoutRow) {
      return new Response(JSON.stringify({ error: 'Failed to create payout record' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payoutTransactionId = payoutRow.id as string;

    // Step 6b: Sweep the payments into this payout transaction
    // Collect the exact booking IDs to ensure consistency
    const { data: bookingRows } = await adminClient
      .from('bookings')
      .select('id')
      .eq('trainer_id', trainerProfile.id);

    const bookingIds = (bookingRows ?? []).map((b: { id: string }) => b.id);

    if (bookingIds.length > 0) {
      const { error: sweepError } = await adminClient
        .from('payments')
        .update({ payout_transaction_id: payoutTransactionId })
        .eq('status', 'succeeded')
        .is('payout_transaction_id', null)
        .in('booking_id', bookingIds);

      if (sweepError) {
        // Rollback: mark payout as failed if we can't sweep
        await adminClient
          .from('payout_transactions')
          .update({ status: 'failed' })
          .eq('id', payoutTransactionId);

        return new Response(JSON.stringify({ error: 'Failed to link payments to payout' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Step 6c: Execute Stripe transfer
    let transfer: Stripe.Transfer;
    try {
      transfer = await stripe.transfers.create({
        amount: Math.round(balance * 100),
        currency: 'usd',
        destination: stripeAccountId,
        metadata: {
          trainer_id: trainerProfile.id,
          payout_transaction_id: payoutTransactionId,
        },
      });
    } catch (stripeErr) {
      // Step 6e: Stripe call failed — rollback
      const errorMessage =
        stripeErr instanceof Stripe.errors.StripeError ? stripeErr.message : 'Stripe transfer failed';
      const isInsufficientFunds =
        stripeErr instanceof Stripe.errors.StripeError &&
        stripeErr.code === 'insufficient_funds';

      // Rollback payout status and payment sweep
      await adminClient
        .from('payout_transactions')
        .update({ status: 'failed' })
        .eq('id', payoutTransactionId);

      await adminClient
        .from('payments')
        .update({ payout_transaction_id: null })
        .eq('payout_transaction_id', payoutTransactionId);

      return new Response(JSON.stringify({ error: errorMessage }), {
        status: isInsufficientFunds ? 402 : 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 6d: Update payout to 'processing' with transfer ID
    await adminClient
      .from('payout_transactions')
      .update({ status: 'processing', stripe_transfer_id: transfer.id })
      .eq('id', payoutTransactionId);

    // Step 7: Send initiation email (non-blocking — failure does not fail the payout)
    try {
      const { data: profileData } = await adminClient
        .from('profiles')
        .select('email')
        .eq('id', user.id)
        .single();

      const trainerEmail = profileData?.email as string | undefined;

      if (trainerEmail && resendApiKey) {
        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'FitRush <noreply@resend.dev>',
            to: [trainerEmail],
            subject: 'Your FitRush payout has been initiated',
            html: `<p>Your payout of $${balance.toFixed(2)} has been initiated. Funds expected within 2 business days.</p>`,
          }),
        });

        if (!emailRes.ok) {
          const errBody = await emailRes.text();
          console.warn('[create-payout] Resend email warning:', emailRes.status, errBody);
        }
      } else if (!resendApiKey) {
        console.log('[create-payout] No RESEND_API_KEY — skipping initiation email');
      }
    } catch (emailErr) {
      console.warn('[create-payout] Email send failed (non-blocking):', emailErr);
    }

    // Step 8: Return success
    return new Response(
      JSON.stringify({ success: true, amount: balance, transferId: transfer.id }),
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
