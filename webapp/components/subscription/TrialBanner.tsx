import { Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { isNativeiOS } from '@/lib/platform';

const TrialBanner: React.FC = () => {
  const trainerProfile = useAuthStore((s) => s.trainerProfile);

  if (!trainerProfile) return null;
  if (trainerProfile.subscription_status !== 'trialing') return null;
  if (!trainerProfile.trial_ends_at) return null;

  const daysLeft = Math.ceil(
    (new Date(trainerProfile.trial_ends_at).getTime() - Date.now()) /
      (1000 * 60 * 60 * 24),
  );

  if (daysLeft > 7) return null;

  const tierName =
    trainerProfile.subscription_tier === 'elite' ? 'Elite' : 'Pro';
  const dayLabel = daysLeft === 1 ? 'day' : 'days';

  return (
    <div className="bg-accent/5 border-b border-accent/10 px-6 py-3 text-center">
      <p className="text-xs tracking-wide text-ink/70">
        {daysLeft} {dayLabel} left in your {tierName} trial
        {!isNativeiOS() && (
          <>
            {' '}&mdash;{' '}
            <Link
              to="/trainer/dashboard?tab=subscription"
              className="text-accent underline underline-offset-2"
            >
              add payment to keep access
            </Link>
          </>
        )}
      </p>
    </div>
  );
};

export default TrialBanner;
