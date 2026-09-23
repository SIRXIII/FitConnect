import { MapPin } from 'lucide-react';
import { FITNESS_GOALS, FREQUENCIES, WORKOUT_TYPES } from '@/lib/profileConstants';

export interface AdminClientDetail {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  is_suspended: boolean;
  created_at: string;
  email: string;
  last_sign_in_at: string | null;
  total_bookings: number;
  completed_count: number;
  cancelled_count: number;
  no_show_count: number;
  total_spend: number;
  location?: string | null;
  onboarding_complete?: boolean;
  bio?: string | null;
  fitness_level?: string | null;
  training_frequency?: string | null;
  fitness_goals?: string[] | null;
  workout_types?: string[] | null;
  recent_bookings: Array<{
    id: string;
    status: string;
    rate_charged: number;
    start_time: string;
    trainer_name: string | null;
  }>;
  reviews: Array<{
    id: string;
    rating: number;
    comment: string | null;
    created_at: string;
    trainer_name: string | null;
  }>;
}

interface Props {
  client: AdminClientDetail;
  onMessageClient?: () => void;
}

type ProfileOption = { value: string; label: string };

const optionLabel = (value: string, options: readonly ProfileOption[]) =>
  options.find((option) => option.value === value)?.label ?? value;

const titleLabel = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}` : 'Not provided';
};

const ClientDetailCard: React.FC<Props> = ({ client, onMessageClient }) => {
  const fitnessGoals = client.fitness_goals ?? [];
  const workoutTypes = client.workout_types ?? [];
  const onboardingLabel = client.onboarding_complete === true
    ? 'Onboarding complete'
    : client.onboarding_complete === false
      ? 'Onboarding incomplete'
      : 'Onboarding status unavailable';
  const onboardingTone = client.onboarding_complete === true
    ? 'text-green-700'
    : client.onboarding_complete === false
      ? 'text-amber-700'
      : 'text-ink/68';

  return (
    <div className="border border-ink/10">

      {/* ── SECTION 1: Header — identity ── */}
      <div className="flex flex-col md:flex-row items-start justify-between gap-4 px-6 py-5 border-b border-ink/10 bg-ink/[0.02]">
        <div className="flex flex-col sm:flex-row items-start gap-4 min-w-0 w-full flex-1">
          {client.avatar_url ? (
            <img
              src={client.avatar_url}
              alt={client.full_name ?? 'Client'}
              className="w-16 h-16 rounded-full object-cover border border-ink/10 shrink-0"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-ink/5 border border-ink/10 flex items-center justify-center text-lg text-ink/68 shrink-0">
              {(client.full_name?.trim() || client.email || 'U').charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 w-full pt-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-lg text-ink font-medium break-words">{client.full_name?.trim() || 'No name provided'}</p>
              {client.is_suspended && (
                <span className="text-[10px] uppercase tracking-[0.15em] text-red-700 font-medium whitespace-nowrap">
                  Suspended
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 flex-wrap mt-1">
              <p data-testid="client-location" className="inline-flex items-start gap-1 min-w-0 max-w-full text-sm text-ink font-medium">
                <MapPin size={13} strokeWidth={1.7} className="shrink-0 mt-0.5" aria-hidden="true" />
                <span className="min-w-0 break-words">{client.location?.trim() || 'Service area not provided'}</span>
              </p>
              <span
                data-testid="client-onboarding-status"
                className={`text-[10px] uppercase tracking-[0.15em] font-medium ${onboardingTone}`}
              >
                {onboardingLabel}
              </span>
            </div>
            <p className="text-sm text-ink/80 break-words">
              <a href={`mailto:${client.email}`} className="hover:underline">{client.email}</a>
              {' · '}
              {client.phone?.trim() ? (
                <a href={`tel:${client.phone.replace(/[^\d+]/g, '')}`} className="hover:underline">
                  {client.phone}
                </a>
              ) : (
                <span className="text-ink/68 italic">No phone on file</span>
              )}
            </p>
            <p className="text-xs text-ink/75 mt-0.5">
              Joined {new Date(client.created_at).toLocaleDateString()}
              {client.last_sign_in_at && ` · Last sign-in ${new Date(client.last_sign_in_at).toLocaleDateString()}`}
            </p>
          </div>
        </div>
        {onMessageClient && (
          <div className="flex flex-col gap-2 shrink-0 w-full md:w-[220px]">
            <button
              onClick={onMessageClient}
              className="w-full px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-ink/68 border border-ink/10 hover:border-ink/20 transition-colors"
            >
              Message Client
            </button>
          </div>
        )}
      </div>

      {/* ── SECTION 2: Profile & training preferences ── */}
      <div className="border-t border-ink/10 px-6 py-5">
        <p className="text-[10px] uppercase tracking-[0.2em] text-ink/55 font-medium mb-4">Profile &amp; Training Preferences</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink/55 font-medium mb-1.5">Fitness Level</p>
            <p className="text-sm text-ink">{titleLabel(client.fitness_level)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink/55 font-medium mb-1.5">Training Frequency</p>
            <p className="text-sm text-ink">
              {client.training_frequency
                ? optionLabel(client.training_frequency, FREQUENCIES)
                : 'Not provided'}
            </p>
          </div>
          <div className="col-span-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink/55 font-medium mb-1.5">Fitness Goals</p>
            {fitnessGoals.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {fitnessGoals.map((goal) => (
                  <span key={goal} className="px-2.5 py-1 border border-ink/10 text-[11px] text-ink/85">
                    {optionLabel(goal, FITNESS_GOALS)}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink/68 italic">Not provided</p>
            )}
          </div>
          <div className="col-span-2 md:col-span-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink/55 font-medium mb-1.5">Workout Types</p>
            {workoutTypes.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {workoutTypes.map((workoutType) => (
                  <span key={workoutType} className="px-2.5 py-1 border border-ink/10 text-[11px] text-ink/85">
                    {optionLabel(workoutType, WORKOUT_TYPES)}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink/68 italic">Not provided</p>
            )}
          </div>
          <div className="col-span-2 md:col-span-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink/55 font-medium mb-1.5">Bio</p>
            {client.bio?.trim()
              ? <p className="text-sm text-ink/80 leading-relaxed whitespace-pre-wrap break-words">{client.bio.trim()}</p>
              : <p className="text-sm text-ink/68 italic">Not provided</p>}
          </div>
        </div>
      </div>

      {/* ── SECTION 3: Booking Summary ── */}
      <div className="border-t border-ink/10 px-6 py-5">
        <p className="text-[10px] uppercase tracking-[0.2em] text-ink/55 font-medium mb-4">Booking Summary</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-x-8 gap-y-5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink/55 font-medium mb-1.5">Total</p>
            <p className="text-sm text-ink tabular-nums">{client.total_bookings}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink/55 font-medium mb-1.5">Completed</p>
            <p className="text-sm text-ink tabular-nums">{client.completed_count}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink/55 font-medium mb-1.5">Cancelled</p>
            <p className="text-sm text-ink tabular-nums">{client.cancelled_count}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink/55 font-medium mb-1.5">No-Show</p>
            <p className="text-sm text-ink tabular-nums">{client.no_show_count}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink/55 font-medium mb-1.5">Total Spend</p>
            <p className="text-sm text-ink tabular-nums">${Number(client.total_spend).toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* ── SECTION 4: Recent Bookings ── */}
      <div className="border-t border-ink/10 px-6 py-5">
        <p className="text-[10px] uppercase tracking-[0.2em] text-ink/55 font-medium mb-3">Recent Bookings</p>
        {client.recent_bookings.length > 0 ? (
          <div className="space-y-2">
            {client.recent_bookings.map((booking) => (
              <div key={booking.id} className="flex items-center gap-3 flex-wrap text-sm">
                <span className="text-ink/85 tabular-nums">
                  {new Date(booking.start_time).toLocaleDateString()}
                </span>
                <span className="text-ink">{booking.trainer_name ?? 'Unknown trainer'}</span>
                <span className="text-[10px] uppercase tracking-wider font-medium text-ink/75">
                  {booking.status}
                </span>
                <span className="text-ink/85 tabular-nums">${Number(booking.rate_charged).toFixed(2)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink/68 italic">No bookings yet.</p>
        )}
      </div>

      {/* ── SECTION 5: Reviews Written ── */}
      <div className="border-t border-ink/10 px-6 py-5">
        <p className="text-[10px] uppercase tracking-[0.2em] text-ink/55 font-medium mb-3">Reviews Written</p>
        {client.reviews.length > 0 ? (
          <div className="space-y-3">
            {client.reviews.map((review) => (
              <div key={review.id} className="border border-ink/10 px-4 py-3 space-y-1.5">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm text-ink">{'★'.repeat(review.rating)}{'☆'.repeat(Math.max(0, 5 - review.rating))}</span>
                  <span className="text-sm text-ink/85">{review.trainer_name ?? 'Unknown trainer'}</span>
                  <span className="text-xs text-ink/75">{new Date(review.created_at).toLocaleDateString()}</span>
                </div>
                {review.comment?.trim() && (
                  <p className="text-sm text-ink/80 leading-relaxed whitespace-pre-wrap">{review.comment.trim()}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink/68 italic">No reviews yet.</p>
        )}
      </div>

    </div>
  );
};

export default ClientDetailCard;
