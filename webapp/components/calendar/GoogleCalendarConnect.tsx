import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Calendar, Loader2 } from 'lucide-react';
import { useGcalConnection } from '@/hooks/useGcalConnection';

interface GoogleCalendarConnectProps {
  trainerId: string;
}

const GoogleCalendarConnect: React.FC<GoogleCalendarConnectProps> = ({ trainerId }) => {
  const { connection, loading, connecting, disconnecting, connect, disconnect } =
    useGcalConnection(trainerId || undefined);

  const listenerRef = useRef<((event: MessageEvent) => void) | null>(null);

  // Clean up postMessage listener on unmount
  useEffect(() => {
    return () => {
      if (listenerRef.current) {
        window.removeEventListener('message', listenerRef.current);
        listenerRef.current = null;
      }
    };
  }, []);

  const handleConnect = () => {
    // Generate CSRF state and store in sessionStorage
    const state = crypto.randomUUID();
    sessionStorage.setItem('gcal_oauth_state', state);

    const params = new URLSearchParams({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      redirect_uri: window.location.origin + '/auth/google-callback',
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/calendar.events',
      access_type: 'offline',
      prompt: 'consent', // CRITICAL: ensures refresh_token is always returned (Pitfall 1)
      state,
    });

    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    window.open(url, 'googleCalendarAuth', 'menubar=no,toolbar=no,width=500,height=600');

    // Clean up any existing listener before adding a new one
    if (listenerRef.current) {
      window.removeEventListener('message', listenerRef.current);
    }

    const listener = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (!event.data?.code) return;

      // Verify CSRF state
      const savedState = sessionStorage.getItem('gcal_oauth_state');
      if (!savedState || event.data.state !== savedState) {
        toast.error('OAuth state mismatch — please try again');
        window.removeEventListener('message', listener);
        listenerRef.current = null;
        return;
      }

      sessionStorage.removeItem('gcal_oauth_state');
      window.removeEventListener('message', listener);
      listenerRef.current = null;

      try {
        await connect(event.data.code);
        toast.success('Google Calendar connected');
      } catch {
        toast.error('Failed to connect Google Calendar');
      }
    };

    listenerRef.current = listener;
    window.addEventListener('message', listener);
  };

  const handleDisconnect = async () => {
    const confirmed = window.confirm(
      'Disconnect Google Calendar? Existing synced events will remain in your calendar, but new bookings will no longer sync.'
    );
    if (!confirmed) return;

    try {
      await disconnect();
      toast.success('Google Calendar disconnected');
    } catch {
      toast.error('Failed to disconnect Google Calendar');
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-ink/10 rounded-lg p-6">
        <div className="flex items-center gap-3">
          <Loader2 className="w-4 h-4 animate-spin text-ink/40" />
          <span className="text-sm text-ink/40">Loading calendar connection...</span>
        </div>
      </div>
    );
  }

  // ── State B: Connected ─────────────────────────────────────────────────────
  if (connection && connection.is_active) {
    const lastSynced = connection.last_sync_at
      ? new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
          Math.round((new Date(connection.last_sync_at).getTime() - Date.now()) / 60000),
          'minute'
        )
      : 'Not synced yet';

    const connectedSince = new Date(connection.connected_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    return (
      <div className="bg-white border border-ink/10 rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl serif font-light italic text-ink">Google Calendar Sync</h3>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-xs text-emerald-600">Connected</span>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-ink/40">
            <span className="uppercase tracking-[0.15em] font-medium">Last synced</span>
            {' '}— {lastSynced}
          </p>
          <p className="text-xs text-ink/40">
            <span className="uppercase tracking-[0.15em] font-medium">Connected since</span>
            {' '}— {connectedSince}
          </p>
        </div>

        <div className="pt-4 border-t border-ink/10">
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="flex items-center gap-2 text-ink/40 text-[10px] uppercase tracking-[0.2em] font-medium transition-all duration-300 hover:text-ink disabled:opacity-50"
          >
            {disconnecting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : null}
            {disconnecting ? 'Disconnecting...' : 'Disconnect'}
          </button>
        </div>
      </div>
    );
  }

  // ── State C: Reconnect Required ────────────────────────────────────────────
  if (connection && !connection.is_active) {
    return (
      <div className="bg-white border border-ink/10 rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl serif font-light italic text-ink">Google Calendar Sync</h3>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-xs text-amber-600">Reconnect Required</span>
          </div>
        </div>

        <p className="text-sm text-ink/60">
          Your Google Calendar access was revoked. Please reconnect to resume syncing.
        </p>

        <button
          onClick={handleConnect}
          disabled={connecting}
          className="flex items-center gap-2 bg-ink text-paper px-5 py-2.5 text-[10px] uppercase tracking-[0.2em] font-medium hover:bg-ink/80 transition-colors duration-300 disabled:opacity-50"
        >
          {connecting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Calendar className="w-3.5 h-3.5" />
          )}
          {connecting ? 'Connecting...' : 'Reconnect'}
        </button>
      </div>
    );
  }

  // ── State A: Not Connected ─────────────────────────────────────────────────
  return (
    <div className="bg-white border border-ink/10 rounded-lg p-6 space-y-4">
      <h3 className="text-xl serif font-light italic text-ink">Google Calendar Sync</h3>

      <p className="text-sm text-ink/60">
        Connect your Google Calendar to automatically sync FitRush bookings and block conflicting time slots.
      </p>

      <button
        onClick={handleConnect}
        disabled={connecting}
        className="flex items-center gap-2 bg-ink text-paper px-5 py-2.5 text-[10px] uppercase tracking-[0.2em] font-medium hover:bg-ink/80 transition-colors duration-300 disabled:opacity-50"
      >
        {connecting ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Calendar className="w-3.5 h-3.5" />
        )}
        {connecting ? 'Connecting...' : 'Connect Google Calendar'}
      </button>
    </div>
  );
};

export default GoogleCalendarConnect;
