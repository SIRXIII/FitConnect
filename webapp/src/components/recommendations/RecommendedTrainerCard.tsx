import { Link } from 'react-router-dom';
import { optimizedUrl } from '@/lib/imageUtils';
import type { MatchResult } from '@/lib/matchScoring';
import { trainerPath } from '@/lib/trainerPath';

interface RecommendedTrainerCardProps {
  result: MatchResult;
}

export const RecommendedTrainerCard: React.FC<RecommendedTrainerCardProps> = ({ result }) => {
  const { trainer, score, label, reasons } = result;
  const avatarUrl = trainer.profiles.avatar_url
    ? optimizedUrl(trainer.profiles.avatar_url, 96)
    : null;

  const initials = trainer.profiles.full_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="border border-ink/10 p-6 space-y-5 hover:border-ink/25 transition-colors duration-500 w-72 flex-shrink-0 snap-start md:w-full md:flex-shrink">
      {/* Avatar + name row */}
      <div className="flex items-center gap-3">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={trainer.profiles.full_name}
            className="w-12 h-12 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-12 h-12 rounded-full flex-shrink-0 bg-ink/5 flex items-center justify-center">
            <span className="text-sm font-medium text-ink/40">{initials}</span>
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink hover:text-accent transition-colors truncate">
            {trainer.profiles.full_name}
          </p>
          <p className="text-[10px] uppercase tracking-widest text-ink/40 truncate">
            {trainer.specialty.replace(/_/g, ' ')}
          </p>
        </div>
      </div>

      {/* Rate row */}
      <p className="text-xl serif italic text-accent">
        ${trainer.optimized_rate}/hr
      </p>

      {/* Match score row */}
      <div className="flex items-baseline gap-2">
        <span className="text-[28px] serif italic text-accent leading-none">{score}%</span>
        <span className="text-[10px] uppercase tracking-widest text-ink/40">&middot;&nbsp;{label}</span>
      </div>

      {/* Explanation bullets */}
      <div className="space-y-1">
        {reasons.map((reason, i) => (
          <p key={i} className="text-sm text-ink/60">
            &middot; {reason}
          </p>
        ))}
      </div>

      {/* Divider */}
      <div className="border-t border-ink/5 pt-4">
        <Link
          to={trainerPath(trainer)}
          className="block text-center border border-ink/10 py-4 text-[10px] uppercase tracking-[0.3em] hover:bg-ink hover:text-white transition-all duration-500"
        >
          View Profile
        </Link>
      </div>
    </div>
  );
};
