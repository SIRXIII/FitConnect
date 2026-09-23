import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LoaderCircle, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Props {
  bookingId: string;
  onConfirmed: () => void;
}

export function BookingConfirmation({ bookingId, onConfirmed }: Props) {
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<'checking' | 'pending' | 'cancelled'>('checking');

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let reads = 0;
    setStatus('checking');

    const check = async () => {
      reads += 1;
      try {
        const { data, error } = await supabase.from('bookings')
          .select('id, status').eq('id', bookingId).maybeSingle();
        if (cancelled) return;
        if (!error && data?.id === bookingId && data.status === 'confirmed') {
          onConfirmed();
          return;
        }
        if (!error && data?.status === 'cancelled') {
          setStatus('cancelled');
          return;
        }
      } catch {
        // A transient read failure must not turn a paid booking into a retry charge.
      }
      if (cancelled) return;
      if (reads >= 15) setStatus('pending');
      else timer = setTimeout(check, 1000);
    };
    void check();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [bookingId, attempt, onConfirmed]);

  return (
    <div className="space-y-6 text-center py-10" role="status" aria-live="polite">
      {status === 'checking' && <LoaderCircle className="animate-spin mx-auto" aria-hidden="true" />}
      <h2 className="text-xl font-medium">
        {status === 'checking' ? 'Confirming your booking' : status === 'cancelled' ? 'Booking unavailable' : 'Confirmation is taking longer'}
      </h2>
      <p className="text-sm text-ink/68">
        {status === 'cancelled'
          ? 'This booking was cancelled. Check your bookings and payment status before trying again.'
          : 'We are checking your saved booking. Please do not submit another payment.'}
      </p>
      {status === 'pending' && (
        <button type="button" className="inline-flex items-center gap-2 border border-ink/20 px-6 py-3" onClick={() => setAttempt((value) => value + 1)}>
          <RefreshCw size={16} aria-hidden="true" /> Check Status
        </button>
      )}
      <div><Link to="/client/bookings" className="underline">View My Bookings</Link></div>
    </div>
  );
}
