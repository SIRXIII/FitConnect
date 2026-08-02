import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import Stripe from 'npm:stripe@14.25.0';
import { requireEnv } from '../_shared/env.ts';

// 2026-08-01: synced from deployed v37 (repo copy had drifted), then added:
//   * RELEASE GATE — per-trainer recalculation only counts payments whose
//     booking is 'completed' (the top-level discovery scan stays broad; the
//     recalc is what determines the actual swept amount).
//   * payout_on_hold skip — trainers frozen by admin are excluded.

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

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

  const trainerBalances = new Map<string, number>();
  for (const row of eligibleRows ?? []) {
    const trainerId = (row.bookings as { trainer_id: string }).trainer_id;
    const current = trainerBalances.get(trainerId) ?? 0;
    trainerBalances.set(trainerId, current + Number(row.trainer_payout));
  }

  const eligibleTrainers = Array.from(trainerBalances.entries())
    .filter(([, balance]) => balance > 0)
    .map(([trainerId, balance]) => ({ trainerId, balance }));

  console.log(`[weekly-payouts] Found ${eligibleTrainers.length} candidate trainer(s)`);

  let processed = 0;
  let failed = 0;

  for (const { trainerId, balance } of eligibleTrainers) {
    console.log(`[weekly-payouts] Processing trainer ${trainerId} — candidate balance $${balance.toFixed(2)}`);

    try {
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

      const { data: trainerProfile } = await adminClient
        .from('trainer_profiles')
        .select('id, stripe_account_id, user_id, payout_on_hold')
        .eq('id', trainerId)
        .maybeSingle();

      if (!trainerProfile || !trainerProfile.stripe_account_id) {
        console.warn(`[weekly-payouts] Trainer ${trainerId} has no connected Stripe account — skipping`);
        continue;
      }

      if (trainerProfile.payout_on_hold) {
        console.log(`[weekly-payouts] Trainer ${trainerId} payouts are on hold — skipping`);
        continue;
      }

      const stripeAccountId = trainerProfile.stripe_account_id as string;

      // RELEASE GATE: only payments whose booking is 'completed' count toward
      // the payout. (Also inherently excludes cancelled/no_show — the
      // CANCEL-1/PAYOUT-2 exclusion.) Embedded-join form per the PAYOUT-1 fix.
      const { data: eligibleForTrainerRows, error: balanceError } = await adminClient
        .from('payments')
        .select('id, trainer_payout, bookings!inner(trainer_id, status)')
        .eq('bookings.trainer_id', trainerId)
        .eq('status', 'succeeded')
        .is('payout_transaction_id', null)
        .eq('bookings.status', 'completed');

      if (balanceError) {
        console.error(`[weekly-payouts] Failed to recalculate balance for trainer ${trainerId}:`, balanceError.message);
        failed++;
        continue;
      }

      const exactBalance = (eligibleForTrainerRows ?? []).reduce(
        (sum: number, row: { trainer_payout: number }) => sum + Number(row.trainer_payout),
        0
      );
      const eligiblePaymentIds = (eligibleForTrainerRows ?? []).map((row: { id: string }) => row.id);

      if (exactBalance <= 0) {
        console.log(`[weekly-payouts] Trainer ${trainerId} has no released (completed-session) balance — skipping`);
        continue;
      }

      let payoutRow: { id: string } | null = null;
      {
        const { data, error: insertError } = await adminClient
          .from('payout_transactions')
          .insert({
            trainer_id: trainerId,
            amount: exactBalance,
            status: 'pending',
            initiated_by: 'auto',
          })
          .select('id')
          .single();

        if (insertError) {
          // uniq_payout_active_per_trainer partial unique index — belt-and-suspenders
          // against the pre-insert maybeSingle() check above racing with a concurrent request.
          if ((insertError as { code?: string }).code === '23505') {
            console.log(`[weekly-payouts] Trainer ${trainerId} already has payout in progress (unique constraint) — skipping`);
            continue;
          }
          console.error(`[weekly-payouts] Failed to insert payout_transaction for trainer ${trainerId}:`, insertError.message);
          failed++;
          continue;
        }
        payoutRow = data;
      }
      if (!payoutRow) {
        failed++;
        continue;
      }

      const payoutTransactionId = payoutRow.id as string;

      // Sweep exactly the payment rows counted above — not a fresh "all trainer bookings" query.
      if (eligiblePaymentIds.length > 0) {
        // The IS NULL guard keeps a concurrent payout from re-claiming rows it
        // already swept, so a payment can only ever belong to one payout.
        const { error: sweepError } = await adminClient
          .from('payments')
          .update({ payout_transaction_id: payoutTransactionId })
          .in('id', eligiblePaymentIds)
          .is('payout_transaction_id', null);

        if (sweepError) {
          console.error(`[weekly-payouts] Failed to sweep payments for trainer ${trainerId}:`, sweepError.message);
          await adminClient
            .from('payments')
            .update({ payout_transaction_id: null })
            .eq('payout_transaction_id', payoutTransactionId);
          await adminClient
            .from('payout_transactions')
            .update({ status: 'failed' })
            .eq('id', payoutTransactionId);
          failed++;
          continue;
        }
      }

      // Post-sweep re-sum so payout_transactions.amount and the Stripe transfer
      // amount match exactly what got swept, not the pre-sweep balance estimate.
      const { data: sweptRows, error: sweptError } = await adminClient
        .from('payments')
        .select('trainer_payout')
        .eq('payout_transaction_id', payoutTransactionId);

      if (sweptError) {
        console.error(`[weekly-payouts] Failed to verify swept payments for trainer ${trainerId}:`, sweptError.message);
        // Release the swept payments back to the pool. Without this they stay
        // linked to a failed payout and no future payout can ever see them.
        await adminClient
          .from('payments')
          .update({ payout_transaction_id: null })
          .eq('payout_transaction_id', payoutTransactionId);
        await adminClient
          .from('payout_transactions')
          .update({ status: 'failed' })
          .eq('id', payoutTransactionId);
        failed++;
        continue;
      }

      const sweptAmount = (sweptRows ?? []).reduce(
        (sum: number, row: { trainer_payout: number }) => sum + Number(row.trainer_payout),
        0
      );

      if (sweptAmount <= 0) {
        console.log(`[weekly-payouts] Trainer ${trainerId} swept amount is zero — marking failed, skipping transfer`);
        await adminClient
          .from('payments')
          .update({ payout_transaction_id: null })
          .eq('payout_transaction_id', payoutTransactionId);
        await adminClient
          .from('payout_transactions')
          .update({ status: 'failed' })
          .eq('id', payoutTransactionId);
        failed++;
        continue;
      }

      await adminClient
        .from('payout_transactions')
        .update({ amount: sweptAmount })
        .eq('id', payoutTransactionId);

      let transfer: Stripe.Transfer;
      try {
        transfer = await stripe.transfers.create({
          amount: Math.round(sweptAmount * 100),
          currency: 'usd',
          destination: stripeAccountId,
          metadata: {
            trainer_id: trainerId,
            payout_transaction_id: payoutTransactionId,
          },
        }, { idempotencyKey: payoutTransactionId });
      } catch (stripeErr) {
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

      await adminClient
        .from('payout_transactions')
        .update({ status: 'processing', stripe_transfer_id: transfer.id })
        .eq('id', payoutTransactionId);

      console.log(`[weekly-payouts] Transfer created for trainer ${trainerId}: ${transfer.id}`);

      try {
        // profiles has no email column — the address lives in auth.users
        const { data: userData } = await adminClient.auth.admin.getUserById(trainerProfile.user_id);

        const trainerEmail = userData?.user?.email as string | undefined;

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
              html: `<p>Your weekly payout of $${sweptAmount.toFixed(2)} has been initiated. Funds expected within 2 business days.</p>`,
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
