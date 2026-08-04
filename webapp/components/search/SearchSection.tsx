import { useState, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SPECIALTIES } from '@/lib/constants';
import { PriceRange, formatSpecialty, DB_SPECIALTIES } from '@/types';
import type { Trainer } from '@/types';
import { useTrainers, type TrainerWithProfile } from '@/hooks/useTrainers';
import TrainerCard from './TrainerCard';
import { TrainerCardSkeleton } from '@/components/skeleton/TrainerCardSkeleton';
import { optimizedUrl } from '@/lib/imageUtils';
import LiveNowBadge from '@/components/shared/LiveNowBadge';
import BookingModeBadge from '@/components/shared/BookingModeBadge';
import { MapListToggle } from './MapListToggle';
import { MapView } from './MapView';
import { RecommendedCarousel } from '@/components/recommendations/RecommendedCarousel';
import { LookingNowToggle } from './LookingNowToggle';
import { useAuthStore } from '@/stores/auth';

function dbTrainerToCardData(t: TrainerWithProfile, idleSlotCount = 0): Trainer {
  const discountPct = t.discount_percentage ?? 0;
  const optimizedRate = Number(t.optimized_rate);
  const discountedRate = discountPct > 0
    ? Math.round(optimizedRate * (1 - discountPct / 100) * 100) / 100
    : optimizedRate;

  return {
    id: t.id,
    name: t.profiles?.full_name || 'Trainer',
    location: t.location || 'Location not set',
    specialty: formatSpecialty(t.specialty),
    rating: Number(t.rating) || 0,
    reviewCount: t.review_count || 0,
    hourlyRate: Number(t.hourly_rate),
    optimizedRate,
    discountPercentage: discountPct,
    discountedRate,
    imageUrl: t.profiles?.avatar_url || optimizedUrl('https://images.unsplash.com/photo-1534438327276-14e5300c3a48?ixlib=rb-4.0.3&auto=format&fit=crop'),
    verified: t.verified,
    availableNow: false,
    idleSlotCount,
    isLive: t.availability_status === 'live',
    bookingMode: t.booking_mode as 'instant' | 'request',
    intro_video_url: t.intro_video_url ?? null,
  };
}

