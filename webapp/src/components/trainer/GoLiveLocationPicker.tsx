import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Dumbbell, Leaf, Home, X } from 'lucide-react';
import { useWorkoutLocations } from '@/hooks/useWorkoutLocations';
import type { LocationType } from '@/types/map';
import { PIN_COLORS } from '@/types/map';

interface GoLiveLocationPickerProps {
  trainerId: string;
  onSelect: (locationId: string) => void;
  onClose: () => void;
}

const LOCATION_TYPE_ICONS: Record<LocationType, React.ElementType> = {
  gym: Dumbbell,
  park: Leaf,
  'in-home': Home,
};

const GoLiveLocationPicker: React.FC<GoLiveLocationPickerProps> = ({
  trainerId,
  onSelect,
  onClose,
}) => {
  const { locations, loading, refetch } = useWorkoutLocations();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Fetch locations on mount
  useEffect(() => {
    refetch(trainerId);
  }, [trainerId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Body scroll lock while modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleGoLiveHere = () => {
    if (selectedId) {
      onSelect(selectedId);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center px-4">
      <div className="relative bg-white w-full max-w-sm rounded shadow-xl">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-ink/30 hover:text-ink transition-colors"
          aria-label="Close"
        >
          <X size={16} />
        </button>

        <div className="p-6 space-y-4">
          <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-ink/40">
            Where are you training today?
          </p>

          {loading && (
            <p className="text-sm text-ink/40">Loading locations…</p>
          )}

          {!loading && locations.length === 0 && (
            <div className="space-y-2 py-4 text-center">
              <p className="text-sm text-ink/60">Add a workout location first</p>
              <Link
                to="/trainer/dashboard"
                onClick={onClose}
                className="text-[10px] uppercase tracking-[0.15em] text-accent hover:underline"
              >
                Go to Dashboard
              </Link>
            </div>
          )}

          {locations.length > 0 && (
            <div className="space-y-2">
              {locations.map((loc) => {
                const Icon = LOCATION_TYPE_ICONS[loc.location_type];
                const isSelected = selectedId === loc.id;
                return (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => setSelectedId(loc.id)}
                    className={`w-full flex items-center gap-3 p-3 border text-left transition-all duration-200 ${
                      isSelected
                        ? 'border-accent bg-accent/5'
                        : 'border-ink/10 hover:border-ink/25'
                    }`}
                  >
                    <Icon
                      size={16}
                      style={{ color: PIN_COLORS[loc.location_type], flexShrink: 0 }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink truncate">
                        {loc.nickname || loc.address}
                      </p>
                      {loc.nickname && (
                        <p className="text-[11px] text-ink/40 truncate">{loc.address}</p>
                      )}
                      <p className="text-[10px] uppercase tracking-[0.15em] text-ink/30 mt-0.5">
                        {loc.location_type}
                      </p>
                    </div>
                    {isSelected && (
                      <div className="w-2 h-2 rounded-full bg-accent flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {locations.length > 0 && (
            <button
              type="button"
              onClick={handleGoLiveHere}
              disabled={!selectedId}
              className="w-full py-3 bg-ink text-white text-[10px] uppercase tracking-[0.2em] font-semibold disabled:opacity-40 hover:bg-ink/80 transition-colors"
            >
              Go Live Here
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export { GoLiveLocationPicker };
export default GoLiveLocationPicker;
