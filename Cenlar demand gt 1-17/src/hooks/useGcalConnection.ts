import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { GcalConnection } from '@/types/gcal';

interface UseGcalConnectionReturn {
  connection: GcalConnection | null;
  loading: boolean;
  connecting: boolean;
  disconnecting: boolean;
  connect: (code: string) => Promise<void>;
  disconnect: () => Promise<void>;
  refetch: () => Promise<void>;
}

export function useGcalConnection(trainerProfileId: string | undefined): UseGcalConnectionReturn {
  const [connection, setConnection] = useState<GcalConnection | null>(null);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const fetchConnection = useCallback(async () => {
    if (!trainerProfileId) return;

    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('google_calendar_connections')
        .select('*')
        .eq('trainer_id', trainerProfileId)
        .maybeSingle();

      if (error) {
        console.error('useGcalConnection: fetch error', error);
        setConnection(null);
      } else {
        setConnection(data as GcalConnection | null);
      }
    } finally {
      setLoading(false);
    }
  }, [trainerProfileId]);

  // Fetch connection state on mount and when trainerProfileId changes
  useEffect(() => {
    fetchConnection();
  }, [fetchConnection]);

  const connect = useCallback(async (code: string) => {
    setConnecting(true);
    try {
      const { error } = await supabase.functions.invoke('google-calendar-connect', {
        body: { action: 'connect', code },
      });

      if (error) {
        throw new Error(error.message ?? 'Connection failed');
      }

      // Refetch to get updated connection state
      await fetchConnection();
    } finally {
      setConnecting(false);
    }
  }, [fetchConnection]);

  const disconnect = useCallback(async () => {
    setDisconnecting(true);
    try {
      const { error } = await supabase.functions.invoke('google-calendar-connect', {
        body: { action: 'disconnect' },
      });

      if (error) {
        throw new Error(error.message ?? 'Disconnect failed');
      }

      setConnection(null);
    } finally {
      setDisconnecting(false);
    }
  }, []);

  return {
    connection,
    loading,
    connecting,
    disconnecting,
    connect,
    disconnect,
    refetch: fetchConnection,
  };
}
