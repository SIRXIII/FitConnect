import { useState } from 'react';
import { Share2, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { buildReferralLink } from '@/lib/referral';

interface ReferralWidgetProps {
  referralCode: string;
}

const ReferralWidget: React.FC<ReferralWidgetProps> = ({ referralCode }) => {
  const [copied, setCopied] = useState(false);
  const referralLink = buildReferralLink(referralCode);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast.success('Referral link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers that block clipboard without HTTPS
      toast.error('Could not copy link. Please copy manually.');
    }
  };

  return (
    <div className="border border-ink/10 p-8 space-y-6">
      <div className="flex items-center gap-2">
        <Share2 size={14} className="text-accent" />
        <p className="text-xs uppercase tracking-[0.2em] text-ink/40 font-medium">Refer & Earn</p>
      </div>
      <div className="space-y-2">
        <p className="text-xs text-ink/40 font-light">Your referral code</p>
        <p className="text-2xl serif font-light text-ink tracking-[0.15em] uppercase">{referralCode}</p>
      </div>
      <div className="space-y-3">
        <p className="text-xs text-ink/40 font-light truncate">{referralLink}</p>
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 border border-ink/20 px-6 py-3 text-[10px] uppercase tracking-[0.2em] font-medium hover:bg-ink hover:text-white transition-all duration-300"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied!' : 'Copy Link'}
        </button>
      </div>
      <p className="text-xs text-ink/30 font-light leading-relaxed">
        Trainers earn $10 credit when a referred client completes their first session.
        Clients earn $5 off when a referred trainer completes their first session with you.
      </p>
    </div>
  );
};

export default ReferralWidget;
