import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { bufferTimeSchema, BUFFER_OPTIONS } from '@/lib/schemas';

interface BufferTimeSelectorProps {
  currentBuffer: number;
  trainerId: string;
  onBufferChange: (minutes: number) => void;
}

const LABELS: Record<number, string> = {
  0: 'None',
  15: '15 min',
  30: '30 min',
  45: '45 min',
  60: '60 min',
};

const BufferTimeSelector: React.FC<BufferTimeSelectorProps> = ({
  currentBuffer,
  trainerId,
  onBufferChange,
}) => {
  const [selected, setSelected] = useState(currentBuffer);
  const [saving, setSaving] = useState(false);

  const hasChanged = selected !== currentBuffer;

  const handleSave = async () => {
    setSaving(true);
    try {
      bufferTimeSchema.parse({ buffer_minutes: selected });

      const { error } = await supabase
        .from('trainer_profiles')
        .update({ buffer_minutes: selected })
        .eq('id', trainerId);

      if (error) throw error;

      onBufferChange(selected);
      toast.success(
        selected === 0
          ? 'Buffer time removed'
          : `Buffer time updated to ${selected} minutes`
      );
    } catch {
      toast.error('Failed to update buffer time');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-ink/10 rounded-lg p-6 space-y-6">
      <div className="space-y-2">
        <h3 className="text-xl serif font-light italic text-ink">
          Buffer Time Between Sessions
        </h3>
        <p className="text-sm text-ink/50">
          Set the minimum time needed between your sessions for travel or preparation.
        </p>
      </div>

      {/* Buffer options */}
      <div className="flex flex-wrap gap-2">
        {BUFFER_OPTIONS.map((option) => (
          <button
            key={option}
            onClick={() => setSelected(option)}
            className={`px-5 py-2.5 text-[10px] uppercase tracking-[0.2em] font-medium border transition-all duration-300 rounded-full ${
              selected === option
                ? 'bg-ink text-paper border-ink'
                : 'border-ink/20 text-ink/60 hover:border-ink hover:text-ink'
            }`}
          >
            {LABELS[option]}
          </button>
        ))}
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={!hasChanged || saving}
        className="border border-ink/20 px-6 py-2.5 text-[10px] uppercase tracking-[0.2em] font-medium transition-all duration-300 hover:bg-ink hover:text-paper disabled:opacity-30 disabled:cursor-not-allowed"
      >
        {saving ? 'Saving...' : 'Save Buffer Time'}
      </button>
    </div>
  );
};

export default BufferTimeSelector;
