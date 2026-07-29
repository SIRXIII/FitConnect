import { BadgeCheck, Award } from 'lucide-react';

interface CredentialBadgeProps {
  credentialScore?: number | null;
}

/**
 * Mirrors the Flutter CredentialBadge tiers exactly
 * (lib/features/trainers/presentation/widgets/credential_badge.dart):
 *   >= 60   -> "Verified Pro" (solid)
 *   35-59   -> "Certified" (outline)
 *   < 35    -> nothing
 */
export const CredentialBadge: React.FC<CredentialBadgeProps> = ({ credentialScore }) => {
  const score = credentialScore ?? 0;

  if (score >= 60) {
    return (
      <div className="inline-flex items-center gap-1.5 bg-accent text-white px-3 py-1 rounded-full mr-4">
        <BadgeCheck size={11} />
        <span className="text-[10px] uppercase tracking-[0.15em] font-medium">Verified Pro</span>
      </div>
    );
  }

  if (score >= 35) {
    return (
      <div className="inline-flex items-center gap-1.5 border border-accent/40 text-accent px-3 py-1 rounded-full mr-4">
        <Award size={11} />
        <span className="text-[10px] uppercase tracking-[0.15em] font-medium">Certified</span>
      </div>
    );
  }

  return null;
};

export default CredentialBadge;
