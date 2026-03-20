import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';
import type { ClientNotificationPreferences } from '@/types/notifications';

export function useNotificationPreferences() {
  const { user } = useAuthStore();
  const [preferences, setPreferences] = useState<ClientNotificationPreferences | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchPreferences = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await (supabase as any)
        .from('client_notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .limit(1);

      setPreferences(data && data.length > 0 ? (data[0] as ClientNotificationPreferences) : null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const savePreferences = useCallback(
    async (data: Partial<ClientNotificationPreferences>) => {
      if (!user) return;
      await (supabase as any)
        .from('client_notification_preferences')
        .upsert(
          {
            user_id: user.id,
            ...data,
          },
          { onConflict: 'user_id' }
        );
      await fetchPreferences();
    },
    [user, fetchPreferences]
  );

  const toggleEnabled = useCallback(
    async (enabled: boolean) => {
      if (!user) return;
      await (supabase as any)
        .from('client_notification_preferences')
        .update({ notif_enabled: enabled })
        .eq('user_id', user.id);
      await fetchPreferences();
    },
    [user, fetchPreferences]
  );

  const isConfigured =
    preferences?.notif_enabled === true &&
    preferences?.area_lat != null &&
    preferences?.area_lng != null;

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  return {
    preferences,
    loading,
    savePreferences,
    toggleEnabled,
    isConfigured,
    refetch: fetchPreferences,
  };
}
