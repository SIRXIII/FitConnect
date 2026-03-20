import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Zap, Clock, Star } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { buildIdleSlotCounts } from '@/lib/scheduling';
import { formatSpecialty } from '@/types';
import { MOCK_TRAINERS } from '@/lib/constants';
import { TrainerCardSkeleton } from '@/components/skeleton/TrainerCardSkeleton';
import { useAuthStore } from '@/stores/auth';
import { toast } from 'sonner';

interface DealTrainer {
  id: string;
  name: string;
  avatarUrl: string | null;
  specialty: string;
  optimizedRate: number;
  discountPercentage: number;
  discountedRate: number;
  rating: number;
  idleSlotCount: number;
}

const BestDeals: React.FC = () => {
  const [deals, setDeals] = useState<DealTrainer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDeals = async () => {
      // Fetch trainers with active discounts
      const { data: trainers } = await supabase
        .from('trainer_profiles')
        .select(`
          id, specialty, optimized_rate, discount_percentage, rating,
          profiles!trainer_profiles_user_id_fkey (full_name, avatar_url)
        `)
        .gt('discount_percentage', 0);

      if (!trainers?.length) {
        // Fall back to mock deals when DB has no data
        const mockDeals = MOCK_TRAINERS
          .filter((t) => t.discountPercentage > 0 && t.idleSlotCount > 0)
          .sort((a, b) => b.discountPercentage - a.discountPercentage)
          .slice(0, 3)
          .map((t) => ({
            id: t.id,
            name: t.name,
            avatarUrl: t.imageUrl,
            specialty: t.specialty,
            optimizedRate: t.optimizedRate,
            discountPercentage: t.discountPercentage,
            discountedRate: t.discountedRate,
            rating: t.rating,
            idleSlotCount: t.idleSlotCount,
          }));
        setDeals(mockDeals);
        setLoading(false);
        return;
      }

      // Fetch unbooked future slots for these trainers
      const { data: slots } = await supabase
        .from('availability_slots')
        .select('trainer_id, start_time, is_booked, deleted_at')
        .in('trainer_id', trainers.map((t) => t.id))
        .eq('is_booked', false)
        .is('deleted_at', null)
        .gte('start_time', new Date().toISOString());

      type SlotRow = { trainer_id: string; start_time: string; is_booked: boolean; deleted_at: string | null };
      const idleCounts = buildIdleSlotCounts((slots ?? []) as SlotRow[]);

      const withIdle = trainers
        .filter((t) => (idleCounts[t.id] ?? 0) > 0)
        .sort((a, b) => b.discount_percentage - a.discount_percentage)
        .slice(0, 3)
        .map((t: any) => {
          const profile = Array.isArray(t.profiles) ? t.profiles[0] : t.profiles;
          const optimizedRate = Number(t.optimized_rate);
          return {
            id: t.id,
            name: profile?.full_name || 'Trainer',
            avatarUrl: profile?.avatar_url ?? null,
            specialty: formatSpecialty(t.specialty),
            optimizedRate,
            discountPercentage: t.discount_percentage,
            discountedRate: Math.round(optimizedRate * (1 - t.discount_percentage / 100) * 100) / 100,
            rating: Number(t.rating) || 0,
            idleSlotCount: idleCounts[t.id] ?? 0,
          };
        });

      // If DB trainers exist but none have idle slots, fall back to mock data
      if (withIdle.length === 0) {
        const mockDeals = MOCK_TRAINERS
          .filter((t) => t.discountPercentage > 0 && t.idleSlotCount > 0)
          .sort((a, b) => b.discountPercentage - a.discountPercentage)
          .slice(0, 3)
          .map((t) => ({
            id: t.id,
            name: t.name,
            avatarUrl: t.imageUrl,
            specialty: t.specialty,
            optimizedRate: t.optimizedRate,
            discountPercentage: t.discountPercentage,
            discountedRate: t.discountedRate,
            rating: t.rating,
            idleSlotCount: t.idleSlotCount,
          }));
        setDeals(mockDeals);
        setLoading(false);
        return;
      }

      setDeals(withIdle);
      setLoading(false);
    };

    fetchDeals();
  }, []);

  if (!loading && deals.length === 0) return null;

  return (
    <section className="py-28 bg-ink text-white">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-12">

        {/* Header */}
        <div className="flex items-end justify-between mb-16">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Zap size={16} className="text-accent" strokeWidth={1.5} />
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">AI-Classified Idle Hours</p>
            </div>
            <h2 className="text-4xl md:text-5xl serif font-light italic text-white">Best Deals Now</h2>
            <p className="text-sm text-white/40 max-w-lg">
              Trainers with open idle hours offering discounts — classified by our scheduling engine in real time.
            </p>
          </div>
          <a
            href="/#search"
            className="hidden md:block text-[10px] uppercase tracking-[0.2em] text-white/40 hover:text-white border-b border-white/20 hover:border-white pb-1 transition-all"
          >
            See all trainers
          </a>
        </div>

        {/* Deal cards */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <TrainerCardSkeleton />
            <TrainerCardSkeleton />
            <TrainerCardSkeleton />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {deals.map((deal) => (
              <DealCard key={deal.id} deal={deal} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

const DealCard: React.FC<{ deal: DealTrainer }> = ({ deal }) => {
  const initials = deal.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  const user = useAuthStore((s) => s.user);

  const bookUrl = user
    ? `/trainers/${deal.id}?book=true`
    : `/login?redirect=${encodeURIComponent(`/trainers/${deal.id}?book=true`)}`;

  const handleBookClick = () => {
    if (!user) {
      toast('Sign in to book this session', { duration: 3000 });
    }
  };

  return (
    <div className="border border-white/10 p-8 space-y-6 hover:border-white/25 transition-colors duration-500">
      {/* Top row: avatar + discount badge */}
      <div className="flex items-start justify-between">
        <Link to={`/trainers/${deal.id}`} className="flex items-center gap-4 group">
          {deal.avatarUrl ? (
            <img
              src={deal.avatarUrl}
              alt={deal.name}
              referrerPolicy="no-referrer"
              loading="lazy"
              decoding="async"
              className="w-12 h-12 rounded-full object-cover group-hover:opacity-80 transition-opacity"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-sm font-medium text-white/60">
              {initials}
            </div>
          )}
          <div>
            <p className="text-base font-medium text-white group-hover:text-accent transition-colors">{deal.name}</p>
            <p className="text-[10px] uppercase tracking-widest text-white/40 mt-0.5">{deal.specialty}</p>
          </div>
        </Link>
        <span className="bg-accent text-white text-[9px] uppercase tracking-[0.15em] px-2.5 py-1 font-semibold shrink-0">
          {deal.discountPercentage}% off
        </span>
      </div>

      {/* Rate */}
      <div className="space-y-1">
        <div className="flex items-baseline gap-3">
          <span className="text-3xl serif font-light text-accent">${deal.discountedRate}</span>
          <span className="text-[10px] text-white/30 not-italic">/hr</span>
          <span className="text-sm text-white/20 line-through">${deal.optimizedRate}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between pt-4 border-t border-white/8">
        <div className="flex items-center gap-1.5 text-amber-400 text-[10px] uppercase tracking-widest font-medium">
          <Clock size={10} />
          {deal.idleSlotCount} idle slot{deal.idleSlotCount !== 1 ? 's' : ''}
        </div>
        {deal.rating > 0 && (
          <div className="flex items-center gap-1 text-accent text-[10px] font-semibold tracking-widest">
            <Star size={10} fill="currentColor" />
            {deal.rating.toFixed(1)}
          </div>
        )}
      </div>

      <Link
        to={bookUrl}
        onClick={handleBookClick}
        className="block w-full text-center border border-white/20 py-3.5 text-[10px] uppercase tracking-[0.3em] hover:bg-white hover:text-ink transition-all duration-500"
      >
        Book This Deal
      </Link>
    </div>
  );
};

export default BestDeals;
