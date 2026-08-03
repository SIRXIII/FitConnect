import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import ClientSummaryCard from '@/components/client/ClientSummaryCard';

interface BookingRequestCardProps {
  request: {
    id: string;
    client_id: string;
    slot_id: string;
    status: 'pending' | 'accepted' | 'declined';
    created_at: string;
    client?: {
      full_name: string;
      avatar_url: string | null;
    };
    slot?: {
      start_time: string;
      end_time: string;
    };
    client_profile?: {
      fitness_level: string | null;
      goals_ranked: string[];
      health_conditions: string[];
      intensity_preference: string | null;
      health_notes: string | null;
      age: number | null;
      weight_lbs: number | null;
      workout_types: string[];
    } | null;
  };
  onAccept: (requestId: string) => void;
  onDecline: (requestId: string) => void;
}

function getCountdownMinutes(createdAt: string): number {
  const expiresAt = new Date(createdAt).getTime() + 30 * 60 * 1000;
  const remaining = expiresAt - Date.now();
  return Math.max(0, Math.floor(remaining / 60000));
}

const BookingRequestCard: React.FC<BookingRequestCardProps> = ({
  request,
  onAccept,
  onDecline,
}) => {
  const [minutesLeft, setMinutesLeft] = useState(() =>
    getCountdownMinutes(request.created_at)
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setMinutesLeft(getCountdownMinutes(request.created_at));
    }, 60000);
    return () => clearInterval(interval);
  }, [request.created_at]);

  const clientName = request.client?.full_name || 'Client';
  const initials = clientName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const slotTime = request.slot
    ? (() => {
        const start = new Date(request.slot.start_time);
        const end = new Date(request.slot.end_time);
        return `${start.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        })} · ${start.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        })} – ${end.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        })}`;
      })()
    : null;

  const countdownColor =
    minutesLeft <= 5 ? 'text-red-600' : 'text-accent';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="bg-paper border border-ink/10 p-6 space-y-4"
    >
      {/* Client info */}
      <div className="flex items-center gap-3">
        {request.client?.avatar_url ? (
          <img
            src={request.client.avatar_url}
            alt={clientName}
            referrerPolicy="no-referrer"
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-ink/10 flex items-center justify-center text-xs font-medium text-ink/60">
            {initials}
          </div>
        )}
        <div className="space-y-0.5">
          <p className="text-base font-normal text-ink">{clientName}</p>
          {slotTime && (
            <p className="text-[10px] uppercase tracking-[0.15em] text-ink/60">
              {slotTime}
            </p>
          )}
        </div>
      </div>

      {/* Client profile summary */}
      <ClientSummaryCard
        data={request.client_profile ? {
          ...request.client_profile,
          primary_goal: request.client_profile.goals_ranked?.[0] ?? null,
        } : null}
      />

      {/* Auto-decline countdown */}
      <p className={`text-[10px] uppercase tracking-[0.15em] font-medium ${countdownColor}`}>
        Auto-declines in {minutesLeft} min
      </p>

      {/* Actions */}
      <div className="flex flex-col gap-2">
        <button
          onClick={() => onAccept(request.id)}
          className="bg-ink text-white w-full min-h-[44px] text-[10px] uppercase tracking-[0.2em] font-medium hover:bg-accent transition-all duration-300"
        >
          Accept
        </button>
        <button
          onClick={() => onDecline(request.id)}
          className="border border-ink/10 text-ink/40 hover:text-ink w-full min-h-[44px] text-[10px] uppercase tracking-[0.2em] font-medium transition-all duration-300"
        >
          Decline
        </button>
      </div>
    </motion.div>
  );
};

export default BookingRequestCard;
