import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { requireEnv } from './env.ts';

// ─── Types ───────────────────────────────────────────────────────────────────

interface GcalConnectionInput {
  trainer_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

interface GcalEventInput {
  summary: string;
  description: string;
  location?: string;
  start: string;
  end: string;
}

interface GcalEventItem {
  id: string;
  summary?: string;
  start: { dateTime?: string };
  end: { dateTime?: string };
}

// ─── Token Refresh ────────────────────────────────────────────────────────────

/**
 * Returns a valid access token for the given GCal connection.
 * If the token is expired, refreshes it via Google's OAuth2 token endpoint
 * and updates the google_calendar_connections row in Supabase.
 * On invalid_grant (revoked token), sets is_active=false and throws.
 */
export async function getValidAccessToken(
  connection: GcalConnectionInput,
  adminClient: ReturnType<typeof createClient>,
): Promise<string> {
  const expiresAt = new Date(connection.expires_at).getTime();
  const nowMs = Date.now();

  // Add a 60-second buffer to avoid using an about-to-expire token
  if (expiresAt > nowMs + 60_000) {
    return connection.access_token;
  }

  // Token is expired or nearly expired — refresh it
  const clientId = requireEnv('GOOGLE_CLIENT_ID');
  const clientSecret = requireEnv('GOOGLE_CLIENT_SECRET');

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: connection.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  const data = await resp.json();

  if (!resp.ok || data.error) {
    if (data.error === 'invalid_grant') {
      // Token has been revoked by the user — mark connection inactive
      await adminClient
        .from('google_calendar_connections')
        .update({
          is_active: false,
          disconnected_reason: 'token_revoked',
          updated_at: new Date().toISOString(),
        })
        .eq('trainer_id', connection.trainer_id);

      throw new Error('gcal_token_revoked');
    }
    throw new Error(`Token refresh failed: ${data.error ?? resp.status}`);
  }

  const newAccessToken: string = data.access_token;
  const newExpiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

  // Persist refreshed token
  await adminClient
    .from('google_calendar_connections')
    .update({
      access_token: newAccessToken,
      expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('trainer_id', connection.trainer_id);

  return newAccessToken;
}

// ─── Retry Helper ─────────────────────────────────────────────────────────────

/**
 * Retries fn() up to maxAttempts times with exponential backoff (1s, 2s, 4s...).
 * Rethrows on the final attempt.
 */
export async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxAttempts - 1) {
        throw err;
      }
      const delayMs = Math.pow(2, attempt) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  // Unreachable — satisfies TypeScript
  throw new Error('withRetry: exhausted attempts');
}

// ─── GCal CRUD ────────────────────────────────────────────────────────────────

/**
 * Creates a Google Calendar event on the user's primary calendar.
 * Tags it with extendedProperties.private.source = 'fitrush' to identify
 * FitRush-created events and prevent infinite sync loops (Pitfall 4).
 * Returns the newly created event ID.
 */
export async function createGcalEvent(
  accessToken: string,
  event: GcalEventInput,
): Promise<string> {
  const body: Record<string, unknown> = {
    summary: event.summary,
    description: event.description,
    start: { dateTime: event.start },
    end: { dateTime: event.end },
    extendedProperties: {
      private: { source: 'fitrush' },
    },
  };

  if (event.location) {
    body.location = event.location;
  }

  const resp = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`createGcalEvent failed (${resp.status}): ${err}`);
  }

  const created = await resp.json();
  return created.id as string;
}

/**
 * Deletes a Google Calendar event by ID.
 * Silently ignores 404/410 (event already deleted or not found).
 */
export async function deleteGcalEvent(accessToken: string, eventId: string): Promise<void> {
  const resp = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (resp.status === 404 || resp.status === 410) {
    // Event already gone — treat as success
    return;
  }

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`deleteGcalEvent failed (${resp.status}): ${err}`);
  }
}

/**
 * Lists Google Calendar events within a time window.
 * Filters OUT events created by FitRush (source=fitrush) to prevent
 * FitRush booking blocks from blocking FitRush availability slots (Pitfall 4).
 * Returns up to 250 events.
 */
export async function listGcalEvents(
  accessToken: string,
  timeMin: string,
  timeMax: string,
): Promise<GcalEventItem[]> {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
    privateExtendedProperty: 'source!=fitrush',
  });

  const resp = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`listGcalEvents failed (${resp.status}): ${err}`);
  }

  const data = await resp.json();
  return (data.items ?? []) as GcalEventItem[];
}
