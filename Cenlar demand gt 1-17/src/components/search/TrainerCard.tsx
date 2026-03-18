import { Star, MapPin, Award, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Trainer } from '@/types';
import { optimizedUrl } from '@/lib/imageUtils';

interface TrainerCardProps {
  trainer: Trainer;
  isMock?: boolean;
}

const TrainerCard: React.FC<TrainerCardProps> = ({ trainer, isMock }) => {
  const profileUrl = isMock ? '#' : `/trainers/${trainer.id}`;

  return (
    <div className="group space-y-6">
      <Link to={profileUrl} className="block relative aspect-[4/5] overflow-hidden bg-ink/5">
        <img
          src={optimizedUrl(trainer.imageUrl)}
          alt={trainer.name}
          referrerPolicy="no-referrer"
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-1000"
        />
        {trainer.availableNow && (
          <div className="absolute top-6 right-6 bg-paper px-4 py-1.5 text-[9px] uppercase tracking-[0.2em] font-semibold text-ink shadow-sm">
            Available
          </div>
        )}
        <div className="absolute inset-0 bg-ink/0 group-hover:bg-ink/5 transition-colors duration-500" />
      </Link>

      <div className="space-y-4">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <Link to={profileUrl}>
              <h3 className="text-2xl serif font-light text-ink hover:text-accent transition-colors">
                {trainer.name}
              </h3>
            </Link>
            <div className="flex items-center text-ink/40 text-[10px] uppercase tracking-widest">
              <MapPin size={10} className="mr-1.5" />
              {trainer.location}
            </div>
          </div>
          <div className="text-right space-y-0.5">
            {trainer.discountPercentage > 0 ? (
              <>
                <div className="flex items-center justify-end">
                  <span className="bg-accent text-white text-[8px] uppercase tracking-[0.1em] px-1.5 py-0.5 font-semibold">
                    {trainer.discountPercentage}% off
                  </span>
                </div>
                <div className="text-accent text-xl serif italic">
                  ${trainer.discountedRate}
                  <span className="text-[10px] text-ink/30 not-italic">/hr</span>
                </div>
                <div className="text-[10px] text-ink/25 line-through">${trainer.optimizedRate}/hr</div>
              </>
            ) : (
              <>
                <div className="text-[9px] uppercase tracking-widest text-ink/30">Optimized Rate</div>
                <div className="text-accent text-xl serif italic">
                  ${trainer.optimizedRate}
                  <span className="text-[10px] text-ink/30 not-italic">/hr</span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-ink/5">
          <div className="flex items-center text-ink/60 text-[10px] uppercase tracking-[0.15em] font-medium">
            <Award size={12} className="mr-2 text-accent" />
            {trainer.specialty}
          </div>
          <div className="flex items-center gap-3">
            {(trainer.idleSlotCount ?? 0) > 0 && (
              <div className="flex items-center text-amber-600 text-[9px] uppercase tracking-widest font-medium">
                <Clock size={9} className="mr-1" />
                {trainer.idleSlotCount} idle
              </div>
            )}
            <div className="flex items-center text-accent text-[10px] font-semibold tracking-widest">
              <Star size={10} fill="currentColor" className="mr-1" />
              {trainer.rating > 0 ? Number(trainer.rating).toFixed(1) : 'New'}
            </div>
          </div>
        </div>

        <Link
          to={profileUrl}
          className="block w-full text-center border border-ink/10 py-4 text-[10px] uppercase tracking-[0.3em] hover:bg-ink hover:text-white transition-all duration-500"
        >
          View Profile
        </Link>
      </div>
    </div>
  );
};

export default TrainerCard;
