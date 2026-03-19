import { useState, useEffect, useRef, useCallback } from 'react';
import { APIProvider, Map as GoogleMap, useMap } from '@vis.gl/react-google-maps';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import { TrainerMapPin } from '@/components/map/TrainerMapPin';
import { TrainerInfoCard } from '@/components/map/TrainerInfoCard';
import { LocationTypeChips } from '@/components/map/LocationTypeChips';
import { SearchAreaButton } from '@/components/map/SearchAreaButton';
import { ClientLocationDot } from '@/components/map/ClientLocationDot';
import { RadiusCircle } from '@/components/map/RadiusCircle';
import { useMapTrainers } from '@/hooks/useMapTrainers';
import type { TrainerPin as TrainerPinType, LocationType, MapBounds } from '@/types/map';
import { LA_DEFAULT } from '@/types/map';

// Haversine distance formula — returns distance in miles
function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3959; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

interface MapViewFilters {
  specialty?: string;
  maxRate?: number;
  location?: string;
}

interface MapViewProps {
  filters: MapViewFilters;
}

// Inner component that has access to the Google Maps map instance via useMap()
interface MapInnerProps {
  pins: TrainerPinType[];
  loading: boolean;
  error: string | null;
  selectedTrainerId: string | null;
  locationTypeFilter: LocationType | 'all';
  distanceMiles: number;
  clientPosition: { lat: number; lng: number } | null;
  showSearchArea: boolean;
  searchLoading: boolean;
  onPinClick: (trainerId: string) => void;
  onInfoCardClose: () => void;
  onSearchArea: () => void;
  onBoundsChange: (bounds: MapBounds) => void;
}

function MapInner({
  pins,
  loading,
  error,
  selectedTrainerId,
  locationTypeFilter,
  distanceMiles,
  clientPosition,
  showSearchArea,
  searchLoading,
  onPinClick,
  onInfoCardClose,
  onSearchArea,
  onBoundsChange,
}: MapInnerProps) {
  const map = useMap();
  const clustererRef = useRef<MarkerClusterer | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRefs = useRef(new globalThis.Map<string, any>());

  // Set up MarkerClusterer with custom dark-circle renderer
  useEffect(() => {
    if (!map) return;

    clustererRef.current = new MarkerClusterer({
      map,
      renderer: {
        render({ count, position }) {
          const div = document.createElement('div');
          div.style.cssText = [
            'width:40px',
            'height:40px',
            'border-radius:50%',
            'background:#1A1A1A',
            'color:white',
            'display:flex',
            'align-items:center',
            'justify-content:center',
            'font-size:12px',
            'font-weight:600',
            'cursor:pointer',
            'border:2px solid white',
            'box-shadow:0 2px 8px rgba(0,0,0,0.3)',
          ].join(';');
          div.textContent = String(count);

          // Access google global at runtime (maps SDK loads asynchronously)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const g = (window as any).google;
          return new g.maps.marker.AdvancedMarkerElement({ position, content: div });
        },
      },
    });

    return () => {
      if (clustererRef.current) {
        clustererRef.current.clearMarkers();
        clustererRef.current = null;
      }
    };
  }, [map]);

  // Map idle callback to capture bounds
  useEffect(() => {
    if (!map) return;

    const listener = map.addListener('idle', () => {
      const bounds = map.getBounds();
      if (bounds) {
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        onBoundsChange({
          north: ne.lat(),
          south: sw.lat(),
          east: ne.lng(),
          west: sw.lng(),
        });
      }
    });

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = (window as any).google;
      g?.maps?.event?.removeListener(listener);
    };
  }, [map, onBoundsChange]);

  // Filter pins by location type, then by distance if client location available
  const filteredPins = pins
    .filter((pin) => locationTypeFilter === 'all' || pin.location_type === locationTypeFilter)
    .filter((pin) => {
      if (!clientPosition) return true;
      return haversineDistance(clientPosition.lat, clientPosition.lng, pin.latitude, pin.longitude) <= distanceMiles;
    });

  const selectedPin = selectedTrainerId
    ? filteredPins.find((p) => p.trainer_id === selectedTrainerId)
    : null;

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-ink/60 text-center">
          Map unavailable. Check your connection and reload.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Search this area button */}
      <SearchAreaButton
        visible={showSearchArea && !loading}
        loading={searchLoading}
        onClick={onSearchArea}
      />

      {/* Trainer pins */}
      {filteredPins.map((pin) => (
        <TrainerMapPin
          key={pin.trainer_id}
          trainer={pin}
          isSelected={selectedTrainerId === pin.trainer_id}
          onClick={() => onPinClick(pin.trainer_id)}
        />
      ))}

      {/* Info card for selected trainer */}
      {selectedPin && (
        <TrainerInfoCard trainer={selectedPin} onClose={onInfoCardClose} />
      )}

      {/* Client location dot */}
      {clientPosition && <ClientLocationDot position={clientPosition} />}

      {/* Radius circle */}
      {clientPosition && (
        <RadiusCircle
          center={clientPosition}
          radiusMiles={distanceMiles}
          visible={true}
        />
      )}

      {/* Empty state overlay */}
      {!loading && filteredPins.length === 0 && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            zIndex: 5,
            textAlign: 'center',
            background: 'rgba(253, 252, 251, 0.92)',
            backdropFilter: 'blur(4px)',
            borderRadius: '12px',
            padding: '24px 32px',
            border: '1px solid rgba(26, 26, 26, 0.08)',
          }}
        >
          <p className="text-lg serif font-light text-ink italic">No trainers available nearby</p>
          <p className="text-[11px] uppercase tracking-[0.15em] text-ink/40 mt-2">
            No trainers are live in this area right now. Try expanding your search or check back soon.
          </p>
        </div>
      )}
    </>
  );
}

