import React from 'react';
import { Star, MapPin, Award, CheckCircle } from 'lucide-react';
import { Trainer } from '../types';

interface TrainerCardProps {
  trainer: Trainer;
}

const TrainerCard: React.FC<TrainerCardProps> = ({ trainer }) => {
  return (
    <div className="group space-y-6">
      <div className="relative aspect-[4/5] overflow-hidden bg-ink/5">
        <img 
          src={trainer.imageUrl} 
          alt={trainer.name} 
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-1000"
        />
        {trainer.availableNow && (
          <div className="absolute top-6 right-6 bg-paper px-4 py-1.5 text-[9px] uppercase tracking-[0.2em] font-semibold text-ink shadow-sm">
            Available
          </div>
        )}
        <div className="absolute inset-0 bg-ink/0 group-hover:bg-ink/5 transition-colors duration-500"></div>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <h3 className="text-2xl serif font-light text-ink">{trainer.name}</h3>
            <div className="flex items-center text-ink/40 text-[10px] uppercase tracking-widest">
              <MapPin size={10} className="mr-1.5" />
              {trainer.location}
            </div>
          </div>
          <div className="text-right">
            <div className="text-ink/30 text-[10px] line-through tracking-widest">${trainer.hourlyRate}</div>
            <div className="text-accent text-xl serif italic">${trainer.discountedRate}</div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-ink/5">
          <div className="flex items-center text-ink/60 text-[10px] uppercase tracking-[0.15em] font-medium">
            <Award size={12} className="mr-2 text-accent" />
            {trainer.specialty}
          </div>
          <div className="flex items-center text-accent text-[10px] font-semibold tracking-widest">
            <Star size={10} fill="currentColor" className="mr-1" />
            {trainer.rating}
          </div>
        </div>

        <button className="w-full border border-ink/10 py-4 text-[10px] uppercase tracking-[0.3em] hover:bg-ink hover:text-white transition-all duration-500">
          Request Session
        </button>
      </div>
    </div>
  );
};

export default TrainerCard;