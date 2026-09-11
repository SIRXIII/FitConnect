import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface IntroOfferCardProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

function formatCutoff(value: string): string {
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

/** Trainer-facing pitch + opt-in toggle for the complimentary intro session offer. */
const IntroOfferCard: React.FC<IntroOfferCardProps> = ({ enabled, onChange }) => {
  const [freeIntroUntil, setFreeIntroUntil] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'free_intro_until')
        .maybeSingle();
      if (!cancelled && data?.value) setFreeIntroUntil(data.value);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="border border-ink/10 p-6 space-y-5">
      <h3 className="text-xl serif font-light italic text-ink">
        Offer a complimentary 30-minute intro session
      </h3>

      <ul className="space-y-2.5 text-sm font-light text-ink/85">
        <li>You already give new clients a free first 30 minutes. Now FitRush markets it for you.</li>
        <li>Featured placement on the browse page and a Complimentary Intro badge while the offer runs.</li>
        <li>Every intro is a chance at a review and a repeat client. The client is yours to keep.</li>
        <li>No cost to you, no fee to the client, no card required. Turn it off anytime.</li>
        {freeIntroUntil && (
          <li>Limited time: the offer runs until {formatCutoff(freeIntroUntil)}.</li>
        )}
      </ul>

      <button
        type="button"
        onClick={() => onChange(!enabled)}
        aria-pressed={enabled}
        className={`w-full text-left p-5 border transition-all flex items-start gap-4 ${
          enabled ? 'border-accent bg-accent/5' : 'border-ink/10 hover:border-ink/20'
        }`}
      >
        <div
          className={`w-4 h-4 border flex-shrink-0 mt-0.5 flex items-center justify-center transition-all ${
            enabled ? 'border-accent bg-accent' : 'border-ink/30'
          }`}
        >
          {enabled && <Check size={10} className="text-white" strokeWidth={3} />}
        </div>
        <p className="text-sm font-light text-ink/85 leading-relaxed">
          Offer a complimentary 30-minute intro session to new clients.
        </p>
      </button>
    </div>
  );
};

export default IntroOfferCard;
