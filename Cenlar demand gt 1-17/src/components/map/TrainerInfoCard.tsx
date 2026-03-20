import { AdvancedMarker } from '@vis.gl/react-google-maps';
import { X, Star, Dumbbell, Leaf, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import LiveNowBadge from '@/components/shared/LiveNowBadge';
import BookingModeBadge from '@/components/shared/BookingModeBadge';
import type { TrainerPin, LocationType } from '@/types/map';
import { PIN_COLORS } from '@/types/map';

const ICON_MAP: Record<LocationType, React.ElementType> = {
  gym: Dumbbell,
  park: Leaf,
  'in-home': Home,
};

const LOCATION_LABELS: Record<LocationType, string> = {
  gym: 'Gym',
  park: 'Park',
  'in-home': 'In-Home',
};

interface TrainerInfoCardProps {
  trainer: TrainerPin;
  onClose: () => void;
}

export function TrainerInfoCard({ trainer, onClose }: TrainerInfoCardProps) {
  const navigate = useNavigate();
  const LocationIcon = ICON_MAP[trainer.location_type];
  const pinColor = PIN_COLORS[trainer.location_type];

  return (
    <AdvancedMarker
      position={{ lat: trainer.latitude, lng: trainer.longitude }}
      zIndex={200}
    >
      <div
        style={{
          transform: 'translateY(-100%) translateY(-8px)',
          width: '240px',
        }}
      >
        <div className="bg-paper border border-ink/10 shadow-lg rounded-lg p-4 relative">
          {/* X close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-ink/40 hover:text-ink transition-colors"
            aria-label="Close"
          >
            <X size={14} />
          </button>

          {/* Top row: Avatar + Name */}
          <div className="flex items-start gap-3 pr-5">
            {trainer.avatarUrl ? (
              <img
                src={trainer.avatarUrl}
                alt={trainer.name ?? 'Trainer'}
                className="w-10 h-10 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-ink/10 flex-shrink-0" />
            )}
            <div className="min-w-0">
              <div className="text-lg serif font-light text-ink truncate">
                {trainer.name ?? 'Trainer'}
              </div>
              {trainer.specialty && (
                <div className="text-[10px] uppercase tracking-[0.2em] text-ink/40 truncate">
                  {trainer.specialty}
                </div>
              )}
            </div>
          </div>

          {/* Rate */}
          {trainer.rate !== undefined && (
            <div className="mt-3">
              {(trainer.discountPercentage ?? 0) > 0 && trainer.discountedRate !== undefined ? (
                <div className="flex items-baseline gap-2">
                  <span className="text-xl serif italic text-accent">
                    ${trainer.discountedRate}
                    <span className="text-[10px] text-ink/30 not-italic">/hr</span>
                  </span>
                  <span className="text-[10px] text-ink/30 line-through">
                    ${trainer.rate}/hr
                  </span>
                </div>
              ) : (
                <div className="text-xl serif italic text-accent">
                  ${trainer.rate}
                  <span className="text-[10px] text-ink/30 not-italic">/hr</span>
                </div>
              )}
            </div>
          )}

          {/* Rating */}
          {trainer.rating !== undefined && (
            <div className="flex items-center gap-1 mt-2">
              <Star size={12} fill="currentColor" className="text-accent" />
              <span className="text-[11px] font-semibold text-ink">
                {Number(trainer.rating).toFixed(1)}
              </span>
              {trainer.reviewCount !== undefined && (
                <span className="text-[11px] text-ink/40">
                  ({trainer.reviewCount})
                </span>
              )}
            </div>
          )}

          {/* Badges row */}
          {(trainer.isLive || trainer.bookingMode) && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {trainer.isLive && <LiveNowBadge />}
              {trainer.bookingMode && <BookingModeBadge mode={trainer.bookingMode} />}
            </div>
          )}

          {/* Location type */}
          <div className="flex items-center gap-1.5 mt-2">
            <LocationIcon size={11} color={pinColor} />
            <span className="text-[10px] uppercase tracking-[0.15em] text-ink/40">
              {LOCATION_LABELS[trainer.location_type]}
            </span>
          </div>

          {/* Book Now button */}
          <button
            onClick={() => navigate(`/book/${trainer.trainer_id}`)}
            className="mt-4 w-full bg-accent text-white py-3 text-[10px] uppercase tracking-[0.3em] font-semibold rounded hover:bg-accent/90 transition-colors"
          >
            Book Now
          </button>
        </div>
      </div>
    </AdvancedMarker>
  );
}
