import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Star, MapPin, Award, Shield, ChevronLeft, Calendar, Clock } from 'lucide-react';
import { useTrainerById } from '@/hooks/useTrainers';
import { formatSpecialty } from '@/types';
import { supabase } from '@/lib/supabase';
import type { AvailabilitySlot } from '@/hooks/useAvailability';

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  profiles: {
    full_name: string;
    avatar_url: string | null;
  };
}

const TrainerProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { trainer, loading } = useTrainerById(id);
  const [availableSlots, setAvailableSlots] = useState<AvailabilitySlot[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);

  // Fetch available slots for this trainer
  useEffect(() => {
    if (!id) return;

    const fetchSlots = async () => {
      setLoadingSlots(true);
      const { data } = await supabase
        .from('availability_slots')
        .select('*')
        .eq('trainer_id', id)
        .eq('is_booked', false)
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true })
        .limit(21);

      setAvailableSlots((data as AvailabilitySlot[]) || []);
      setLoadingSlots(false);
    };

    const fetchReviews = async () => {
      const { data } = await supabase
        .from('reviews')
        .select(`
          id, rating, comment, created_at,
          profiles:client_id (full_name, avatar_url)
        `)
        .eq('trainer_id', id)
        .order('created_at', { ascending: false })
        .limit(10);

      setReviews((data as unknown as Review[]) || []);
    };

    fetchSlots();
    fetchReviews();
  }, [id]);

  // Group available slots by date
  const slotsByDate = useMemo(() => {
    const grouped: Record<string, AvailabilitySlot[]> = {};
    availableSlots.forEach((slot) => {
      const date = new Date(slot.start_time).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(slot);
    });
    return grouped;
  }, [availableSlots]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="w-6 h-6 border border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!trainer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper pt-32">
        <div className="text-center space-y-6">
          <h2 className="text-3xl serif font-light italic text-ink">Trainer not found</h2>
          <Link
            to="/trainers"
            className="inline-block border border-ink/20 px-10 py-3 text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-ink hover:text-white transition-all duration-300"
          >
            Browse Trainers
          </Link>
        </div>
      </div>
    );
  }

  const name = trainer.profiles?.full_name || 'Trainer';
  const avatar = trainer.profiles?.avatar_url;
  const rating = Number(trainer.rating);
  const certs = trainer.certifications || [];

  return (
    <div className="min-h-screen bg-paper pt-28 pb-20">
      <div className="max-w-6xl mx-auto px-6">
        {/* Back link */}
        <Link
          to="/trainers"
          className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-ink/40 hover:text-ink transition-colors mb-12"
        >
          <ChevronLeft size={14} />
          Back to Trainers
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
          {/* Left column — photo & info */}
          <div className="lg:col-span-1 space-y-8">
            {/* Photo */}
            <div className="aspect-[4/5] overflow-hidden bg-ink/5">
              {avatar ? (
                <img
                  src={avatar}
                  alt={name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-6xl serif text-ink/20">
                  {name.charAt(0)}
                </div>
              )}
            </div>

            {/* Quick stats */}
            <div className="space-y-4 border border-ink/10 p-6">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-[0.2em] text-ink/40">Rating</span>
                <div className="flex items-center gap-1 text-accent">
                  <Star size={12} fill="currentColor" />
                  <span className="text-sm font-medium">
                    {rating > 0 ? rating.toFixed(1) : 'New'}
                  </span>
                  {trainer.review_count > 0 && (
                    <span className="text-ink/30 text-[10px]">({trainer.review_count})</span>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-ink/5 pt-4">
                <span className="text-[10px] uppercase tracking-[0.2em] text-ink/40">Location</span>
                <div className="flex items-center gap-1 text-sm text-ink/60">
                  <MapPin size={12} />
                  {trainer.location || 'Not specified'}
                </div>
              </div>
              {trainer.verified && (
                <div className="flex items-center justify-between border-t border-ink/5 pt-4">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-ink/40">Verified</span>
                  <div className="flex items-center gap-1 text-sm text-accent">
                    <Shield size={12} />
                    Certified
                  </div>
                </div>
              )}
            </div>

            {/* Certifications */}
            {certs.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-[10px] uppercase tracking-[0.2em] text-ink/40 font-medium">
                  Certifications
                </h3>
                <div className="flex flex-wrap gap-2">
                  {certs.map((cert, i) => (
                    <span
                      key={i}
                      className="px-3 py-1.5 border border-ink/10 text-[10px] uppercase tracking-[0.15em] text-ink/60"
                    >
                      {cert}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right column — details & availability */}
          <div className="lg:col-span-2 space-y-12">
            {/* Name & specialty */}
            <div className="space-y-4">
              <h1 className="text-4xl md:text-5xl serif font-light italic text-ink">{name}</h1>
              <div className="flex items-center gap-3">
                <Award size={14} className="text-accent" />
                <span className="text-sm uppercase tracking-[0.2em] text-ink/50">
                  {formatSpecialty(trainer.specialty)}
                </span>
              </div>
            </div>

            {/* Rates */}
            <div className="border border-ink/10 p-8 flex flex-wrap gap-12">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-ink/40 font-medium">Standard Rate</p>
                <p className="text-2xl serif font-light">${trainer.hourly_rate}/hr</p>
              </div>
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-accent font-medium">Optimized Rate</p>
                <p className="text-2xl serif font-light text-accent">${trainer.optimized_rate}/hr</p>
              </div>
            </div>

            {/* Bio */}
            {trainer.bio && (
              <div className="space-y-4">
                <h2 className="text-[10px] uppercase tracking-[0.2em] text-ink/40 font-medium">About</h2>
                <p className="text-ink/70 leading-relaxed">{trainer.bio}</p>
              </div>
            )}

            {/* Available Sessions */}
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <Calendar size={16} className="text-accent" />
                <h2 className="text-2xl serif font-light italic text-ink">Available Sessions</h2>
              </div>

              {loadingSlots ? (
                <div className="flex justify-center py-12">
                  <div className="w-5 h-5 border border-accent border-t-transparent rounded-full animate-spin" />
                </div>
              ) : availableSlots.length === 0 ? (
                <div className="border border-dashed border-ink/10 p-8 text-center">
                  <p className="text-sm text-ink/40">No available sessions at this time</p>
                  <p className="text-[10px] text-ink/30 mt-2 uppercase tracking-widest">
                    Check back soon for new openings
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(slotsByDate).map(([date, slots]) => (
                    <div key={date} className="border border-ink/10">
                      <div className="bg-ink/3 px-6 py-3">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-ink/50 font-medium">
                          {date}
                        </p>
                      </div>
                      <div className="p-4 flex flex-wrap gap-3">
                        {slots.map((slot) => {
                          const start = new Date(slot.start_time);
                          const end = new Date(slot.end_time);
                          const timeStr = `${start.toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                          })} - ${end.toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                          })}`;

                          return (
                            <Link
                              key={slot.id}
                              to={`/book/${slot.id}`}
                              className="inline-flex items-center gap-2 px-4 py-2.5 border border-accent/20 text-[11px] uppercase tracking-[0.15em] text-ink/70 hover:bg-accent hover:text-white transition-all duration-300"
                            >
                              <Clock size={12} />
                              {timeStr}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Reviews */}
            {reviews.length > 0 && (
              <div className="space-y-6">
                <h2 className="text-2xl serif font-light italic text-ink">Reviews</h2>
                <div className="space-y-6">
                  {reviews.map((review) => (
                    <div key={review.id} className="border border-ink/10 p-6 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {review.profiles?.avatar_url ? (
                            <img
                              src={review.profiles.avatar_url}
                              alt=""
                              referrerPolicy="no-referrer"
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-ink/5 flex items-center justify-center text-xs font-medium text-ink/40">
                              {review.profiles?.full_name?.charAt(0) || '?'}
                            </div>
                          )}
                          <span className="text-sm font-medium text-ink/70">
                            {review.profiles?.full_name || 'Anonymous'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              size={10}
                              className={i < review.rating ? 'text-accent' : 'text-ink/10'}
                              fill={i < review.rating ? 'currentColor' : 'none'}
                            />
                          ))}
                        </div>
                      </div>
                      {review.comment && (
                        <p className="text-sm text-ink/60 leading-relaxed">{review.comment}</p>
                      )}
                      <p className="text-[10px] text-ink/20">
                        {new Date(review.created_at).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrainerProfile;
