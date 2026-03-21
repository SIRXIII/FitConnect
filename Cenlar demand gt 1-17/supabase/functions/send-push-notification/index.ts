import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { corsHeaders } from '../_shared/cors.ts';
import { requireEnv } from '../_shared/env.ts';

// Firebase Admin SDK — Deno-compatible via npm: specifier
import { initializeApp, getApps, cert } from 'npm:firebase-admin/app';
import { getMessaging } from 'npm:firebase-admin/messaging';

interface SendPushRequest {
  user_ids: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}

interface PushSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  device_token: string | null;
  platform: 'web' | 'ios';
}

/** Initialise Firebase Admin SDK once per worker lifetime. */
function ensureFirebaseInitialized(): void {
  if (getApps().length > 0) return;

  const projectId = Deno.env.get('FIREBASE_PROJECT_ID');
  const clientEmail = Deno.env.get('FIREBASE_CLIENT_EMAIL');
  // Private key is stored with literal \n — convert to real newlines
  const privateKey = Deno.env.get('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Missing Firebase credentials. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in Supabase secrets.'
    );
  }

  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
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
    const supabaseServiceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

    const body = (await req.json().catch(() => ({}))) as Partial<SendPushRequest>;
    const { user_ids, title, body: messageBody, data } = body;

    if (!user_ids?.length || !title || !messageBody) {
      return new Response(
        JSON.stringify({ error: 'user_ids, title, and body are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    // Fetch all push subscriptions for the given user_ids
    const { data: subscriptions, error: subError } = await adminClient
      .from('push_subscriptions')
      .select('id, user_id, endpoint, device_token, platform')
      .in('user_id', user_ids);

    if (subError) {
      return new Response(JSON.stringify({ error: subError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!subscriptions?.length) {
      return new Response(
        JSON.stringify({ sent: 0, failed: 0, message: 'No subscriptions found for these users' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    ensureFirebaseInitialized();
    const messaging = getMessaging();

    let sent = 0;
    let failed = 0;
    const staleIds: string[] = [];

    await Promise.allSettled(
      (subscriptions as PushSubscription[]).map(async (sub) => {
        const token = sub.device_token ?? sub.endpoint;

        try {
          const message =
            sub.platform === 'ios'
              ? {
                  token,
                  notification: { title, body: messageBody },
                  apns: {
                    payload: {
                      aps: { sound: 'default', badge: 1 },
                    },
                    fcmOptions: {},
                  },
                  data: data ?? {},
                }
              : {
                  token,
                  notification: { title, body: messageBody },
                  webpush: {
                    notification: {
                      title,
                      body: messageBody,
                      icon: '/icon-192.png',
                      badge: '/icon-192.png',
                    },
                    fcmOptions: { link: '/' },
                  },
                  data: data ?? {},
                };

          await messaging.send(message);
          sent++;
        } catch (err: unknown) {
          failed++;
          const errorCode =
            err && typeof err === 'object' && 'errorInfo' in err
              ? (err as { errorInfo: { code: string } }).errorInfo.code
              : '';

          if (errorCode === 'messaging/registration-token-not-registered') {
            staleIds.push(sub.id);
          } else {
            console.error(`[send-push-notification] Failed for token ${token}:`, err);
          }
        }
      })
    );

    // Clean up stale subscriptions (fire-and-forget)
    if (staleIds.length > 0) {
      adminClient
        .from('push_subscriptions')
        .delete()
        .in('id', staleIds)
        .then(() => {
          console.log(`[send-push-notification] Removed ${staleIds.length} stale subscription(s)`);
        })
        .catch((e: unknown) => {
          console.error('[send-push-notification] Failed to remove stale subscriptions:', e);
        });
    }

    return new Response(JSON.stringify({ sent, failed }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
