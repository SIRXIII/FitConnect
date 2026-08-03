import { Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

export const PassportPromptCard: React.FC = () => {
  return (
    <div className="border border-ink/10 p-6 space-y-4">
      <Sparkles size={16} className="text-accent" />
      <p className="text-sm font-medium text-ink">Your matches are waiting.</p>
      <p className="text-sm text-ink/60">
        Complete your Fitness Passport so we can recommend trainers matched to your goals,
        intensity preference, and budget.
      </p>
      <Link
        to="/client/passport"
        className="text-sm text-accent border-b border-accent hover:opacity-80 transition-opacity"
      >
        Complete Fitness Passport
      </Link>
    </div>
  );
};
