import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Crown, Star, MapPin } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface FeaturedTrainer {
  id: string;
  specialty: string;
  rating: number;
  review_count: number;
  location: string;
  profiles: { full_name: string; avatar_url: string | null } | null;
}

const FeaturedTrainers: React.FC = () => {
  // null = loading (no render), [] = loaded but empty (no render), [...] = show section
  const [trainers, setTrainers] = useState<FeaturedTrainer[] | null>(null);

  useEffect(() => {
    supabase
      .from('trainer_profiles')
      .select(`
        id, specialty, rating, review_count, location,
        profiles!trainer_profiles_user_id_fkey (full_name, avatar_url)
      `)
      .eq('subscription_tier', 'elite')
      .eq('verified', true)
      .order('rating', { ascending: false })
      .limit(6)
      .then(({ data }) => {
        setTrainers((data as unknown as FeaturedTrainer[]) ?? []);
      });
  }, []);

  // Renders nothing while loading (null) or when no Elite trainers exist ([])
  if (!trainers || trainers.length === 0) return null;

  return (
    <section className="bg-paper py-20 px-6">
      <div className="max-w-6xl mx-auto space-y-10">
        <div className="flex items-center gap-3">
          <Crown size={16} className="text-accent" />
          <h2 className="text-[10px] uppercase tracking-[0.3em] text-ink/40 font-medium">
            Featured Trainers
          </h2>
        </div>
        <p className="serif text-3xl font-light italic text-ink">Elite Coaches</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {trainers.map((trainer) => {
            const name = trainer.profiles?.full_name ?? 'Trainer';
            const avatar = trainer.profiles?.avatar_url;
            return (
              <Link
                key={trainer.id}
                to={`/trainers/${trainer.id}`}
                className="border border-ink/10 p-6 space-y-4 hover:border-accent/30 transition-colors group"
              >
                <div className="flex items-center gap-4">
                  {avatar ? (
                    <img
                      src={avatar}
                      alt={name}
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      decoding="async"
                      className="w-12 h-12 object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-ink/5 flex items-center justify-center text-lg serif text-ink/30">
                      {name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-ink group-hover:text-accent transition-colors">
                      {name}
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.15em] text-ink/40">
                      {trainer.specialty.replace(/_/g, ' ')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-accent">
                    <Star size={11} fill="currentColor" />
                    <span className="text-xs font-medium">
                      {Number(trainer.rating).toFixed(1)}
                    </span>
                    {trainer.review_count > 0 && (
                      <span className="text-ink/30 text-[10px]">({trainer.review_count})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-ink/40">
                    <MapPin size={11} />
                    <span className="text-[10px]">{trainer.location}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FeaturedTrainers;
