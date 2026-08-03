import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { aggregateByWeek } from '@/lib/sessionAggregation';
import type { SessionLogForChart } from '@/lib/sessionAggregation';

// ============================================================
// Types
// ============================================================

interface SessionEntry {
  id: string;
  notes: string | null;
  exercises: { name: string; sets: number; reps: number }[];
  slot_start: string | null;
  slot_end: string | null;
  trainer_name: string | null;
}

// ============================================================
// Props
// ============================================================

interface ProgressTabProps {
  userId: string;
}

// ============================================================
// Component
// ============================================================

const ProgressTab: React.FC<ProgressTabProps> = ({ userId }) => {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<SessionEntry[]>([]);

  useEffect(() => {
    const fetchSessions = async () => {
      setLoading(true);

      // Attempt nested join query
      const { data, error } = await (supabase as any)
        .from('session_logs')
        .select(`
          id, notes, exercises,
          bookings!session_logs_booking_id_fkey (
            availability_slots!bookings_slot_id_fkey (start_time, end_time),
            trainer_profiles!bookings_trainer_id_fkey (
              profiles!trainer_profiles_user_id_fkey (full_name)
            )
          )
        `)
        .eq('client_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        // Fallback: two-query approach
        const { data: logs } = await (supabase as any)
          .from('session_logs')
          .select('id, booking_id, notes, exercises, created_at')
          .eq('client_id', userId)
          .order('created_at', { ascending: false });

        if (!logs || logs.length === 0) {
          setSessions([]);
          setLoading(false);
          return;
        }

        const bookingIds = logs.map((l: any) => l.booking_id);
        const { data: bookingsData } = await (supabase as any)
          .from('bookings')
          .select(`
            id,
            availability_slots!bookings_slot_id_fkey (start_time, end_time),
            trainer_profiles!bookings_trainer_id_fkey (
              profiles!trainer_profiles_user_id_fkey (full_name)
            )
          `)
          .in('id', bookingIds);

        const bookingMap = new Map((bookingsData ?? []).map((b: any) => [b.id, b]));

        const merged: SessionEntry[] = logs.map((log: any) => {
          const booking = bookingMap.get(log.booking_id) as any;
          return {
            id: log.id,
            notes: log.notes ?? null,
            exercises: Array.isArray(log.exercises) ? log.exercises : [],
            slot_start: booking?.availability_slots?.start_time ?? null,
            slot_end: booking?.availability_slots?.end_time ?? null,
            trainer_name: booking?.trainer_profiles?.profiles?.full_name ?? null,
          };
        });

        setSessions(merged);
        setLoading(false);
        return;
      }

      // Parse nested join result
      const parsed: SessionEntry[] = (data ?? []).map((row: any) => {
        const booking = row.bookings ?? {};
        const slot = booking.availability_slots ?? {};
        const trainerProfile = booking.trainer_profiles ?? {};
        const profile = trainerProfile.profiles ?? {};
        return {
          id: row.id,
          notes: row.notes ?? null,
          exercises: Array.isArray(row.exercises) ? row.exercises : [],
          slot_start: slot.start_time ?? null,
          slot_end: slot.end_time ?? null,
          trainer_name: profile.full_name ?? null,
        };
      });

      setSessions(parsed);
      setLoading(false);
    };

    fetchSessions();
  }, [userId]);

  // ---- Loading skeleton ----
  if (loading) {
    return (
      <div className="animate-pulse space-y-4 py-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-4 items-start border-b border-ink/5 py-4">
            <div className="w-20 h-4 bg-ink/5 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/3 bg-ink/5" />
              <div className="h-3 w-2/3 bg-ink/5" />
              <div className="h-3 w-1/4 bg-ink/5" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ---- Empty state ----
  if (sessions.length === 0) {
    return (
      <div className="border border-dashed border-ink/10 p-12 text-center">
        <h2 className="text-xl serif font-light italic text-ink mb-2">No sessions yet</h2>
        <p className="text-sm text-ink/40">
          Your training history will appear here after your first completed session.
        </p>
        <Link
          to="/trainers"
          className="text-xs uppercase tracking-[0.2em] text-accent hover:text-accent/70 mt-4 inline-block"
        >
          Browse Trainers
        </Link>
      </div>
    );
  }

  // ---- Chart data ----
  const logsForChart: SessionLogForChart[] = sessions
    .filter((s) => s.slot_start !== null)
    .map((s) => ({
      slot_start: s.slot_start!,
      exercises: s.exercises,
    }));

  // Filter to last 12 weeks
  const twelveWeeksAgo = new Date();
  twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);
  const recentLogs = logsForChart.filter(
    (l) => new Date(l.slot_start) >= twelveWeeksAgo
  );

  const weeklyData = aggregateByWeek(recentLogs);

  return (
    <div className="space-y-8">
      {/* ---- Section 1: Session Timeline List ---- */}
      <div>
        {sessions.map((session) => {
          const dateLabel = session.slot_start
            ? new Date(session.slot_start).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })
            : '—';
          const exerciseCount = session.exercises.length;
          const exerciseLabel =
            exerciseCount === 1 ? '1 exercise' : `${exerciseCount} exercises`;

          return (
            <div key={session.id} className="flex gap-4 items-start border-b border-ink/5 py-4">
              {/* Date column */}
              <p className="text-xs text-ink/40 w-20 shrink-0 pt-0.5">{dateLabel}</p>

              {/* Content column */}
              <div className="flex-1">
                <p className="text-sm font-medium text-ink">
                  {session.trainer_name ?? 'Unknown Trainer'}
                </p>
                {session.notes && (
                  <p className="text-sm text-ink/60 mt-1 line-clamp-2">{session.notes}</p>
                )}
                <p className="text-xs text-ink/30 mt-1">{exerciseLabel}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ---- Section 2: Progress Chart ---- */}
      {weeklyData.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-ink/40 mb-4">Training Trends</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={weeklyData}>
              <XAxis
                dataKey="week"
                tick={{ fontSize: 12, fill: 'rgba(26,26,26,0.4)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide={true} />
              <Tooltip
                contentStyle={{
                  background: '#FDFCFB',
                  border: '1px solid rgba(26,26,26,0.1)',
                  fontSize: 12,
                  padding: 8,
                }}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 12, color: 'rgba(26,26,26,0.4)' }}
              />
              <Line
                type="monotone"
                dataKey="sessions"
                stroke="#C5A059"
                strokeWidth={1.5}
                dot={false}
                name="Sessions / week"
              />
              <Line
                type="monotone"
                dataKey="sets"
                stroke="rgba(45,45,45,0.4)"
                strokeWidth={1.5}
                dot={false}
                name="Sets / week"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default ProgressTab;
