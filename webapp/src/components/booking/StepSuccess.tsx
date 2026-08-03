import { Check, Calendar, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

interface StepSuccessProps {
  trainerName: string;
  sessionDate: string;
  sessionEndDate: string;
  rate: number;
  stripeConfigured: boolean;
}

export const StepSuccess: React.FC<StepSuccessProps> = ({
  trainerName,
  sessionDate,
  sessionEndDate,
  rate,
  stripeConfigured,
}) => {
  const startTime = new Date(sessionDate);
  const endTime = new Date(sessionEndDate);

  return (
    <div className="text-center space-y-8">
      <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto">
        <Check size={28} className="text-accent" />
      </div>
      <div className="space-y-3">
        <h1 className="text-3xl serif font-light italic text-ink">
          {stripeConfigured ? 'Booking Confirmed' : 'Session Requested'}
        </h1>
        <p className="text-sm text-ink/50">
          {stripeConfigured
            ? `Your session with ${trainerName} has been booked and payment processed.`
            : `Your booking request has been sent to ${trainerName}. You'll be notified once they confirm.`}
        </p>
      </div>

      <div className="border border-ink/10 p-6 text-left space-y-3">
        <p className="text-[10px] uppercase tracking-[0.2em] text-ink/40 font-medium">
          Booking Details
        </p>
        <div className="flex items-center gap-2 text-sm text-ink/70">
          <Calendar size={14} />
          {startTime.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </div>
        <div className="flex items-center gap-2 text-sm text-ink/70">
          <Clock size={14} />
          {startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} -{' '}
          {endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
        </div>
        <p className="text-lg serif font-light text-accent">${rate}</p>
      </div>

      <div className="flex gap-4 justify-center">
        <Link
          to="/client/dashboard"
          className="border border-ink/20 px-8 py-3 text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-ink hover:text-white transition-all duration-300"
        >
          My Dashboard
        </Link>
        <Link
          to="/trainers"
          className="border border-ink/20 px-8 py-3 text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-ink hover:text-white transition-all duration-300"
        >
          Browse More
        </Link>
      </div>
    </div>
  );
};
