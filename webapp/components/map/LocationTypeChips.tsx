import { Dumbbell, Leaf, Home } from 'lucide-react';
import type { LocationType } from '@/types/map';
import { PIN_COLORS } from '@/types/map';

type ChipId = LocationType | 'all';

interface ChipDef {
  id: ChipId;
  label: string;
  icon: React.ElementType | null;
}

const CHIPS: ChipDef[] = [
  { id: 'all', label: 'All', icon: null },
  { id: 'gym', label: 'Gym', icon: Dumbbell },
  { id: 'park', label: 'Park', icon: Leaf },
  { id: 'in-home', label: 'In-Home', icon: Home },
];

interface LocationTypeChipsProps {
  selected: LocationType | 'all';
  onSelect: (type: LocationType | 'all') => void;
}

export function LocationTypeChips({ selected, onSelect }: LocationTypeChipsProps) {
  return (
    <div
      className="flex gap-2 overflow-x-auto scrollbar-hide"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {CHIPS.map(({ id, label, icon: Icon }) => {
        const isSelected = selected === id;
        const chipColor = id !== 'all' ? PIN_COLORS[id as LocationType] : '#1A1A1A';

        const baseClass =
          'flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-[10px] uppercase tracking-[0.2em] font-semibold cursor-pointer transition-all min-h-[44px]';

        return (
          <button
            key={id}
            onClick={() => onSelect(id)}
            className={
              isSelected
                ? baseClass
                : `${baseClass} bg-paper border border-ink/10 text-ink/60 hover:border-ink/20`
            }
            style={
              isSelected
                ? { backgroundColor: chipColor, color: 'white', border: 'none' }
                : undefined
            }
          >
            {Icon && (
              <Icon
                size={14}
                style={{ color: isSelected ? 'white' : undefined }}
                className={isSelected ? undefined : 'text-ink/60'}
              />
            )}
            {label}
          </button>
        );
      })}
    </div>
  );
}
