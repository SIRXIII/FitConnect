import { Sparkles } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { useMatchedTrainers } from '@/hooks/useMatchedTrainers';
import { RecommendedTrainerCard } from './RecommendedTrainerCard';
import { PassportPromptCard } from './PassportPromptCard';
import { TrainerCardSkeleton } from '@/components/skeleton/TrainerCardSkeleton';

export const RecommendedCarousel: React.FC = () => {
  const { user, profile } = useAuthStore();

  // Not logged in — no carousel
  if (!user) return null;

  // Trainers don't see recommendations
  if (profile?.role === 'trainer') return null;

  return <CarouselInner />;
};

// Inner component so hooks always run (no conditional hook calls)
const CarouselInner: React.FC = () => {
  const { results, passportReady, loading } = useMatchedTrainers();

  // Loading state: 3 skeletons
  if (loading) {
    return (
      <div className="mb-16">
        <div className="flex gap-8 overflow-x-auto">
          {[0, 1, 2].map((i) => (
            <div key={i} className="w-72 flex-shrink-0 md:w-full md:flex-shrink">
              <TrainerCardSkeleton />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Passport not ready: show prompt card
  if (passportReady === false) {
    return (
      <div className="mb-16">
        <PassportPromptCard />
      </div>
    );
  }

  // No results above threshold: hide section entirely
  if (passportReady === true && results.length === 0) {
    return null;
  }

  // Carousel populated
  return (
    <div className="mb-16">
      {/* Section header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={14} className="text-accent" />
          <span className="text-[10px] uppercase tracking-[0.3em] text-ink/40">Matched for You</span>
        </div>
        <h3 className="text-[28px] serif italic font-medium">Recommended for You</h3>
      </div>

      {/* Cards: horizontal scroll on mobile, 3-col grid on desktop */}
      <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 -mx-6 px-6 md:mx-0 md:px-0 md:grid md:grid-cols-3 md:gap-8 md:overflow-visible md:snap-none">
        {results.map((r) => (
          <RecommendedTrainerCard key={r.trainer.id} result={r} />
        ))}
      </div>
    </div>
  );
};
