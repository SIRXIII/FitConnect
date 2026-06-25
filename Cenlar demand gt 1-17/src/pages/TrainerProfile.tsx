import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Star, MapPin, Award, Shield, ChevronLeft, Calendar, Clock, MessageSquare, Flag, Reply, Lock, Globe, Instagram, Youtube, Facebook, Gift, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { useTrainerById, useTrainerBySlug } from '@/hooks/useTrainers';
import { formatSpecialty } from '@/types';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';
import { classifySlot } from '@/lib/scheduling';
import type { AvailabilitySlot } from '@/hooks/useAvailability';
import { ProfileSkeleton } from '@/components/skeleton/ProfileSkeleton';
import { SkeletonRect } from '@/components/shared/Skeleton';
import { ErrorState } from '@/components/shared/ErrorState';
import { WorkoutLocationsManager } from '@/components/trainer/WorkoutLocationsManager';

interface Review {
  id: string;
  client_id: string;
  trainer_id: string;
  rating: number;
  comment: string | null;
  rating_punctuality: number | null;
  rating_expertise: number | null;
  rating_communication: number | null;
  trainer_response: string | null;
  trainer_response_at: string | null;
  is_flagged: boolean;
  is_hidden: boolean;
  created_at: string;
  profiles: {
    full_name: string;
    avatar_url: string | null;
  };
}

