import { useState, useEffect, useMemo } from 'react';
import { MOCK_TRAINERS, SPECIALTIES } from '@/lib/constants';
import { PriceRange, formatSpecialty, DB_SPECIALTIES } from '@/types';
import type { Trainer } from '@/types';
import { useTrainers, type TrainerWithProfile } from '@/hooks/useTrainers';
import TrainerCard from './TrainerCard';
import { TrainerCardSkeleton } from '@/components/skeleton/TrainerCardSkeleton';
import { optimizedUrl } from '@/lib/imageUtils';
import LiveNowBadge from '@/components/shared/LiveNowBadge';
import BookingModeBadge from '@/components/shared/BookingModeBadge';

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
  };
}

const SearchSection: React.FC = () => {
  const [location, setLocation] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [priceRange, setPriceRange] = useState('');
  const [useMock, setUseMock] = useState(false);

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

  // Fall back to mock data if DB returns empty and no filters are set
  useEffect(() => {
    if (!loading && dbTrainers.length === 0 && !location && !specialty && !priceRange && !error) {
      setUseMock(true);
    } else if (dbTrainers.length > 0) {
      setUseMock(false);
    }
  }, [loading, dbTrainers.length, location, specialty, priceRange, error]);

  const displayTrainers = useMemo(() => {
    if (useMock) {
      // Apply client-side filters to mock data
      return MOCK_TRAINERS.filter((trainer) => {
        const matchLocation = trainer.location.toLowerCase().includes(location.toLowerCase());
        const matchSpecialty = specialty === '' || trainer.specialty === specialty;

        let matchPrice = true;
        if (priceRange === PriceRange.BUDGET) matchPrice = trainer.optimizedRate <= 50;
        if (priceRange === PriceRange.STANDARD) matchPrice = trainer.optimizedRate > 50 && trainer.optimizedRate <= 80;
        if (priceRange === PriceRange.PREMIUM) matchPrice = trainer.optimizedRate > 80;

        return matchLocation && matchSpecialty && matchPrice;
      });
    }

    // DB trainers — additional client-side price filtering for premium range
    let result = dbTrainers.map((t) => dbTrainerToCardData(t, idleSlotCounts[t.id] ?? 0));
    if (priceRange === PriceRange.PREMIUM) {
      result = result.filter((t) => t.optimizedRate > 80);
    }
    // Sort live trainers (availability_status === 'live') above non-live trainers
    result.sort((a, b) => (b.isLive ? 1 : 0) - (a.isLive ? 1 : 0));
    return result;
  }, [useMock, dbTrainers, location, specialty, priceRange]);

  return (
    <section id="search" className="py-32 bg-paper">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-12">
        <div className="text-center mb-20">
          <h2 className="text-4xl md:text-5xl serif font-light text-ink mb-6 italic">The Collective</h2>
          <p className="text-sm uppercase tracking-[0.3em] text-ink/40">Curated certified professionals</p>
        </div>

        {/* Search Bar */}
        <div className="mb-24">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 border-b border-ink/10 pb-12">
            <div className="space-y-4">
              <label className="block text-[10px] uppercase tracking-[0.2em] font-semibold text-ink/40">Location</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="City or Zip"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full py-2 bg-transparent border-none focus:ring-0 outline-none text-ink serif text-xl placeholder:text-ink/20"
                />
              </div>
            </div>

            <div className="space-y-4">
              <label className="block text-[10px] uppercase tracking-[0.2em] font-semibold text-ink/40">Specialty</label>
              <div className="relative">
                <select
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
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
                  onChange={(e) => setPriceRange(e.target.value)}
                  className="w-full py-2 bg-transparent border-none focus:ring-0 outline-none text-ink serif text-xl appearance-none cursor-pointer"
                >
                  <option value="">Any Range</option>
                  <option value={PriceRange.BUDGET}>Essential ($30-50)</option>
                  <option value={PriceRange.STANDARD}>Elevated ($50-80)</option>
                  <option value={PriceRange.PREMIUM}>Mastery ($80+)</option>
                </select>
              </div>
            </div>

            <div className="flex items-end">
              <button className="w-full bg-ink text-white py-4 text-[10px] uppercase tracking-[0.3em] hover:bg-accent transition-all duration-500">
                Refine Search
              </button>
            </div>
          </div>
        </div>

        {/* Results */}
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
                {!useMock && (trainer.isLive || trainer.bookingMode) && (
                  <div className="flex items-center gap-3">
                    {trainer.isLive && <LiveNowBadge />}
                    {trainer.bookingMode && (
                      <BookingModeBadge mode={trainer.bookingMode} />
                    )}
                  </div>
                )}
                <TrainerCard trainer={trainer} isMock={useMock} />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-32 border border-dashed border-ink/10">
            <h3 className="text-3xl serif font-light text-ink mb-4 italic">No matches found</h3>
            <p className="text-sm uppercase tracking-widest text-ink/40 mb-8">Adjust your criteria for the collective</p>
            <button
              onClick={() => {
                setLocation('');
                setSpecialty('');
                setPriceRange('');
              }}
              className="text-[10px] uppercase tracking-[0.2em] border-b border-ink/20 hover:border-ink transition-all pb-1"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default SearchSection;
