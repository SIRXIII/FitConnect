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
    const supabaseServiceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    const stripeSecretKey = requireEnv('STRIPE_SECRET_KEY');
    const billingWebhookSecret = requireEnv('STRIPE_BILLING_WEBHOOK_SECRET');

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // MUST use req.text() — not req.json() — or HMAC signature verification breaks
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      return new Response(JSON.stringify({ error: 'Missing stripe-signature header' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Uses STRIPE_BILLING_WEBHOOK_SECRET (different endpoint/secret from stripe-webhook)
    const event = stripe.webhooks.constructEvent(body, signature, billingWebhookSecret);

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    // Price ID → subscription tier lookup map
    const TIER_FROM_PRICE: Record<string, 'pro' | 'elite'> = {
      [Deno.env.get('STRIPE_PRICE_PRO_MONTHLY')!]:   'pro',
      [Deno.env.get('STRIPE_PRICE_PRO_YEARLY')!]:    'pro',
      [Deno.env.get('STRIPE_PRICE_ELITE_MONTHLY')!]: 'elite',
      [Deno.env.get('STRIPE_PRICE_ELITE_YEARLY')!]:  'elite',
    };

    // Resolve trainer by Stripe customer ID
    const resolveTrainer = async (customerId: string) => {
      const { data } = await adminClient
        .from('trainer_profiles')
        .select('id, subscription_status')
        .eq('stripe_customer_id', customerId)
        .maybeSingle();
      return data;
    };

    // Insert idempotency record — returns error so caller can check for 23505
    const recordEvent = async (trainerId: string, eventType: string, payload: unknown) => {
      const { error } = await adminClient.from('subscription_events').insert({
        trainer_id: trainerId,
        stripe_event_id: event.id,
        event_type: eventType,
        payload,
      });
      return error;
    };

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;

        const trainer = await resolveTrainer(customerId);
        if (!trainer) {
          console.log(`[stripe-billing-webhook] Unknown customer ${customerId} — skipping`);
          break;
        }

        const insertError = await recordEvent(trainer.id, event.type, sub);
        if (insertError?.code === '23505') {
          // Duplicate event — already processed
          console.log(`[stripe-billing-webhook] Duplicate event ${event.id} — skipping`);
          return new Response(JSON.stringify({ received: true }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const priceId = sub.items.data[0]?.price?.id ?? '';
        const tier = TIER_FROM_PRICE[priceId] ?? 'free';
        const interval = sub.items.data[0]?.price?.recurring?.interval ?? null;

        await adminClient
          .from('trainer_profiles')
          .update({
            subscription_tier: tier,
            subscription_status: sub.status,
            subscription_id: sub.id,
            subscription_interval: interval,
            trial_ends_at: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
            current_period_end: new Date((sub.current_period_end as number) * 1000).toISOString(),
            cancel_at_period_end: sub.cancel_at_period_end,
          })
          .eq('stripe_customer_id', customerId);

        console.log(`[stripe-billing-webhook] ${event.type}: synced subscription for customer ${customerId}, tier=${tier}, status=${sub.status}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;

        const trainer = await resolveTrainer(customerId);
        if (!trainer) {
          console.log(`[stripe-billing-webhook] Unknown customer ${customerId} — skipping`);
          break;
        }

        const insertError = await recordEvent(trainer.id, event.type, sub);
        if (insertError?.code === '23505') {
          console.log(`[stripe-billing-webhook] Duplicate event ${event.id} — skipping`);
          return new Response(JSON.stringify({ received: true }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        await adminClient
          .from('trainer_profiles')
          .update({
            subscription_tier: 'free',
            subscription_status: 'canceled',
            subscription_id: null,
            cancel_at_period_end: false,
            trial_ends_at: null,
          })
          .eq('stripe_customer_id', customerId);

        console.log(`[stripe-billing-webhook] subscription.deleted: downgraded customer ${customerId} to free`);
        break;
      }

      case 'customer.subscription.trial_will_end': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;

        const trainer = await resolveTrainer(customerId);
        if (!trainer) {
          console.log(`[stripe-billing-webhook] Unknown customer ${customerId} — skipping trial email`);
          break;
        }

        // Email only — no DB write
        const { data: profile } = await adminClient
          .from('profiles')
          .select('email')
          .eq('id', trainer.id)
          .maybeSingle();

        const trainerEmail = profile?.email;
        const resendApiKey = Deno.env.get('RESEND_API_KEY');

        if (!resendApiKey) {
          console.log(`[stripe-billing-webhook] No RESEND_API_KEY — skipping trial-end email for customer ${customerId}`);
          break;
        }

        if (!trainerEmail) {
          console.log(`[stripe-billing-webhook] No email found for trainer ${trainer.id} — skipping trial-end email`);
          break;
        }

        const trialEndDate = sub.trial_end
          ? new Date(sub.trial_end * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
          : 'soon';

        const appUrl = Deno.env.get('APP_URL') ?? 'https://app.fitrush.io';
        const portalLink = `${appUrl}/trainer/dashboard?tab=subscription`;

        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'FitRush <noreply@resend.dev>',
            to: [trainerEmail],
            subject: 'Your FitRush trial ends in 3 days',
            html: `
              <p>Hi there,</p>
              <p>Your FitRush Pro trial ends on <strong>${trialEndDate}</strong>.</p>
              <p>Add a payment method to keep your Pro features and continue growing your training business.</p>
              <p><a href="${portalLink}" style="background:#4f46e5;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Manage Subscription</a></p>
              <p>If you have any questions, reply to this email and we'll help you out.</p>
              <p>— The FitRush Team</p>
            `,
          }),
        }).catch((err: unknown) => console.error('[stripe-billing-webhook] Resend error:', err));

        console.log(`[stripe-billing-webhook] trial_will_end: queued email to ${trainerEmail}`);
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        const trainer = await resolveTrainer(customerId);
        if (!trainer) {
          console.log(`[stripe-billing-webhook] Unknown customer ${customerId} — skipping`);
          break;
        }

        const insertError = await recordEvent(trainer.id, event.type, invoice);
        if (insertError?.code === '23505') {
          console.log(`[stripe-billing-webhook] Duplicate event ${event.id} — skipping`);
          return new Response(JSON.stringify({ received: true }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const periodEnd = invoice.lines?.data?.[0]?.period?.end;
        const updatePayload: Record<string, unknown> = {
          subscription_status: 'active',
        };
        if (periodEnd) {
          updatePayload.current_period_end = new Date(periodEnd * 1000).toISOString();
        }

        await adminClient
          .from('trainer_profiles')
          .update(updatePayload)
          .eq('stripe_customer_id', customerId);

        console.log(`[stripe-billing-webhook] invoice.paid: set status=active for customer ${customerId}`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        const trainer = await resolveTrainer(customerId);
        if (!trainer) {
          console.log(`[stripe-billing-webhook] Unknown customer ${customerId} — skipping`);
          break;
        }

        const insertError = await recordEvent(trainer.id, event.type, invoice);
        if (insertError?.code === '23505') {
          console.log(`[stripe-billing-webhook] Duplicate event ${event.id} — skipping`);
          return new Response(JSON.stringify({ received: true }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // BILL-07: Only downgrade active subscribers — trialing trainers are unaffected
        if (trainer.subscription_status === 'active') {
          await adminClient
            .from('trainer_profiles')
            .update({
              subscription_tier: 'free',
              subscription_status: 'past_due',
            })
            .eq('stripe_customer_id', customerId);

          console.log(`[stripe-billing-webhook] invoice.payment_failed: downgraded active customer ${customerId} to past_due`);
        } else {
          console.log(`[stripe-billing-webhook] invoice.payment_failed: customer ${customerId} status=${trainer.subscription_status} — no downgrade (trialing or already downgraded)`);
        }
        break;
      }

      default:
        break;
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