const TrainerProfile: React.FC = () => {
  const { id, slug } = useParams<{ id?: string; slug?: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profile } = useAuthStore();

  // Call both hooks unconditionally (hook rules); only one will be active at a time
  const { trainer: trainerById, loading: loadingById } = useTrainerById(slug ? undefined : id);
  const { trainer: trainerBySlug, loading: loadingBySlug } = useTrainerBySlug(slug);

  const trainer = slug ? trainerBySlug : trainerById;
  const loading = slug ? loadingBySlug : loadingById;

  // Demo trainers (numeric IDs) have no real DB records — disable transactional actions
  const isMockTrainer = id ? !/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(id) : false;
  const availabilityRef = useRef<HTMLDivElement>(null);
  const [availableSlots, setAvailableSlots] = useState<AvailabilitySlot[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [messagingLoading, setMessagingLoading] = useState(false);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');
  const [submittingResponse, setSubmittingResponse] = useState(false);
  // Map of slot_id -> current booking count (for group slots)
  const [groupBookingCounts, setGroupBookingCounts] = useState<Record<string, number>>({});
  // Sticky CTA bar visibility (appears after scrolling ~400px past hero)
  const [showStickyBar, setShowStickyBar] = useState(false);

  const handleMessageTrainer = async () => {
    if (!user || !trainer) return;
    setMessagingLoading(true);
    try {
      const { data, error } = await supabase
        .from('conversations')
        .upsert(
          { trainer_id: trainer.id, client_id: user.id },
          { onConflict: 'trainer_id,client_id', ignoreDuplicates: false }
        )
        .select('id')
        .single();

      if (error) throw error;
      navigate(`/messages?conv=${data.id}`);
    } catch {
      toast.error('Could not start conversation. Please try again.');
    } finally {
      setMessagingLoading(false);
    }
  };

  const handleSubmitResponse = async (reviewId: string) => {
    if (!responseText.trim()) return;
    setSubmittingResponse(true);
    try {
      const { error } = await supabase
        .from('reviews')
        .update({ trainer_response: responseText.trim(), trainer_response_at: new Date().toISOString() })
        .eq('id', reviewId);
      if (error) throw error;
      toast.success('Response posted.');
      setRespondingTo(null);
      setResponseText('');
      fetchReviews();
    } catch {
      toast.error('Could not post response. Please try again.');
    } finally {
      setSubmittingResponse(false);
    }
  };

  const handleFlagReview = async (reviewId: string) => {
    try {
      const { error } = await supabase
        .from('reviews')
        .update({ is_flagged: true, flagged_at: new Date().toISOString() })
        .eq('id', reviewId);
      if (error) throw error;
      toast.success('Review flagged for moderation.');
      fetchReviews();
    } catch {
      toast.error('Could not flag review. Please try again.');
    }
  };

  const fetchSlots = useCallback(async () => {
    const trainerId = trainer?.id ?? id;
    if (!trainerId) return;
    // Mock trainers have no DB records — skip the query to avoid UUID errors
    if (isMockTrainer) {
      setAvailableSlots([]);
      setLoadingSlots(false);
      return;
    }

    setLoadingSlots(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .rpc('get_visible_slots', { p_trainer_id: trainerId });

      const slots = (data as AvailabilitySlot[]) || [];
      setAvailableSlots(slots);

      // For group slots, fetch current booking counts
      const groupSlots = slots.filter((s: AvailabilitySlot) => s.slot_type === 'group');
      if (groupSlots.length > 0) {
        const counts: Record<string, number> = {};
        await Promise.all(
          groupSlots.map(async (s: AvailabilitySlot) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: count } = await (supabase as any)
              .rpc('get_slot_booking_count', { p_slot_id: s.id });
            counts[s.id] = count ?? 0;
          })
        );
        setGroupBookingCounts(counts);
      }
    } catch {
      setAvailableSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [trainer?.id, id, isMockTrainer]);

  const fetchReviews = useCallback(async () => {
    const trainerId = trainer?.id ?? id;
    if (!trainerId || isMockTrainer) return;

    try {
      const { data } = await supabase
        .from('reviews')
        .select(`
          id, client_id, trainer_id, rating, comment, created_at,
          rating_punctuality, rating_expertise, rating_communication,
          trainer_response, trainer_response_at,
          is_flagged, is_hidden,
          profiles:client_id (full_name, avatar_url)
        `)
        .eq('trainer_id', trainerId)
        .eq('is_hidden', false)
        .order('created_at', { ascending: false })
        .limit(20);

      setReviews((data as unknown as Review[]) || []);
    } catch {
      setReviews([]);
    }
  }, [trainer?.id, id, isMockTrainer]);

  useEffect(() => {
    fetchSlots();
    fetchReviews();
  }, [fetchSlots, fetchReviews]);

  useEffect(() => {
    // Use the resolved trainer ID for realtime channels (works under both /trainers/:id and /personal-trainer/:slug)
    const trainerId = trainer?.id ?? id;
    if (!trainerId || isMockTrainer) return;

    const slotChannel = supabase
      .channel(`trainer-profile-slots-${trainerId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'availability_slots',
          filter: `trainer_id=eq.${trainerId}`,
        },
        () => {
          fetchSlots();
        }
      )
      .subscribe();

    const reviewChannel = supabase
      .channel(`trainer-profile-reviews-${trainerId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reviews',
          filter: `trainer_id=eq.${trainerId}`,
        },
        () => {
          fetchReviews();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(slotChannel);
      supabase.removeChannel(reviewChannel);
    };
  }, [trainer?.id, id, isMockTrainer, fetchSlots, fetchReviews]);

  // Auto-scroll to availability section when ?book=true is present
  useEffect(() => {
    if (searchParams.get('book') === 'true' && !loading && availabilityRef.current) {
      setTimeout(() => {
        availabilityRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    }
  }, [loading, searchParams]);

  // Sticky CTA bar — show after 400px scroll
  useEffect(() => {
    const handleScroll = () => {
      setShowStickyBar(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Canonicalize: /trainers/:uuid → /personal-trainer/:slug when trainer has a slug
  useEffect(() => {
    if (!trainer || loading) return;
    if (id && !slug && trainer.slug && !isMockTrainer) {
      navigate(`/personal-trainer/${trainer.slug}`, { replace: true });
    }
  }, [trainer, loading, id, slug, isMockTrainer, navigate]);

  // SEO — title, meta description, JSON-LD structured data, canonical link
  useEffect(() => {
    if (!trainer) return;
    const trainerName = trainer.profiles?.full_name || 'Trainer';
    const specialty = formatSpecialty(trainer.specialty);
    const loc = trainer.location || '';
    const ratingVal = Number(trainer.rating);
    const reviewCount = Number(trainer.review_count);

    // Page title
    const prevTitle = document.title;
    document.title = `${trainerName} — ${specialty} | FitRush`;

    // Meta description — reuse the document's existing <meta name="description">
    // so we never create a second, competing tag. Create one only if absent.
    const META_ID = 'fitrush-trainer-meta-desc';
    const existingMeta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    const metaEl = existingMeta ?? Object.assign(document.createElement('meta'), { name: 'description', id: META_ID });
    const createdMeta = !existingMeta;
    if (createdMeta) document.head.appendChild(metaEl);
    const prevMetaContent = metaEl.content;
    metaEl.content = `Book a session with ${trainerName}, a certified ${specialty} personal trainer${loc ? ` in ${loc}` : ''}${reviewCount > 0 && ratingVal > 0 ? `. Rated ${ratingVal.toFixed(1)}/5 by ${reviewCount} client${reviewCount !== 1 ? 's' : ''}` : ''}. Book online via FitRush.`;

    // Canonical link tag — points to slug URL when available
    const CANONICAL_ID = 'fitrush-trainer-canonical';
    let canonicalEl = document.getElementById(CANONICAL_ID) as HTMLLinkElement | null;
    const canonicalHref = trainer.slug
      ? `${window.location.origin}/personal-trainer/${trainer.slug}`
      : null;
    if (canonicalHref) {
      if (!canonicalEl) {
        canonicalEl = document.createElement('link');
        canonicalEl.rel = 'canonical';
        canonicalEl.id = CANONICAL_ID;
        document.head.appendChild(canonicalEl);
      }
      canonicalEl.href = canonicalHref;
    }

    // JSON-LD structured data
    const JSONLD_ID = 'fitrush-trainer-jsonld';
    let scriptEl = document.getElementById(JSONLD_ID) as HTMLScriptElement | null;
    if (!scriptEl) {
      scriptEl = document.createElement('script');
      scriptEl.type = 'application/ld+json';
      scriptEl.id = JSONLD_ID;
      document.head.appendChild(scriptEl);
    }
    const jsonld: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: trainerName,
      jobTitle: 'Personal Trainer',
      ...(trainer.profiles?.avatar_url ? { image: trainer.profiles.avatar_url } : {}),
      brand: { '@type': 'Brand', name: 'FitRush' },
      worksFor: { '@type': 'Organization', name: 'FitRush' },
      ...(loc ? { areaServed: loc } : {}),
      ...(reviewCount > 0 && ratingVal > 0
        ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: ratingVal.toFixed(1), reviewCount } }
        : {}),
    };
    scriptEl.textContent = JSON.stringify(jsonld);

    return () => {
      document.title = prevTitle;
      // Restore the original description if we reused it; remove ours if we created it.
      if (createdMeta) metaEl.remove();
      else metaEl.content = prevMetaContent;
      const canonical = document.getElementById(CANONICAL_ID);
      if (canonical) canonical.remove();
      const jld = document.getElementById(JSONLD_ID);
      if (jld) jld.remove();
    };
  }, [trainer]);

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
    return <ProfileSkeleton />;
  }

  if (!trainer) {
    return (
      <div className="min-h-screen bg-paper pt-32">
        <ErrorState
          title="Trainer not found"
          message="This trainer profile could not be loaded."
          backTo={{ label: "Browse Trainers", path: "/" }}
        />
      </div>
    );
  }

  const name = trainer.profiles?.full_name || 'Trainer';
  const avatar = trainer.profiles?.avatar_url;
  const rating = Number(trainer.rating);
  const certs = trainer.certifications || [];

  // Cheapest rate for sticky CTA (prefer discounted rate if present)
  const cheapestRate = (() => {
    const optimized = Number(trainer.optimized_rate);
    const disc = trainer.discount_percentage ?? 0;
    if (disc > 0 && optimized > 0) {
      return Math.round(optimized * (1 - disc / 100) * 100) / 100;
    }
    return optimized > 0 ? optimized : Number(trainer.hourly_rate);
  })();

  // Social links — normalize to full URLs
  const rawSocial = (trainer as { social_links?: Record<string, string> | null }).social_links ?? null;
  const socialLinks: { key: string; url: string; icon: React.ReactNode; label: string }[] = [];
  if (rawSocial && typeof rawSocial === 'object') {
    const normalize = (key: string, val: string): string => {
      const v = val.trim();
      if (!v) return '';
      if (v.startsWith('http://') || v.startsWith('https://')) return v;
      // Handle-style values for known social platforms
      if (key === 'instagram') return `https://instagram.com/${v.replace(/^@/, '')}`;
      if (key === 'tiktok') return `https://tiktok.com/@${v.replace(/^@/, '')}`;
      if (key === 'x' || key === 'twitter') return `https://x.com/${v.replace(/^@/, '')}`;
      if (key === 'youtube') return `https://youtube.com/@${v.replace(/^@/, '')}`;
      if (key === 'facebook') return `https://facebook.com/${v}`;
      return `https://${v}`;
    };
    const iconMap: Record<string, React.ReactNode> = {
      instagram: <Instagram size={16} />,
      youtube: <Youtube size={16} />,
      facebook: <Facebook size={16} />,
      website: <Globe size={16} />,
      tiktok: <Globe size={16} />,
      x: <Globe size={16} />,
      twitter: <Globe size={16} />,
    };
    const labelMap: Record<string, string> = {
      instagram: 'Instagram', youtube: 'YouTube', facebook: 'Facebook',
      website: 'Website', tiktok: 'TikTok', x: 'X', twitter: 'X',
    };
    Object.entries(rawSocial).forEach(([key, val]) => {
      if (!val) return;
      const url = normalize(key, String(val));
      if (!url) return;
      socialLinks.push({ key, url, icon: iconMap[key] ?? <Globe size={16} />, label: labelMap[key] ?? key });
    });
  }

  // Gym memberships
  const gymMemberships = (trainer as { gym_memberships?: string[] | null }).gym_memberships ?? null;
  const hasGyms = Array.isArray(gymMemberships) && gymMemberships.length > 0;

  // Verified signal (either column)
  const isVerified = !!(trainer.verified || (trainer as { is_verified?: boolean }).is_verified);

  // Own profile — hide sticky CTA
  const isOwnProfile = trainer.user_id === user?.id;

  return (
    <div className={`min-h-screen bg-paper pt-28 ${!isOwnProfile ? 'pb-32' : 'pb-20'}`}>
      {/* Sticky "Book a Session" CTA bar */}
      {!isOwnProfile && showStickyBar && (
        <div className="fixed bottom-0 inset-x-0 z-40 border-t border-ink/10 bg-paper/95 backdrop-blur">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-6">
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink truncate">{name}</p>
              <p className="text-[10px] text-ink/50 tabular-nums">
                From <span className="text-ink/70">${cheapestRate}/hr</span>
              </p>
            </div>
            <button
              onClick={() => availabilityRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="flex-shrink-0 bg-ink text-white text-[11px] uppercase tracking-[0.2em] px-6 py-2.5 font-medium hover:bg-accent transition-colors duration-300"
            >
              Book a Session
            </button>
          </div>
        </div>
      )}

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
                  loading="lazy"
                  decoding="async"
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
              {/* Years of experience */}
              {trainer.years_experience != null && trainer.years_experience > 0 && (
                <div className="flex items-center justify-between border-t border-ink/5 pt-4">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-ink/40">Experience</span>
                  <span className="text-sm text-ink/70 tabular-nums">
                    {trainer.years_experience} years
                  </span>
                </div>
              )}
              {/* Sessions delivered stat */}
              {trainer.booking_count != null && (trainer.booking_count ?? 0) > 0 && (
                <div className="flex items-center justify-between border-t border-ink/5 pt-4">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-ink/40">Sessions</span>
                  <span className="text-sm text-ink/70 tabular-nums">
                    {trainer.booking_count} delivered
                  </span>
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

            {/* Gym memberships */}
            {hasGyms && (
              <div className="space-y-3">
                <h3 className="text-[10px] uppercase tracking-[0.2em] text-ink/40 font-medium">
                  Trains At
                </h3>
                <div className="flex flex-wrap gap-2">
                  {(gymMemberships as string[]).map((gym, i) => (
                    <span
                      key={i}
                      className="px-3 py-1.5 border border-ink/10 text-[10px] uppercase tracking-[0.15em] text-ink/60"
                    >
                      {gym}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Social links */}
            {socialLinks.length > 0 && (
              <div className="flex items-center gap-4 pt-1">
                {socialLinks.map(({ key, url, icon, label }) => (
                  <a
                    key={key}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="text-ink/50 hover:text-accent transition-colors duration-200"
                  >
                    {icon}
                  </a>
                ))}
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

              {/* Trust strip */}
              <div className="flex flex-wrap items-center gap-y-2 pt-1">
                {isVerified && (
                  <>
                    <div className="flex items-center gap-1.5 pr-4">
                      <Shield size={11} className="text-accent flex-shrink-0" />
                      <span className="text-[10px] uppercase tracking-[0.15em] text-ink/60">Verified</span>
                    </div>
                    <div className="h-3 border-r border-ink/15 mr-4" />
                  </>
                )}
                <div className="flex items-center gap-1.5 pr-4">
                  <Lock size={11} className="text-accent flex-shrink-0" />
                  <span className="text-[10px] uppercase tracking-[0.15em] text-ink/60">Secure Stripe Checkout</span>
                </div>
                <div className="h-3 border-r border-ink/15 mr-4" />
                <div className="flex items-center gap-1.5">
                  <MessageSquare size={11} className="text-accent flex-shrink-0" />
                  <span className="text-[10px] uppercase tracking-[0.15em] text-ink/60">Message First</span>
                </div>
              </div>
            </div>

            {/* Complimentary trial banner — new clients, hide on own profile */}
            {!isOwnProfile && (
              <div className="flex items-center gap-3 border border-accent/30 bg-accent/5 px-5 py-3">
                <Gift size={14} className="text-accent flex-shrink-0" />
                <p className="text-sm text-ink/70">
                  New clients — your first two 30-minute sessions are complimentary.
                </p>
              </div>
            )}

            {/* Rates */}
            <div className="border border-ink/10 p-8 flex flex-wrap gap-12">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-ink/40 font-medium">Standard Rate</p>
                <p className="text-2xl serif font-light">${trainer.hourly_rate}/hr</p>
              </div>
              {(trainer.discount_percentage ?? 0) > 0 ? (
                <>
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.2em] text-ink/30 font-medium line-through">Optimized Rate</p>
                    <p className="text-2xl serif font-light text-ink/30 line-through">${trainer.optimized_rate}/hr</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <p className="text-xs uppercase tracking-[0.2em] text-accent font-medium">Session Rate</p>
                      <span className="bg-accent text-white text-[8px] uppercase tracking-[0.1em] px-1.5 py-0.5 font-semibold">
                        {trainer.discount_percentage}% off
                      </span>
                    </div>
                    <p className="text-2xl serif font-light text-accent">
                      ${Math.round(Number(trainer.optimized_rate) * (1 - (trainer.discount_percentage ?? 0) / 100) * 100) / 100}/hr
                    </p>
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-accent font-medium">Optimized Rate</p>
                  <p className="text-2xl serif font-light text-accent">${trainer.optimized_rate}/hr</p>
                </div>
              )}
            </div>

            {/* Bio */}
            {trainer.bio && (
              <div className="space-y-4">
                <h2 className="text-[10px] uppercase tracking-[0.2em] text-ink/40 font-medium">About</h2>
                <p className="text-ink/70 leading-relaxed">{trainer.bio}</p>
              </div>
            )}

            {/* Areas of Expertise */}
            {Array.isArray(trainer.expertise_tags) && trainer.expertise_tags.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-[10px] uppercase tracking-[0.2em] text-ink/40 font-medium">
                  Areas of Expertise
                </h2>
                <div className="flex flex-wrap gap-2">
                  {trainer.expertise_tags.map((tag, i) => (
                    <span
                      key={i}
                      className="px-3 py-1.5 border border-ink/10 text-[10px] uppercase tracking-[0.15em] text-ink/60"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Success Story */}
            {trainer.success_story && (
              <div className="space-y-4">
                <h2 className="text-2xl serif font-light italic text-ink">Success Story</h2>
                <blockquote className="border-l-2 border-accent/30 pl-5 py-1 text-ink/70 leading-relaxed italic">
                  {trainer.success_story}
                </blockquote>
              </div>
            )}

            {/* Intro Video */}
            {trainer.intro_video_url && (
              <section className="mb-8">
                <h3 className="font-cormorant text-xl text-white mb-3">Meet {name}</h3>
                <div className="relative rounded-xl overflow-hidden bg-black aspect-video max-w-lg">
                  <video
                    src={trainer.intro_video_url}
                    poster={trainer.intro_video_thumbnail_url ?? undefined}
                    controls
                    preload="metadata"
                    playsInline
                    className="w-full h-full object-cover"
                    onMouseEnter={(e) => { e.currentTarget.muted = true; e.currentTarget.play().catch(() => {}); }}
                    onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                  />
                </div>
              </section>
            )}

            {/* Workout Locations Manager (trainer's own profile only) */}
            {trainer?.id && trainer.user_id === user?.id && (
              <div className="border border-ink/10 p-8">
                <WorkoutLocationsManager trainerId={trainer.id} />
              </div>
            )}

            {/* Message trainer (clients only, not own profile, not demo) */}
            {user && profile?.role === 'client' && trainer.user_id !== user.id && !isMockTrainer && (
              <div>
                <button
                  onClick={handleMessageTrainer}
                  disabled={messagingLoading}
                  className="flex items-center gap-3 border border-ink/20 px-8 py-3 text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-ink hover:text-white transition-all duration-300 disabled:opacity-50"
                >
                  <MessageSquare size={14} strokeWidth={1.5} />
                  {messagingLoading ? 'Opening…' : 'Message Trainer'}
                </button>
              </div>
            )}

            {/* Available Sessions */}
            <div ref={availabilityRef} className="space-y-6">
              <div className="flex items-center gap-3">
                <Calendar size={16} className="text-accent" />
                <h2 className="text-2xl serif font-light italic text-ink">Available Sessions</h2>
              </div>

              {loadingSlots ? (
                <div className="space-y-3">
                  <SkeletonRect className="h-12 w-full" />
                  <SkeletonRect className="h-12 w-full" />
                  <SkeletonRect className="h-12 w-full" />
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

                          const slotClass = classifySlot(slot);
                          const isBuffer = slotClass === 'buffer';
                          const isGroup = slot.slot_type === 'group';
                          const bookingCount = isGroup ? (groupBookingCounts[slot.id] ?? 0) : 0;
                          const spotsLeft = isGroup ? ((slot.max_capacity ?? 0) - bookingCount) : null;
                          const isFull = isGroup && spotsLeft !== null && spotsLeft <= 0;
                          const displayRate = isGroup ? slot.group_rate : null;

                          return (
                            <Link
                              key={slot.id}
                              to={isMockTrainer || isFull ? '#' : `/book/${slot.id}`}
                              onClick={isMockTrainer || isFull ? (e) => { e.preventDefault(); } : undefined}
                              className={`inline-flex flex-col items-start gap-1 px-4 py-2.5 text-[11px] uppercase tracking-[0.15em] transition-all duration-300 ${
                                isFull
                                  ? 'border border-ink/10 text-ink/30 cursor-not-allowed'
                                  : isBuffer
                                  ? 'border border-amber-400/40 text-amber-700/70 hover:bg-accent hover:text-white'
                                  : isGroup
                                  ? 'border border-blue-400/30 text-ink/70 hover:bg-blue-500 hover:text-white'
                                  : 'border border-accent/20 text-ink/70 hover:bg-accent hover:text-white'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <Clock size={12} />
                                {timeStr}
                                {isBuffer && !isGroup && (
                                  <span className="text-[8px] uppercase tracking-widest text-amber-600/60">Soon</span>
                                )}
                              </div>
                              {isGroup && (
                                <div className="flex items-center gap-2">
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${
                                    isFull
                                      ? 'bg-red-900/30 text-red-400'
                                      : 'bg-green-900/30 text-green-400'
                                  }`}>
                                    {isFull ? 'Full' : `${spotsLeft}/${slot.max_capacity} spots left`}
                                  </span>
                                  {displayRate != null && (
                                    <span className="text-[9px] text-blue-400/80">${displayRate}/person</span>
                                  )}
                                </div>
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* FAQ */}
            {Array.isArray(trainer.faqs) && trainer.faqs.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-2xl serif font-light italic text-ink">FAQ</h2>
                <div>
                  {trainer.faqs.map((faq, i) => {
                    if (!faq || typeof faq.q !== 'string' || typeof faq.a !== 'string') return null;
                    return (
                      <details key={i} className="group border-b border-ink/10">
                        <summary className="flex items-center justify-between cursor-pointer list-none py-4 gap-4">
                          <span className="text-sm font-medium text-ink/80">{faq.q}</span>
                          <ChevronDown
                            size={14}
                            className="text-ink/40 flex-shrink-0 transition-transform duration-200 group-open:rotate-180"
                          />
                        </summary>
                        <p className="text-sm text-ink/60 leading-relaxed pt-2 pb-4">{faq.a}</p>
                      </details>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Reviews */}
            {reviews.length > 0 && (
              <div className="space-y-6">
                <h2 className="text-2xl serif font-light italic text-ink">Reviews</h2>
                <div className="space-y-6">
                  {reviews.map((review) => {
                    const isOwnReview = user?.id === review.client_id;
                    const isThisTrainer = user?.id === review.trainer_id;
                    const hasSubRatings =
                      review.rating_punctuality || review.rating_expertise || review.rating_communication;

                    return (
                      <div key={review.id} className="border border-ink/10 p-6 space-y-4">
                        {/* Header: avatar + name + overall stars */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {review.profiles?.avatar_url ? (
                              <img
                                src={review.profiles.avatar_url}
                                alt=""
                                referrerPolicy="no-referrer"
                                loading="lazy"
                                decoding="async"
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

                        {/* Sub-ratings */}
                        {hasSubRatings && (
                          <div className="flex flex-wrap gap-x-4 gap-y-1">
                            {[
                              { label: 'Punctuality', val: review.rating_punctuality },
                              { label: 'Expertise', val: review.rating_expertise },
                              { label: 'Communication', val: review.rating_communication },
                            ].map(({ label, val }) =>
                              val ? (
                                <div key={label} className="flex items-center gap-1.5">
                                  <span className="text-[10px] text-ink/40 uppercase tracking-wide">{label}</span>
                                  <div className="flex items-center gap-0.5">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                      <Star
                                        key={i}
                                        size={8}
                                        className={i < val ? 'text-accent/70' : 'text-ink/10'}
                                        fill={i < val ? 'currentColor' : 'none'}
                                      />
                                    ))}
                                  </div>
                                </div>
                              ) : null
                            )}
                          </div>
                        )}

                        {/* Comment */}
                        {review.comment && (
                          <p className="text-sm text-ink/60 leading-relaxed">{review.comment}</p>
                        )}

                        {/* Date + flag */}
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] text-ink/20">
                            {new Date(review.created_at).toLocaleDateString('en-US', {
                              month: 'long',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </p>
                          {user && !isOwnReview && !isThisTrainer && !review.is_flagged && (
                            <button
                              onClick={() => handleFlagReview(review.id)}
                              className="flex items-center gap-1 text-[10px] text-ink/30 hover:text-red-400 transition-colors"
                            >
                              <Flag size={10} />
                              Flag
                            </button>
                          )}
                          {review.is_flagged && (
                            <span className="text-[10px] text-amber-500/60 flex items-center gap-1">
                              <Flag size={10} />
                              Flagged
                            </span>
                          )}
                        </div>

                        {/* Trainer response */}
                        {review.trainer_response && (
                          <div className="bg-ink/3 border-l-2 border-accent/30 pl-4 py-3 space-y-1">
                            <p className="text-[10px] text-ink/40 uppercase tracking-wide">Trainer response</p>
                            <p className="text-sm text-ink/60 leading-relaxed">{review.trainer_response}</p>
                            {review.trainer_response_at && (
                              <p className="text-[10px] text-ink/20">
                                {new Date(review.trainer_response_at).toLocaleDateString('en-US', {
                                  month: 'long',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Trainer: respond button */}
                        {isThisTrainer && !review.trainer_response && respondingTo !== review.id && (
                          <button
                            onClick={() => { setRespondingTo(review.id); setResponseText(''); }}
                            className="flex items-center gap-1.5 text-xs text-ink/40 hover:text-accent transition-colors"
                          >
                            <Reply size={12} />
                            Respond to review
                          </button>
                        )}

                        {/* Response form */}
                        {isThisTrainer && respondingTo === review.id && (
                          <div className="space-y-2">
                            <textarea
                              value={responseText}
                              onChange={(e) => setResponseText(e.target.value)}
                              placeholder="Write a professional response..."
                              maxLength={1000}
                              rows={3}
                              className="w-full text-sm border border-ink/20 rounded px-3 py-2 resize-none focus:outline-none focus:border-accent/40 text-ink/80 placeholder:text-ink/25"
                            />
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleSubmitResponse(review.id)}
                                disabled={submittingResponse || !responseText.trim()}
                                className="text-xs bg-ink text-white px-4 py-1.5 rounded hover:bg-ink/80 disabled:opacity-40 transition-colors"
                              >
                                {submittingResponse ? 'Posting…' : 'Post response'}
                              </button>
                              <button
                                onClick={() => setRespondingTo(null)}
                                className="text-xs text-ink/40 hover:text-ink/70 transition-colors"
                              >
                                Cancel
                              </button>
                              <span className="text-[10px] text-ink/25 ml-auto">{responseText.length}/1000</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
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
