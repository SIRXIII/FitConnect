import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth';
import { subscribeToPush, unsubscribeFromPush } from '@/lib/pushNotifications';
import { supabase } from '@/lib/supabase';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/**
 * Notification Settings page.
 *
 * Provides a push notification toggle (enable / disable for the current device).
 * Rendered in the trainer profile tab's settings area and accessible from the
 * client's Alerts tab.
 */
const NotificationSettings: React.FC = () => {
  const { user } = useAuthStore();
  const [pushEnabled, setPushEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    if (!user) return;
    db
      .from('push_subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }: { data: { id: string } | null }) => {
        setPushEnabled(!!data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [user]);

  const handleToggle = async (value: boolean) => {
    if (!user || toggling) return;
    setToggling(true);
    try {
      if (value) {
        const ok = await subscribeToPush(user.id);
        if (ok) {
          setPushEnabled(true);
          toast.success('Push notifications enabled');
        } else {
          toast.error('Could not enable push notifications — check browser permissions');
        }
      } else {
        await unsubscribeFromPush(user.id);
        setPushEnabled(false);
        toast.success('Push notifications disabled');
      }
    } catch {
      toast.error('Failed to update push notification settings');
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-ink/40">Loading settings…</p>;
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-ink/40">
          Push Notifications
        </p>
        <h2 className="text-2xl serif font-light italic text-ink">Notification Settings</h2>
        <p className="text-sm text-ink/50">
          Manage how you receive alerts on this device
        </p>
      </div>

      <div className="border border-ink/10 p-6 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] font-medium text-ink">
              Push Notifications
            </p>
            <p className="text-[11px] text-ink/40 mt-1">
              Receive alerts on this device
            </p>
          </div>
          <button
            type="button"
            onClick={() => { void handleToggle(!pushEnabled); }}
            disabled={toggling}
            className={`relative w-12 h-6 rounded-full transition-colors duration-200 flex-shrink-0 disabled:opacity-50 ${
              pushEnabled ? 'bg-accent' : 'bg-ink/20'
            }`}
            aria-label={pushEnabled ? 'Disable push notifications' : 'Enable push notifications'}
          >
            <span
              className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
                pushEnabled ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {pushEnabled && (
          <p className="text-[11px] text-accent/70">
            Push notifications are active on this device
          </p>
        )}
      </div>

      <div className="border border-ink/10 p-6">
        <p className="text-xs uppercase tracking-[0.2em] font-medium text-ink mb-2">
          You will receive pushes for:
        </p>
        <ul className="space-y-1 text-sm text-ink/50 font-light">
          <li>• New booking confirmations</li>
          <li>• Booking cancellations</li>
          <li>• Trainers going live near your area</li>
        </ul>
      </div>
    </div>
  );
};

export default NotificationSettings;
