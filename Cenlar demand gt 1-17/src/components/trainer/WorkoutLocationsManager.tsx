import { useState, useRef, useCallback, useEffect } from 'react';
import { APIProvider, Map, AdvancedMarker, useMapsLibrary } from '@vis.gl/react-google-maps';
import { Dumbbell, Leaf, Home, Trash2, MapPin, Plus } from 'lucide-react';
import { useWorkoutLocations } from '@/hooks/useWorkoutLocations';
import type { LocationType } from '@/types/map';
import { PIN_COLORS, LA_DEFAULT } from '@/types/map';

interface WorkoutLocationsManagerProps {
  trainerId: string;
}

const LOCATION_TYPE_OPTIONS: { value: LocationType; label: string; Icon: React.ElementType }[] = [
  { value: 'gym', label: 'Gym', Icon: Dumbbell },
  { value: 'park', label: 'Park', Icon: Leaf },
  { value: 'in-home', label: 'In-Home', Icon: Home },
];

const LocationTypeIcon: React.FC<{ type: LocationType; size?: number }> = ({ type, size = 14 }) => {
  const option = LOCATION_TYPE_OPTIONS.find((o) => o.value === type);
  if (!option) return null;
  const { Icon } = option;
  return <Icon size={size} style={{ color: PIN_COLORS[type] }} />;
};

interface AddFormProps {
  trainerId: string;
  onSave: () => void;
  onCancel: () => void;
  addLocation: ReturnType<typeof useWorkoutLocations>['addLocation'];
  error: string | null;
}