export function MapView({ filters }: MapViewProps) {
  const { pins, loading, error, fetchPinsInView } = useMapTrainers();

  const [selectedTrainerId, setSelectedTrainerId] = useState<string | null>(null);
  const [locationTypeFilter, setLocationTypeFilter] = useState<LocationType | 'all'>('all');
  const [showSearchArea, setShowSearchArea] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [clientPosition, setClientPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [currentBounds, setCurrentBounds] = useState<MapBounds | null>(null);
  const [lastSearchBounds, setLastSearchBounds] = useState<MapBounds | null>(null);
  const [distanceMiles, setDistanceMiles] = useState(5);
  const [geolocationDenied, setGeolocationDenied] = useState(false);
  const initialFetchDone = useRef(false);

  // Request geolocation on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeolocationDenied(true);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setClientPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      () => {
        setGeolocationDenied(true);
      }
    );
  }, []);

  // Handle bounds change from MapInner
  const handleBoundsChange = useCallback(
    (bounds: MapBounds) => {
      setCurrentBounds(bounds);

      // Initial fetch when bounds first become available
      if (!initialFetchDone.current) {
        initialFetchDone.current = true;
        setLastSearchBounds(bounds);
        fetchPinsInView(bounds);
        return;
      }

      // Show "Search this area" if bounds changed significantly
      if (lastSearchBounds) {
        const centerLat = (bounds.north + bounds.south) / 2;
        const centerLng = (bounds.east + bounds.west) / 2;
        const lastCenterLat = (lastSearchBounds.north + lastSearchBounds.south) / 2;
        const lastCenterLng = (lastSearchBounds.east + lastSearchBounds.west) / 2;

        const latDiff = Math.abs(centerLat - lastCenterLat);
        const lngDiff = Math.abs(centerLng - lastCenterLng);

        // Show button when center shifts > ~0.005 degrees (~500m)
        const threshold = 0.005;
        if (latDiff > threshold || lngDiff > threshold) {
          setShowSearchArea(true);
        }
      }
    },
    [lastSearchBounds, fetchPinsInView]
  );

  const handleSearchArea = useCallback(async () => {
    if (!currentBounds) return;
    setSearchLoading(true);
    setShowSearchArea(false);
    setLastSearchBounds(currentBounds);
    await fetchPinsInView(currentBounds);
    setSearchLoading(false);
  }, [currentBounds, fetchPinsInView]);

  const handlePinClick = useCallback((trainerId: string) => {
    setSelectedTrainerId((prev) => (prev === trainerId ? null : trainerId));
  }, []);

  const initialCenter = clientPosition ?? LA_DEFAULT;

  return (
    <div className="flex flex-col gap-3">
      {/* Location type chips above map */}
      <LocationTypeChips selected={locationTypeFilter} onSelect={setLocationTypeFilter} />

      {/* Map container */}
      <div className="relative w-full rounded-xl overflow-hidden border border-ink/10" style={{ height: '520px' }}>
        <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}>
          <GoogleMap
            defaultCenter={initialCenter}
            defaultZoom={12}
            gestureHandling="greedy"
            disableDefaultUI={true}
            style={{ width: '100%', height: '100%' }}
            onClick={() => setSelectedTrainerId(null)}
          >
            <MapInner
              pins={pins}
              loading={loading}
              error={error}
              selectedTrainerId={selectedTrainerId}
              locationTypeFilter={locationTypeFilter}
              distanceMiles={distanceMiles}
              clientPosition={clientPosition}
              showSearchArea={showSearchArea}
              searchLoading={searchLoading}
              onPinClick={handlePinClick}
              onInfoCardClose={() => setSelectedTrainerId(null)}
              onSearchArea={handleSearchArea}
              onBoundsChange={handleBoundsChange}
            />
          </GoogleMap>
        </APIProvider>

        {/* Distance slider overlay — only show when geolocation is available */}
        {!geolocationDenied && clientPosition ? (
          <div
            style={{
              position: 'absolute',
              bottom: '80px',
              left: '16px',
              zIndex: 10,
              minWidth: '180px',
              background: 'rgba(253, 252, 251, 0.95)',
              backdropFilter: 'blur(8px)',
              borderRadius: '12px',
              padding: '12px 16px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              border: '1px solid rgba(26, 26, 26, 0.08)',
            }}
          >
            <div className="text-[10px] uppercase tracking-[0.2em] font-semibold text-ink/70 mb-2">
              Within {distanceMiles} mi
            </div>
            <input
              type="range"
              min={1}
              max={25}
              step={1}
              value={distanceMiles}
              onChange={(e) => setDistanceMiles(Number(e.target.value))}
              className="w-full accent-ink cursor-pointer"
              style={{ display: 'block' }}
            />
          </div>
        ) : geolocationDenied ? (
          <div
            style={{
              position: 'absolute',
              bottom: '80px',
              left: '16px',
              zIndex: 10,
              background: 'rgba(253, 252, 251, 0.95)',
              backdropFilter: 'blur(8px)',
              borderRadius: '12px',
              padding: '10px 14px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              border: '1px solid rgba(26, 26, 26, 0.08)',
            }}
          >
            <p className="text-[10px] uppercase tracking-[0.15em] text-ink/50">
              Enable location for distance filter
            </p>
          </div>
        ) : null}

        {/* Loading overlay */}
        {loading && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 10,
              background: 'rgba(253, 252, 251, 0.9)',
              borderRadius: '8px',
              padding: '12px 20px',
            }}
          >
            <p className="text-[11px] uppercase tracking-[0.2em] text-ink/60">Loading trainers...</p>
          </div>
        )}
      </div>
    </div>
  );
}
