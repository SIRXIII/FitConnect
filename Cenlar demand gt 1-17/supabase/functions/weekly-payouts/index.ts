import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import Stripe from 'npm:stripe@14.25.0';
import { requireEnv } from '../_shared/env.ts';

// weekly-payouts — System Edge Function
// Called by pg_cron via net.http_post with service role key in Authorization header.
// Iterates all trainers with available balance >= $50 and initiates Stripe transfers.
// NOT intended for direct user invocation.

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Auth: validate service role key in Authorization header.
  // pg_cron calls this with 'Bearer <service_role_key>'.
  const supabaseUrl = requireEnv('SUPABASE_URL');
  const supabaseServiceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const stripeSecretKey = requireEnv('STRIPE_SECRET_KEY');
  const resendApiKey = Deno.env.get('RESEND_API_KEY');

  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();

  if (token !== supabaseServiceRoleKey) {
    console.error('[weekly-payouts] Unauthorized: invalid service role key');
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient(),
  });

  // Step 1: Find all eligible trainers (balance >= $50, no swept payments)
  // Group payments by trainer via bookings, sum trainer_payout for unswept succeeded payments.
  const { data: eligibleRows, error: eligibleError } = await adminClient
    .from('payments')
    .select('booking_id, trainer_payout, bookings!inner(trainer_id)')
    .eq('status', 'succeeded')
    .is('payout_transaction_id', null);

  if (eligibleError) {
    console.error('[weekly-payouts] Failed to query eligible payments:', eligibleError.message);
    return new Response(JSON.stringify({ error: 'Failed to query eligible payments' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Aggregate balance per trainer
  const trainerBalances = new Map<string, number>();
  for (const row of eligibleRows ?? []) {
    const trainerId = (row.bookings as { trainer_id: string }).trainer_id;
    const current = trainerBalances.get(trainerId) ?? 0;
    trainerBalances.set(trainerId, current + Number(row.trainer_payout));
  }

  // Filter to trainers with balance >= $50
  const eligibleTrainers = Array.from(trainerBalances.entries())
    .filter(([, balance]) => balance >= 50)
    .map(([trainerId, balance]) => ({ trainerId, balance }));

  console.log(`[weekly-payouts] Found ${eligibleTrainers.length} eligible trainer(s)`);

  let processed = 0;
  let failed = 0;

  for (const { trainerId, balance } of eligibleTrainers) {
    console.log(`[weekly-payouts] Processing trainer ${trainerId} — balance $${balance.toFixed(2)}`);

    try {
      // Step 2a: Guard — skip if a pending/processing payout already exists
      const { data: existingPayout } = await adminClient
        .from('payout_transactions')
        .select('id')
        .eq('trainer_id', trainerId)
        .in('status', ['pending', 'processing'])
        .maybeSingle();

      if (existingPayout) {
        console.log(`[weekly-payouts] Trainer ${trainerId} already has payout in progress — skipping`);
        continue;
      }

      // Step 2b: Fetch trainer's stripe_account_id
      const { data: trainerProfile } = await adminClient
        .from('trainer_profiles')
        .select('id, stripe_account_id, user_id')
        .eq('id', trainerId)
        .maybeSingle();

      if (!trainerProfile || !trainerProfile.stripe_account_id) {
        console.warn(`[weekly-payouts] Trainer ${trainerId} has no connected Stripe account — skipping`);
        continue;
      }

      const stripeAccountId = trainerProfile.stripe_account_id as string;

      // Step 2c: Recalculate exact balance at time of execution (race-condition safe)
      const { data: balanceRows, error: balanceError } = await adminClient
        .from('payments')
        .select('trainer_payout')
        .eq('status', 'succeeded')
        .is('payout_transaction_id', null)
        .in(
          'booking_id',
          adminClient.from('bookings').select('id').eq('trainer_id', trainerId)
        );

      if (balanceError) {
        console.error(`[weekly-payouts] Failed to recalculate balance for trainer ${trainerId}:`, balanceError.message);
        failed++;
        continue;
      }

      const exactBalance = (balanceRows ?? []).reduce(
        (sum: number, row: { trainer_payout: number }) => sum + Number(row.trainer_payout),
        0
      );

      if (exactBalance < 50) {
        // Balance changed between aggregation and recalc (race condition)
        console.log(`[weekly-payouts] Trainer ${trainerId} balance dropped below $50 after recalc — skipping`);
        continue;
      }

      // Step 2d: Insert payout_transactions row (pending, initiated_by: 'auto')
      const { data: payoutRow, error: insertError } = await adminClient
        .from('payout_transactions')
        .insert({
          trainer_id: trainerId,
          amount: exactBalance,
          status: 'pending',
          initiated_by: 'auto',
        })
        .select('id')
        .single();

      if (insertError || !payoutRow) {
        console.error(`[weekly-payouts] Failed to insert payout_transaction for trainer ${trainerId}:`, insertError?.message);
        failed++;
        continue;
      }

      const payoutTransactionId = payoutRow.id as string;

      // Step 2e: Sweep payments — link them to this payout_transaction
      const { data: bookingRows } = await adminClient
        .from('bookings')
        .select('id')
        .eq('trainer_id', trainerId);

      const bookingIds = (bookingRows ?? []).map((b: { id: string }) => b.id);

      if (bookingIds.length > 0) {
        const { error: sweepError } = await adminClient
          .from('payments')
          .update({ payout_transaction_id: payoutTransactionId })
          .eq('status', 'succeeded')
          .is('payout_transaction_id', null)
          .in('booking_id', bookingIds);

        if (sweepError) {
          console.error(`[weekly-payouts] Failed to sweep payments for trainer ${trainerId}:`, sweepError.message);
          await adminClient
            .from('payout_transactions')
            .update({ status: 'failed' })
            .eq('id', payoutTransactionId);
          failed++;
          continue;
        }
      }

      // Step 2f: Create Stripe transfer
      let transfer: Stripe.Transfer;
      try {
        transfer = await stripe.transfers.create({
          amount: Math.round(exactBalance * 100),
          currency: 'usd',
          destination: stripeAccountId,
          metadata: {
            trainer_id: trainerId,
            payout_transaction_id: payoutTransactionId,
          },
        });
      } catch (stripeErr) {
        // Step 2h: Stripe error — mark failed, reset payments, continue loop
        console.error(
          `[weekly-payouts] Stripe transfer failed for trainer ${trainerId}:`,
          stripeErr instanceof Error ? stripeErr.message : stripeErr
        );

        await adminClient
          .from('payout_transactions')
          .update({ status: 'failed' })
          .eq('id', payoutTransactionId);

        await adminClient
          .from('payments')
          .update({ payout_transaction_id: null })
          .eq('payout_transaction_id', payoutTransactionId);

        failed++;
        continue;
      }

      // Step 2g: Update payout to 'processing' with transfer ID
      await adminClient
        .from('payout_transactions')
        .update({ status: 'processing', stripe_transfer_id: transfer.id })
        .eq('id', payoutTransactionId);

      console.log(`[weekly-payouts] Transfer created for trainer ${trainerId}: ${transfer.id}`);

      // Step 2i: Send initiation email (non-blocking)
      try {
        const { data: profileData } = await adminClient
          .from('profiles')
          .select('email')
          .eq('id', trainerProfile.user_id)
          .maybeSingle();

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
              html: `<p>Your weekly payout of $${exactBalance.toFixed(2)} has been initiated. Funds expected within 2 business days.</p>`,
            }),
          });

          if (!emailRes.ok) {
            const errBody = await emailRes.text();
            console.warn(`[weekly-payouts] Resend warning for trainer ${trainerId}:`, emailRes.status, errBody);
          }
        } else if (!resendApiKey) {
          console.log('[weekly-payouts] No RESEND_API_KEY — skipping initiation email');
        }
      } catch (emailErr) {
        console.warn(`[weekly-payouts] Email failed for trainer ${trainerId} (non-blocking):`, emailErr);
      }

      processed++;
    } catch (err) {
      console.error(`[weekly-payouts] Unexpected error for trainer ${trainerId}:`, err instanceof Error ? err.message : err);
      failed++;
    }
  }

  console.log(`[weekly-payouts] Complete — processed: ${processed}, failed: ${failed}`);

  return new Response(
    JSON.stringify({ processed, failed }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
});
