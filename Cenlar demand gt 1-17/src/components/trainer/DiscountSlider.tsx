import { useState, useEffect, useRef } from 'react';
import { Tag } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';

interface DiscountSliderProps {
  currentDiscount: number;  // 0–80
  optimizedRate: number;
  onSaved: (newDiscount: number) => void;
}

export function computeDiscountedRate(optimizedRate: number, discountPct: number): number {
  if (discountPct <= 0) return optimizedRate;
  return Math.round(optimizedRate * (1 - discountPct / 100) * 100) / 100;
}

const DiscountSlider: React.FC<DiscountSliderProps> = ({ currentDiscount, optimizedRate, onSaved }) => {
  const { trainerProfile } = useAuthStore();
  const [value, setValue] = useState(currentDiscount);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const prevSaved = useRef(currentDiscount);

  // Sync if parent updates (e.g. profile refetch)
  useEffect(() => {
    setValue(currentDiscount);
    prevSaved.current = currentDiscount;
    setDirty(false);
  }, [currentDiscount]);

  const discountedRate = computeDiscountedRate(optimizedRate, value);
  const saving24h = Math.round(discountedRate * 10) / 10;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = Number(e.target.value);
    setValue(next);
    setDirty(next !== prevSaved.current);
  };

  const handleSave = async () => {
    if (!trainerProfile) return;
    setSaving(true);
    try {
      const queryPromise = supabase
        .from('trainer_profiles')
        .update({ discount_percentage: value })
        .eq('id', trainerProfile.id)
        .then((r) => r);

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out. Please try again.')), 10000)
      );

      const { error } = await Promise.race([queryPromise, timeoutPromise]);

      if (error) throw error;

      prevSaved.current = value;
      setDirty(false);
      onSaved(value);
      toast.success(value > 0 ? `Discount set to ${value}% — sessions now $${saving24h}/hr` : 'Discount removed.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save discount. Please try again.';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const pct = (value / 80) * 100;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Tag size={14} className="text-accent" />
            <p className="text-xs uppercase tracking-[0.2em] text-ink/40 font-medium">Session Discount</p>
          </div>
          {value > 0 ? (
            <p className="text-sm text-ink/60">
              Clients see{' '}
              <span className="line-through text-ink/30">${optimizedRate}</span>
              {' → '}
              <span className="text-accent font-medium">${discountedRate}/hr</span>
              {' '}
              <span className="text-[10px] uppercase tracking-[0.1em] text-accent/70">({value}% off)</span>
            </p>
          ) : (
            <p className="text-sm text-ink/40">No discount — full optimized rate applied</p>
          )}
        </div>
        <div className="text-right space-y-1">
          <p className="text-3xl serif font-light text-ink">
            {value > 0 ? (
              <span className="text-accent">{value}%</span>
            ) : (
              <span className="text-ink/30">—</span>
            )}
          </p>
          {value > 0 && (
            <p className="text-[10px] uppercase tracking-[0.1em] text-ink/30">off</p>
          )}
        </div>
      </div>

      {/* Slider */}
      <div className="space-y-3">
        <div className="relative">
          <input
            type="range"
            min={0}
            max={80}
            step={5}
            value={value}
            onChange={handleChange}
            className="w-full h-1 appearance-none bg-ink/10 outline-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, var(--color-accent, #C5A059) 0%, var(--color-accent, #C5A059) ${pct}%, rgba(26,26,26,0.1) ${pct}%, rgba(26,26,26,0.1) 100%)`,
            }}
          />
        </div>
        <div className="flex justify-between text-[9px] uppercase tracking-[0.15em] text-ink/25">
          <span>None</span>
          <span>20%</span>
          <span>40%</span>
          <span>60%</span>
          <span>80%</span>
        </div>
      </div>

      {dirty && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="border border-accent text-accent px-8 py-2.5 text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-accent hover:text-white transition-all duration-300 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Discount'}
        </button>
      )}
    </div>
  );
};

export default DiscountSlider;
