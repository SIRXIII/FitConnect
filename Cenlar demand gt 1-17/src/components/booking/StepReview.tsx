import { Calendar, Clock, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatSpecialty } from '@/types';
import type { SlotWithTrainer } from './BookingWizard';

interface StepReviewProps {
  slot: SlotWithTrainer;
  notes: string;
  onNotesChange: (v: string) => void;
  onNext: () => void;
}

export const StepReview: React.FC<StepReviewProps> = ({
  slot,
  notes,
  onNotesChange,
  onNext,
}) => {
  const trainerData = slot.trainer_profiles;
  const trainerName = trainerData.profiles?.full_name || 'Trainer';
  const startTime = new Date(slot.start_time);
  const endTime = new Date(slot.end_time);

  return (
    <div className="space-y-8">
      {/* Trainer info */}
      <div className="flex items-center gap-6 border border-ink/10 p-6">
        {trainerData.profiles?.avatar_url ? (
          <img
            src={trainerData.profiles.avatar_url}
            alt={trainerName}
            referrerPolicy="no-referrer"
            loading="lazy"
            decoding="async"
            className="w-16 h-16 rounded-full object-cover"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-ink/5 flex items-center justify-center text-2xl serif text-ink/20">
            {trainerName.charAt(0)}
          </div>
        )}
        <div className="space-y-1">
          <h2 className="text-xl serif font-light text-ink">{trainerName}</h2>
          <p className="text-[10px] uppercase tracking-[0.2em] text-ink/40">
            {formatSpecialty(trainerData.specialty)}
          </p>
          {trainerData.location && (
            <div className="flex items-center gap-1 text-[10px] text-ink/30">
              <MapPin size={10} />
              {trainerData.location}
            </div>
          )}
        </div>
      </div>

      {/* Session details */}
      <div className="border border-ink/10 divide-y divide-ink/5">
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar size={16} className="text-accent" />
            <span className="text-sm">
              {startTime.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
        </div>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock size={16} className="text-accent" />
            <span className="text-sm">
              {startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} -{' '}
              {endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </span>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-3">
        <label className="text-[10px] uppercase tracking-[0.2em] text-ink/40 font-medium">
          Notes for trainer (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Any specific goals, injuries, or preferences..."
          rows={3}
          className="w-full border border-ink/10 p-4 text-sm bg-transparent focus:outline-none focus:border-accent transition-colors resize-none placeholder:text-ink/20"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <Link
          to={`/trainers/${slot.trainer_id}`}
          className="border border-ink/20 px-8 py-4 text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-ink/5 transition-all duration-300"
        >
          Back to Trainer
        </Link>
        <button
          onClick={onNext}
          className="flex-1 bg-ink text-white py-4 text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-accent transition-all duration-300"
        >
          Continue to Confirm
        </button>
      </div>
    </div>
  );
};
