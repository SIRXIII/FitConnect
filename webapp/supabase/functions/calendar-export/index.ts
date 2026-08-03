import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { corsHeaders } from '../_shared/cors.ts';
import { requireEnv } from '../_shared/env.ts';

function toICalDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

interface BookingRow {
  id: string;
  notes: string | null;
  status: string;
  availability_slots: { start_time: string; end_time: string } | null;
  profiles: { full_name: string } | null;
}

function buildICS(
  trainerName: string,
  bookings: BookingRow[],
): string {
  const now = toICalDate(new Date());

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FitRush//Calendar Export//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:FitRush - ${trainerName}`,
  ];

  for (const booking of bookings) {
    const slot = booking.availability_slots;
    if (!slot) continue;

    const dtStart = toICalDate(new Date(slot.start_time));
    const dtEnd = toICalDate(new Date(slot.end_time));
    const clientName = booking.profiles?.full_name || 'Client';
    const icalStatus = booking.status === 'confirmed' ? 'CONFIRMED' : 'TENTATIVE';

    let description = `Status: ${booking.status}`;
    if (booking.notes) {
      description += `\\nNotes: ${booking.notes}`;
    }

    lines.push(
      'BEGIN:VEVENT',
      `UID:${booking.id}@fitrush.app`,
      `DTSTAMP:${now}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:FitRush Session - ${clientName}`,
      `DESCRIPTION:${description}`,
      `STATUS:${icalStatus}`,
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = requireEnv('SUPABASE_URL');
    const supabaseServiceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing token parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    // Look up trainer by calendar_export_token
    const { data: trainer, error: trainerError } = await adminClient
      .from('trainer_profiles')
      .select('id, user_id, profiles!trainer_profiles_user_id_fkey(full_name)')
      .eq('calendar_export_token', token)
      .maybeSingle();

    if (trainerError || !trainer) {
      return new Response(JSON.stringify({ error: 'Trainer not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const trainerName = (trainer.profiles as { full_name: string } | null)?.full_name || 'Trainer';

    // Query bookings for this trainer (past week onward)
    const oneWeekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data: bookings, error: bookingsError } = await adminClient
      .from('bookings')
      .select(
        'id, notes, status, availability_slots!bookings_slot_id_fkey(start_time, end_time), profiles!bookings_client_id_fkey(full_name)',
      )
      .eq('trainer_id', trainer.id)
      .in('status', ['confirmed', 'pending'])
      .gte('availability_slots.start_time', oneWeekAgo);

    if (bookingsError) {
      return new Response(JSON.stringify({ error: 'Failed to fetch bookings' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const icsContent = buildICS(trainerName, (bookings || []) as unknown as BookingRow[]);

    return new Response(icsContent, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="fitrush-schedule.ics"',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
