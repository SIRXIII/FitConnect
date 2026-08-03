import { useState, useRef, useCallback, useEffect } from 'react';
import { APIProvider, useMapsLibrary } from '@vis.gl/react-google-maps';
import { toast } from 'sonner';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { useAuthStore } from '@/stores/auth';
import { subscribeToPush, unsubscribeFromPush } from '@/lib/pushNotifications';
import { supabase } from '@/lib/supabase';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const NotificationPreferencesSectionInner: React.FC = () => {
  const { preferences, loading, savePreferences, toggleEnabled, isConfigured } = useNotificationPreferences();
  const { user } = useAuthStore();

  const [areaLabel, setAreaLabel] = useState<string>(preferences?.area_label ?? '');
  const [areaCoords, setAreaCoords] = useState<{ lat: number; lng: number } | null>(
    preferences?.area_lat != null && preferences?.area_lng != null
      ? { lat: preferences.area_lat, lng: preferences.area_lng }
      : null
  );
  const [radius, setRadius] = useState<number>(preferences?.notif_radius_miles ?? 5);
  const [enabled, setEnabled] = useState<boolean>(preferences?.notif_enabled ?? false);
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompleteSuggestion[]>([]);
  const [saving, setSaving] = useState(false);

  // ── Push toggle state ─────────────────────────────────────────────────────
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    db
      .from('push_subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }: { data: { id: string } | null }) => setPushEnabled(!!data));
  }, [user]);

  const handlePushToggle = async (value: boolean) => {
    if (!user) return;
    setPushLoading(true);
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
      setPushLoading(false);
    }
  };

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const placesLib = useMapsLibrary('places');

  const handleToggleEnabled = useCallback(
    async (value: boolean) => {
      setEnabled(value);
      await toggleEnabled(value);
    },
    [toggleEnabled]
  );

  const handleAreaInput = useCallback(
    async (value: string) => {
      setAreaLabel(value);
      setSuggestions([]);
      setAreaCoords(null);

      if (!placesLib || value.length < 3) return;

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        try {
          const { suggestions: results } =
            await placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
              input: value,
            });
          setSuggestions(results ?? []);
        } catch {
          // Autocomplete errors are non-critical
        }
      }, 300);
    },
    [placesLib]
  );

  const handleSuggestionSelect = useCallback(
    async (suggestion: google.maps.places.AutocompleteSuggestion) => {
      setSuggestions([]);
      try {
        const place = suggestion.placePrediction?.toPlace();
        if (!place) return;
        await place.fetchFields({ fields: ['location', 'formattedAddress'] });
        const loc = place.location;
        const addr = place.formattedAddress;
        if (loc && addr) {
          setAreaCoords({ lat: loc.lat(), lng: loc.lng() });
          setAreaLabel(addr);
        }
      } catch {
        toast.error('Could not fetch location details. Please try again.');
      }
    },
    []
  );

  const handleSave = async () => {
    if (!areaCoords) return;
    setSaving(true);
    try {
      await savePreferences({
        notif_enabled: enabled,
        area_label: areaLabel,
        area_lat: areaCoords.lat,
        area_lng: areaCoords.lng,
        notif_radius_miles: radius,
      });
      toast.success('Notification preferences saved');
    } catch {
      toast.error('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const formDisabled = !enabled;

  if (loading) {
    return <p className="text-sm text-ink/40">Loading preferences…</p>;
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-ink/40">
          Location Alerts
        </p>
        <h2 className="text-2xl serif font-light italic text-ink">Notification Preferences</h2>
        <p className="text-sm text-ink/50">
          Get notified when trainers go live near your area
        </p>
      </div>

      {/* Push Notifications toggle */}
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
            onClick={() => { void handlePushToggle(!pushEnabled); }}
            disabled={pushLoading}
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
      </div>

      {/* Master toggle */}
      <div className="border border-ink/10 p-6 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] font-medium text-ink">
              Location-Based Alerts
            </p>
            <p className="text-[11px] text-ink/40 mt-1">
              Receive alerts when trainers go live near your saved area
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleToggleEnabled(!enabled)}
            className={`relative w-12 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${
              enabled ? 'bg-accent' : 'bg-ink/20'
            }`}
            aria-label={enabled ? 'Disable location alerts' : 'Enable location alerts'}
          >
            <span
              className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
                enabled ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Form (visually disabled when toggle is off) */}
      <div className={`space-y-6 ${formDisabled ? 'opacity-50 pointer-events-none' : ''}`}>

        {/* Area selector */}
        <div className="space-y-3">
          <label className="block text-[10px] uppercase tracking-[0.15em] text-ink/40 font-semibold">
            Notification Area
          </label>
          <div className="relative">
            <input
              type="text"
              value={areaLabel}
              onChange={(e) => handleAreaInput(e.target.value)}
              placeholder="Search neighborhood, city, or zip..."
              className="w-full border border-ink/15 px-3 py-2.5 text-sm text-ink placeholder:text-ink/30 focus:outline-none focus:border-ink/40 bg-transparent"
            />
            {suggestions.length > 0 && (
              <ul className="absolute z-10 top-full left-0 right-0 bg-white border border-ink/10 shadow-md max-h-48 overflow-y-auto">
                {suggestions.map((s, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => handleSuggestionSelect(s)}
                      className="w-full text-left px-3 py-2 text-sm text-ink/70 hover:bg-ink/5 transition-colors"
                    >
                      {s.placePrediction?.text?.toString() ?? ''}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Selected area pill */}
          {areaCoords && areaLabel && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-accent/10 border border-accent/20 text-[11px] text-accent">
                <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                {areaLabel}
              </span>
              <button
                type="button"
                onClick={() => {
                  setAreaLabel('');
                  setAreaCoords(null);
                }}
                className="text-[10px] text-ink/30 hover:text-ink/60 transition-colors"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {/* Radius slider */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[10px] uppercase tracking-[0.15em] text-ink/40 font-semibold">
              Alert Radius
            </label>
            <span className="text-sm font-medium text-ink">{radius} {radius === 1 ? 'mile' : 'miles'}</span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="w-full accent-accent"
          />
          <div className="flex justify-between text-[10px] text-ink/30">
            <span>1 mi</span>
            <span>5 mi</span>
            <span>10 mi</span>
          </div>
        </div>

        {/* Save button */}
        <button
          type="button"
          onClick={handleSave}
          disabled={!areaCoords || saving}
          className="px-6 py-3 bg-ink text-white text-[10px] uppercase tracking-[0.2em] font-medium disabled:opacity-40 hover:bg-ink/80 transition-colors disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'Save Preferences'}
        </button>

        {!areaCoords && (
          <p className="text-[11px] text-ink/40 italic">
            Set an area above to enable saving
          </p>
        )}

        {isConfigured && (
          <p className="text-[11px] text-accent/70">
            Alerts are active for your saved area
          </p>
        )}
      </div>
    </div>
  );
};

export const NotificationPreferencesSection: React.FC = () => {
  return (
    <APIProvider
      apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string}
      libraries={['places']}
    >
      <NotificationPreferencesSectionInner />
    </APIProvider>
  );
};

export default NotificationPreferencesSection;
