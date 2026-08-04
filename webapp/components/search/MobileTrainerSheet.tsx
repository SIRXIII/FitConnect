import { useState, useRef, useCallback } from 'react';
import { Dumbbell, Leaf, Home } from 'lucide-react';
import type { TrainerPin, LocationType } from '@/types/map';
import { PIN_COLORS } from '@/types/map';

const LOCATION_ICONS: Record<LocationType, React.ElementType> = {
  gym: Dumbbell,
  park: Leaf,
  'in-home': Home,
};

const LOCATION_LABELS: Record<LocationType, string> = {
  gym: 'Gym',
  park: 'Park',
  'in-home': 'In-Home',
};

// Snap heights as percentage of viewport height
const SNAP_POINTS = [0.1, 0.4, 0.8] as const;

function getClosestSnapPoint(heightPct: number): number {
  return SNAP_POINTS.reduce((closest, point) => {
    return Math.abs(point - heightPct) < Math.abs(closest - heightPct) ? point : closest;
  }, SNAP_POINTS[0]);
}

interface MobileTrainerSheetProps {
  trainers: TrainerPin[];
  onTrainerSelect: (trainerId: string) => void;
}

export function MobileTrainerSheet({ trainers, onTrainerSelect }: MobileTrainerSheetProps) {
  const [snapPoint, setSnapPoint] = useState<number>(0.4);
  const dragStartY = useRef<number | null>(null);
  const dragStartSnap = useRef<number>(0.4);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Do not render on desktop viewports (> 768px)
  if (typeof window !== 'undefined' && window.innerWidth > 768) {
    return null;
  }

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    dragStartY.current = e.clientY;
    dragStartSnap.current = snapPoint;
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [snapPoint]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartY.current === null) return;

    const deltaY = dragStartY.current - e.clientY;
    const viewportHeight = window.innerHeight;
    const deltaPct = deltaY / viewportHeight;
    const newHeight = Math.max(0.05, Math.min(0.9, dragStartSnap.current + deltaPct));

    if (sheetRef.current) {
      sheetRef.current.style.height = `${newHeight * 100}vh`;
      // Disable CSS transition during drag for responsive feel
      sheetRef.current.style.transition = 'none';
    }
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartY.current === null) return;

    const deltaY = dragStartY.current - e.clientY;
    const viewportHeight = window.innerHeight;
    const deltaPct = deltaY / viewportHeight;
    const rawHeight = dragStartSnap.current + deltaPct;
    const snapped = getClosestSnapPoint(rawHeight);

    setSnapPoint(snapped);
    dragStartY.current = null;

    // Re-enable CSS transition for smooth snap
    if (sheetRef.current) {
      sheetRef.current.style.transition = 'height 0.3s ease';
      sheetRef.current.style.height = `${snapped * 100}vh`;
    }
  }, []);

  return (
    <div
      ref={sheetRef}
      className="fixed bottom-0 left-0 right-0 bg-paper border-t border-ink/10 shadow-xl rounded-t-2xl z-20 overflow-hidden"
      style={{
        height: `${snapPoint * 100}vh`,
        transition: 'height 0.3s ease',
      }}
    >
      {/* Drag handle */}
      <div
        className="flex justify-center items-center py-3 cursor-grab active:cursor-grabbing"
        style={{ touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div className="w-10 h-1 bg-ink/20 rounded-full" />
      </div>

      {/* Trainer list */}
      <div className="overflow-y-auto h-full pb-8 px-4">
        {trainers.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-[11px] uppercase tracking-[0.15em] text-ink/40">
              No trainers in this area
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {trainers.map((trainer) => {
              const LocationIcon = LOCATION_ICONS[trainer.location_type];
              const pinColor = PIN_COLORS[trainer.location_type];

              return (
                <button
                  key={trainer.trainer_id}
                  onClick={() => onTrainerSelect(trainer.trainer_id)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-ink/10 hover:border-ink/20 text-left transition-all"
                >
                  {/* Avatar */}
                  {trainer.avatarUrl ? (
                    <img
                      src={trainer.avatarUrl}
                      alt={trainer.name ?? 'Trainer'}
                      className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-ink/10 flex-shrink-0" />
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm serif font-light text-ink truncate">
                      {trainer.name ?? 'Trainer'}
                    </div>
                    {trainer.specialty && (
                      <div className="text-[10px] uppercase tracking-[0.15em] text-ink/40 truncate">
                        {trainer.specialty}
                      </div>
                    )}
                  </div>

                  {/* Rate + Location type */}
                  <div className="flex-shrink-0 text-right">
                    {trainer.rate !== undefined && (
                      <div className="text-sm serif italic text-accent">
                        ${trainer.discountedRate ?? trainer.rate}/hr
                      </div>
                    )}
                    <div className="flex items-center gap-1 justify-end mt-0.5">
                      <LocationIcon size={10} style={{ color: pinColor }} />
                      <span className="text-[9px] uppercase tracking-[0.1em] text-ink/40">
                        {LOCATION_LABELS[trainer.location_type]}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
