import { useEffect, useState } from 'react';

interface DateSliderProps {
  /** Current value as YYYY-MM-DD. */
  value: string;
  /** Called with the new YYYY-MM-DD value on release (drag end, key up, or quick-pick click). */
  onSave: (value: string) => void;
  saving?: boolean;
}

const MAX_DAYS = 365;
const DAY_MS = 24 * 60 * 60 * 1000;

function todayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(base: Date, days: number): string {
  return toDateOnly(new Date(base.getTime() + days * DAY_MS));
}

function offsetFromValue(base: Date, value: string): number {
  const parsed = new Date(`${value}T00:00:00Z`);
  const days = Math.round((parsed.getTime() - base.getTime()) / DAY_MS);
  return Math.min(MAX_DAYS, Math.max(0, days));
}

/** Next occurrence of month/day on or after today (this year, else next year). */
function nextOccurrence(base: Date, month: number, day: number): string {
  const year = base.getUTCFullYear();
  let candidate = new Date(Date.UTC(year, month - 1, day));
  if (candidate.getTime() < base.getTime()) {
    candidate = new Date(Date.UTC(year + 1, month - 1, day));
  }
  return toDateOnly(candidate);
}

const QUICK_PICKS: Array<{ label: string; month: number; day: number }> = [
  { label: 'Dec 1', month: 12, day: 1 },
  { label: 'Dec 31', month: 12, day: 31 },
  { label: 'Jan 1', month: 1, day: 1 },
];

const DateSlider: React.FC<DateSliderProps> = ({ value, onSave, saving }) => {
  const base = todayUTC();
  const [offset, setOffset] = useState(() => offsetFromValue(base, value));

  useEffect(() => {
    setOffset(offsetFromValue(base, value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const currentDate = addDays(base, offset);
  const formatted = new Date(`${currentDate}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const commit = () => {
    if (currentDate !== value) onSave(currentDate);
  };

  const pickQuick = (month: number, day: number) => {
    const date = nextOccurrence(base, month, day);
    setOffset(offsetFromValue(base, date));
    if (date !== value) onSave(date);
  };

  return (
    <div className="space-y-3">
      <p className="text-2xl serif font-light text-ink tabular-nums">{formatted}</p>
      <input
        type="range"
        min={0}
        max={MAX_DAYS}
        step={1}
        value={offset}
        disabled={saving}
        onChange={(e) => setOffset(Number(e.target.value))}
        onMouseUp={commit}
        onTouchEnd={commit}
        onKeyUp={commit}
        className="w-full accent-accent disabled:opacity-40"
      />
      <div className="flex gap-2">
        {QUICK_PICKS.map((qp) => (
          <button
            key={qp.label}
            type="button"
            onClick={() => pickQuick(qp.month, qp.day)}
            disabled={saving}
            className="px-3 py-1.5 text-[10px] uppercase tracking-[0.15em] font-medium border border-ink/10 text-ink/70 hover:text-ink hover:border-ink/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {qp.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default DateSlider;
