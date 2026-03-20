import { AdvancedMarker } from '@vis.gl/react-google-maps';
import { Dumbbell, Leaf, Home, Crown } from 'lucide-react';
import type { TrainerPin as TrainerPinType, LocationType } from '@/types/map';
import { PIN_COLORS } from '@/types/map';

const ICON_MAP: Record<LocationType, React.ElementType> = {
  gym: Dumbbell,
  park: Leaf,
  'in-home': Home,
};

interface TrainerMapPinProps {
  trainer: TrainerPinType;
  isSelected: boolean;
  onClick: () => void;
}

export function TrainerMapPin({ trainer, isSelected, onClick }: TrainerMapPinProps) {
  const Icon = ICON_MAP[trainer.location_type];
  const pinColor = PIN_COLORS[trainer.location_type];
  const isElite = trainer.subscriptionTier === 'elite';

  return (
    <AdvancedMarker
      position={{ lat: trainer.latitude, lng: trainer.longitude }}
      onClick={onClick}
      zIndex={isSelected ? 100 : 1}
    >
      <div
        style={{
          position: 'relative',
          minWidth: '44px',
          minHeight: '44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        {/* Pin teardrop body */}
        <div
          style={{
            width: '28px',
            height: '36px',
            backgroundColor: pinColor,
            borderRadius: '50% 50% 50% 0',
            transform: isSelected ? 'rotate(-45deg) scale(1.15)' : 'rotate(-45deg)',
            border: isElite ? `2px solid #C5A059` : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            transition: 'transform 0.15s ease',
          }}
        >
          {/* Icon rotated back to upright */}
          <div style={{ transform: 'rotate(45deg)' }}>
            <Icon size={14} color="white" />
          </div>
        </div>

        {/* Elite crown badge */}
        {isElite && (
          <div
            style={{
              position: 'absolute',
              top: '2px',
              right: '2px',
              lineHeight: 1,
            }}
          >
            <Crown size={10} color="#C5A059" />
          </div>
        )}

        {/* Live pulse dot */}
        {trainer.isLive && (
          <div
            className="animate-pulse"
            style={{
              position: 'absolute',
              bottom: '4px',
              right: '2px',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#22C55E',
              border: '1.5px solid white',
            }}
          />
        )}
      </div>
    </AdvancedMarker>
  );
}
