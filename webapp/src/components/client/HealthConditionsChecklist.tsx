import { Check } from 'lucide-react';
import { HEALTH_CONDITIONS } from '@/lib/profileConstants';

interface HealthConditionsChecklistProps {
  selected: string[]; // currently checked condition values
  otherNotes: string; // free text field
  onToggle: (value: string) => void; // toggle a condition
  onNotesChange: (notes: string) => void; // update free text
  onNotesBlur: () => void; // trigger save on blur
}

const HealthConditionsChecklist: React.FC<HealthConditionsChecklistProps> = ({
  selected,
  otherNotes,
  onToggle,
  onNotesChange,
  onNotesBlur,
}) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {HEALTH_CONDITIONS.map((condition) => {
          const isSelected = selected.includes(condition.value);
          return (
            <button
              key={condition.value}
              type="button"
              onClick={() => onToggle(condition.value)}
              className={`relative text-left py-3 px-4 border text-[11px] uppercase tracking-[0.1em] font-medium transition-all flex items-center justify-between ${
                isSelected
                  ? 'border-accent bg-accent/5 text-accent'
                  : 'border-ink/10 hover:border-ink/30 text-ink/60'
              }`}
            >
              {condition.label}
              {isSelected && <Check size={12} />}
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[10px] uppercase tracking-[0.2em] text-ink/40">
            Other Notes
          </label>
          <span className={`text-[10px] tracking-wide ${otherNotes.length > 900 ? 'text-red-500' : 'text-ink/30'}`}>
            {otherNotes.length}/1000
          </span>
        </div>
        <textarea
          value={otherNotes}
          onChange={e => onNotesChange(e.target.value.slice(0, 1000))}
          onBlur={onNotesBlur}
          rows={3}
          placeholder="e.g. Previous ACL surgery, avoid high-impact on left knee"
          className="w-full border border-ink/15 bg-transparent p-4 text-sm font-light outline-none focus:border-ink/40 transition-colors placeholder:text-ink/20 resize-none"
        />
      </div>
    </div>
  );
};

export default HealthConditionsChecklist;