const AddLocationForm: React.FC<AddFormProps> = ({ trainerId, onSave, onCancel, addLocation, error }) => {
  const [editAddress, setEditAddress] = useState('');
  const [editNickname, setEditNickname] = useState('');
  const [editType, setEditType] = useState<LocationType | null>(null);
  const [editCoords, setEditCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompleteSuggestion[]>([]);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Access the Places library
  const placesLib = useMapsLibrary('places');

  const handleAddressInput = useCallback(
    async (value: string) => {
      setEditAddress(value);
      setSuggestions([]);
      setEditCoords(null);

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
          setEditCoords({ lat: loc.lat(), lng: loc.lng() });
          setEditAddress(addr);
        }
      } catch {
        setLocalError('Could not fetch location details. Please try again.');
      }
    },
    []
  );

  const handleSave = async () => {
    if (!editCoords || !editType) return;
    setSaving(true);
    setLocalError(null);
    const result = await addLocation(trainerId, {
      address: editAddress,
      nickname: editNickname.trim() || null,
      latitude: editCoords.lat,
      longitude: editCoords.lng,
      location_type: editType,
    });
    setSaving(false);
    if (result) {
      onSave();
    }
  };

  const displayError = localError || error;

  return (
    <div className="border border-ink/10 p-4 space-y-4">
      <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-ink/40">
        Add Location
      </p>

      {/* Address autocomplete */}
      <div className="relative">
        <label className="block text-[10px] uppercase tracking-[0.15em] text-ink/40 mb-1">
          Address
        </label>
        <input
          type="text"
          value={editAddress}
          onChange={(e) => handleAddressInput(e.target.value)}
          placeholder="Search address..."
          className="w-full border border-ink/15 px-3 py-2 text-sm text-ink placeholder:text-ink/30 focus:outline-none focus:border-ink/40 bg-transparent"
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

      {/* Map preview */}
      {editCoords && (
        <div style={{ height: '200px' }} className="overflow-hidden border border-ink/10">
          <Map
            defaultCenter={editCoords}
            center={editCoords}
            defaultZoom={15}
            gestureHandling="cooperative"
            disableDefaultUI
          >
            <AdvancedMarker
              position={editCoords}
              draggable={true}
              onDragEnd={(e) => {
                if (e.latLng) {
                  setEditCoords({ lat: e.latLng.lat(), lng: e.latLng.lng() });
                }
              }}
            />
          </Map>
        </div>
      )}

      {/* Location type toggle */}
      <div>
        <label className="block text-[10px] uppercase tracking-[0.15em] text-ink/40 mb-2">
          Type
        </label>
        <div className="flex gap-2">
          {LOCATION_TYPE_OPTIONS.map(({ value, label, Icon }) => {
            const selected = editType === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setEditType(value)}
                className={`flex items-center gap-1.5 px-3 py-2 text-[10px] uppercase tracking-[0.15em] font-medium border transition-all duration-200 ${
                  selected
                    ? 'text-white border-transparent'
                    : 'text-ink/50 border-ink/10 hover:border-ink/25'
                }`}
                style={selected ? { backgroundColor: PIN_COLORS[value] } : undefined}
              >
                <Icon size={12} />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Nickname */}
      <div>
        <label className="block text-[10px] uppercase tracking-[0.15em] text-ink/40 mb-1">
          Nickname (optional)
        </label>
        <input
          type="text"
          value={editNickname}
          onChange={(e) => setEditNickname(e.target.value)}
          placeholder="e.g. Venice Beach Spot"
          maxLength={40}
          className="w-full border border-ink/15 px-3 py-2 text-sm text-ink placeholder:text-ink/30 focus:outline-none focus:border-ink/40 bg-transparent"
        />
      </div>

      {displayError && (
        <p className="text-[11px] text-red-500">{displayError}</p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={!editCoords || !editType || saving}
          className="px-4 py-2 bg-ink text-white text-[10px] uppercase tracking-[0.15em] font-medium disabled:opacity-40 hover:bg-ink/80 transition-colors"
        >
          {saving ? 'Saving…' : 'Save Location'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-ink/15 text-[10px] uppercase tracking-[0.15em] font-medium text-ink/50 hover:text-ink hover:border-ink/30 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

const WorkoutLocationsManagerInner: React.FC<WorkoutLocationsManagerProps> = ({ trainerId }) => {
  const { locations, loading, error, canAddMore, addLocation, deleteLocation, refetch } =
    useWorkoutLocations(trainerId);

  const [isAdding, setIsAdding] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Fetch on mount
  useEffect(() => {
    refetch(trainerId);
  }, [trainerId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaved = () => {
    setIsAdding(false);
    refetch(trainerId);
  };

  const handleDelete = async (id: string) => {
    await deleteLocation(id);
    setDeleteConfirmId(null);
  };

  return (
    <div className="space-y-4">
      <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-ink/40">
        Workout Locations
      </p>

      {loading && (
        <p className="text-sm text-ink/40">Loading locations…</p>
      )}

      {/* Saved locations list */}
      {!loading && locations.length === 0 && !isAdding && (
        <p className="text-sm text-ink/40">
          No locations saved. Add your first workout spot.
        </p>
      )}

      {locations.map((loc) => (
        <div key={loc.id} className="border border-ink/10 p-4 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <LocationTypeIcon type={loc.location_type} size={16} />
              <div className="min-w-0">
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
            </div>

            {deleteConfirmId !== loc.id && (
              <button
                type="button"
                onClick={() => setDeleteConfirmId(loc.id)}
                className="text-ink/30 hover:text-red-500 transition-colors flex-shrink-0"
                aria-label="Delete location"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>

          {/* Delete confirmation */}
          {deleteConfirmId === loc.id && (
            <div className="border-t border-ink/5 pt-2 space-y-2">
              <p className="text-[11px] text-ink/60">
                Remove this location? This cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => handleDelete(loc.id)}
                  className="text-[10px] uppercase tracking-[0.15em] font-medium text-red-500 hover:text-red-600"
                >
                  Remove
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteConfirmId(null)}
                  className="text-[10px] uppercase tracking-[0.15em] font-medium text-ink/40 hover:text-ink"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Add form */}
      {isAdding && (
        <AddLocationForm
          trainerId={trainerId}
          onSave={handleSaved}
          onCancel={() => setIsAdding(false)}
          addLocation={addLocation}
          error={error}
        />
      )}

      {/* Add button */}
      {!isAdding && (
        <div className="relative inline-block">
          <button
            type="button"
            onClick={() => canAddMore && setIsAdding(true)}
            disabled={!canAddMore}
            className="flex items-center gap-2 border border-ink/15 px-4 py-2 text-[10px] uppercase tracking-[0.15em] font-medium text-ink/60 hover:text-ink hover:border-ink/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title={!canAddMore ? 'Maximum 5 locations reached' : undefined}
          >
            <Plus size={12} />
            Add Location
          </button>
          {!canAddMore && (
            <span className="ml-2 text-[10px] text-ink/40 italic">
              Maximum 5 locations reached
            </span>
          )}
        </div>
      )}
    </div>
  );
};

const WorkoutLocationsManager: React.FC<WorkoutLocationsManagerProps> = ({ trainerId }) => {
  return (
    <APIProvider
      apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string}
      libraries={['places']}
    >
      <WorkoutLocationsManagerInner trainerId={trainerId} />
    </APIProvider>
  );
};

export { WorkoutLocationsManager };
export default WorkoutLocationsManager;
