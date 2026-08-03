import { INTENSITY_LEVELS } from '@/lib/profileConstants';

interface IntensitySliderProps {
  value: string | null; // 'light' | 'moderate' | 'intense' | null
  onChange: (value: string) => void;
}

const IntensitySlider: React.FC<IntensitySliderProps> = ({ value, onChange }) => {
  return (
    <div className="space-y-2">
      <div className="relative flex gap-2">
        {/* Connecting track */}
        <div className="absolute top-1/2 left-0 right-0 h-px bg-ink/10 -z-10" />

        {INTENSITY_LEVELS.map((level) => {
          const isSelected = value === level.value;
          return (
            <button
              key={level.value}
              type="button"
              onClick={() => onChange(level.value)}
              className={`flex-1 min-h-[60px] py-3 px-2 border text-left transition-all duration-300 ${
                isSelected
                  ? level.color
                  : 'border-ink/10 text-ink/60 hover:border-ink/30'
              }`}
            >
              <span className="block text-[11px] uppercase tracking-[0.1em] font-medium">
                {level.label}
              </span>
              <span className="block text-[9px] text-ink/40 normal-case tracking-normal mt-0.5">
                {level.desc}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default IntensitySlider;