const SearchSection: React.FC = () => {
  const { profile } = useAuthStore();
  const [location, setLocation] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [priceRange, setPriceRange] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [hasSearched, setHasSearched] = useState(false);

  // Query Supabase for trainers with filters
  const { trainers: dbTrainers, loading, error, idleSlotCounts } = useTrainers({
    specialty: specialty
      ? DB_SPECIALTIES.find(
          (s) => formatSpecialty(s) === specialty
        ) || undefined
      : undefined,
    maxRate: priceRange === PriceRange.BUDGET
      ? 50
      : priceRange === PriceRange.STANDARD
        ? 80
        : undefined,
    location: location || undefined,
  });

  const displayTrainers = useMemo(() => {
    // DB trainers — additional client-side price filtering for premium range
    let result = dbTrainers.map((t) => dbTrainerToCardData(t, idleSlotCounts[t.id] ?? 0));
    if (priceRange === PriceRange.PREMIUM) {
      result = result.filter((t) => t.optimizedRate > 80);
    }
    // Sort live trainers (availability_status === 'live') above non-live trainers
    result.sort((a, b) => (b.isLive ? 1 : 0) - (a.isLive ? 1 : 0));
    return result;
  }, [dbTrainers, idleSlotCounts, priceRange]);

  return (
    <section id="search" className="py-16 md:py-32 bg-paper">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
        <div className="text-center mb-10 md:mb-20">
          <h2 className="text-4xl md:text-5xl serif font-light text-ink mb-6 italic">The Collective</h2>
          <p className="text-sm uppercase tracking-[0.3em] text-ink/40">Curated certified professionals</p>
        </div>

        {/* Search Bar */}
        <div className="mb-10 md:mb-24">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 md:gap-12 border-b border-ink/10 pb-12">
            <div className="space-y-4">
              <label className="block text-[10px] uppercase tracking-[0.2em] font-semibold text-ink/40">Location</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="City or Zip"
                  value={location}
                  onChange={(e) => { setLocation(e.target.value); setHasSearched(true); }}
                  className="w-full py-2 bg-transparent border-none focus:ring-0 outline-none text-ink serif text-xl placeholder:text-ink/20"
                />
              </div>
            </div>

            <div className="space-y-4">
              <label className="block text-[10px] uppercase tracking-[0.2em] font-semibold text-ink/40">Specialty</label>
              <div className="relative">
                <select
                  value={specialty}
                  onChange={(e) => { setSpecialty(e.target.value); setHasSearched(true); }}
                  className="w-full py-2 bg-transparent border-none focus:ring-0 outline-none text-ink serif text-xl appearance-none cursor-pointer"
                >
                  <option value="">All Disciplines</option>
                  {SPECIALTIES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-4">
              <label className="block text-[10px] uppercase tracking-[0.2em] font-semibold text-ink/40">Investment</label>
              <div className="relative">
                <select
                  value={priceRange}
                  onChange={(e) => { setPriceRange(e.target.value); setHasSearched(true); }}
                  className="w-full py-2 bg-transparent border-none focus:ring-0 outline-none text-ink serif text-xl appearance-none cursor-pointer"
                >
                  <option value="">Any Range</option>
                  <option value={PriceRange.BUDGET}>Essential ($30-50)</option>
                  <option value={PriceRange.STANDARD}>Elevated ($50-80)</option>
                  <option value={PriceRange.PREMIUM}>Mastery ($80+)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center sm:items-end justify-between gap-4 sm:col-span-2 md:col-span-1">
              <button className="flex-1 bg-ink text-white py-4 text-[10px] uppercase tracking-[0.3em] hover:bg-accent transition-all duration-500">
                Refine Search
              </button>
              <div className="flex items-center gap-3">
                {profile?.role === 'client' && <LookingNowToggle />}
                <MapListToggle viewMode={viewMode} onChange={setViewMode} />
              </div>
            </div>
          </div>
        </div>

        {/* Recommendations - only in list view */}
        {viewMode === 'list' && <RecommendedCarousel />}

        {/* Results */}
        <AnimatePresence mode="wait">
          {viewMode === 'list' ? (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-20">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <TrainerCardSkeleton key={i} />
                  ))}
                </div>
              ) : displayTrainers.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-20">
                  {displayTrainers.map((trainer) => (
                    <div key={trainer.id} className="space-y-2">
                      {(trainer.isLive || trainer.bookingMode) && (
                        <div className="flex items-center gap-3">
                          {trainer.isLive && <LiveNowBadge />}
                          {trainer.bookingMode && (
                            <BookingModeBadge mode={trainer.bookingMode} />
                          )}
                        </div>
                      )}
                      <TrainerCard trainer={trainer} isMock={false} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-32 border border-dashed border-ink/10">
                  {hasSearched ? (
                    <>
                      <h3 className="text-3xl serif font-light text-ink mb-4 italic">No matches found</h3>
                      <p className="text-sm uppercase tracking-widest text-ink/40 mb-8">Adjust your criteria for the collective</p>
                      <button
                        onClick={() => {
                          setLocation('');
                          setSpecialty('');
                          setPriceRange('');
                          setHasSearched(false);
                        }}
                        className="text-[10px] uppercase tracking-[0.2em] border-b border-ink/20 hover:border-ink transition-all pb-1"
                      >
                        Reset Filters
                      </button>
                    </>
                  ) : (
                    <>
                      <svg className="w-10 h-10 mx-auto mb-6 text-ink/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
                      </svg>
                      <h3 className="text-3xl serif font-light text-ink mb-4 italic">No trainers available yet</h3>
                      <p className="text-sm tracking-wide text-ink/40">Be the first to join the collective</p>
                    </>
                  )}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="map"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <MapView
                filters={{
                  specialty: specialty || undefined,
                  maxRate:
                    priceRange === PriceRange.BUDGET
                      ? 50
                      : priceRange === PriceRange.STANDARD
                      ? 80
                      : undefined,
                  location: location || undefined,
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
};

export default SearchSection;
