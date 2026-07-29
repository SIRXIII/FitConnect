import { BadgeCheck } from 'lucide-react';

interface CredentialsVerifiedBadgeProps {
  verifiedCertCount?: number | null;
}

/**
 * Gold pill shown once a trainer has at least one admin-approved, unexpired
 * certification. This is a credentials signal only — never label this
 * "Background Checked"; no background-check vendor exists.
 */
export const CredentialsVerifiedBadge: React.FC<CredentialsVerifiedBadgeProps> = ({ verifiedCertCount }) => {
  if (!verifiedCertCount || verifiedCertCount <= 0) return null;

  return (
    <div className="inline-flex items-center gap-1.5 bg-accent text-white px-3 py-1 rounded-full mr-4">
      <BadgeCheck size={11} />
      <span className="text-[10px] uppercase tracking-[0.15em] font-medium">Credentials Verified</span>
    </div>
  );
};

export default CredentialsVerifiedBadge;
