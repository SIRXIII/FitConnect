import { AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export interface PendingTrainerCertDoc {
  id: string;
  cert_name: string | null;
  cert_code: string | null;
  cert_number: string | null;
  status: string;
  expiry_date: string | null;
  file_url: string | null;
  file_path: string | null;
  submitted_at: string | null;
}

// trainer-certifications is a private bucket — file_url (legacy public URL) no
// longer resolves. Mint a short-lived signed URL from file_path instead.
async function openCertDoc(doc: PendingTrainerCertDoc) {
  if (doc.file_path) {
    const { data } = await supabase.storage
      .from('trainer-certifications')
      .createSignedUrl(doc.file_path, 300);
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    }
    return;
  }
  if (doc.file_url) {
    window.open(doc.file_url, '_blank', 'noopener,noreferrer');
  }
}

export interface PendingTrainer {
  user_id: string;
  trainer_profile_id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  email: string;
  last_sign_in_at: string | null;
  approval_status: string;
  created_at: string;
  bio: string | null;
  specialty: string | null;
  trainer_location: string | null;
  profile_location: string | null;
  hourly_rate: number | null;
  optimized_rate: number | null;
  discount_percentage: number | null;
  years_experience: number | null;
  expertise_tags: string[] | null;
  credential_score: number | null;
  intro_video_url: string | null;
  intro_video_thumbnail_url: string | null;
  certifications: string[] | null;
  certification_number: string | null;
  certification_url: string | null;
  gym_memberships: string[] | null;
  stripe_account_id: string | null;
  payouts_enabled: boolean | null;
  cert_documents: PendingTrainerCertDoc[];
}

// Predicate table for the missing-fields chip strip — order matters, it drives
// the order fields are listed in the "Missing: …" banner.
export function computeMissingTrainerFields(trainer: PendingTrainer): string[] {
  const missing: string[] = [];
  if (!trainer.avatar_url) missing.push('photo');
  if (!trainer.phone?.trim()) missing.push('phone');
  if (!(trainer.trainer_location ?? trainer.profile_location)) missing.push('location');
  if (!trainer.bio?.trim()) missing.push('bio');
  if (
    !(
      (trainer.cert_documents?.length ?? 0) > 0 ||
      (trainer.certifications?.length ?? 0) > 0 ||
      !!trainer.certification_url
    )
  ) {
    missing.push('certifications');
  }
  if (!trainer.intro_video_url) missing.push('intro video');
  if (!((trainer.gym_memberships?.length ?? 0) > 0)) missing.push('gym memberships');
  if (!trainer.specialty) missing.push('specialty');
  if (trainer.hourly_rate == null) missing.push('hourly rate');
  return missing;
}

interface Props {
  trainer: PendingTrainer;
  showActions?: boolean;
  onApprove?: (userId: string) => void;
  onDecline?: (userId: string) => void;
  approvingId?: string | null;
  decliningId?: string | null;
}

const TrainerDetailCard: React.FC<Props> = ({
  trainer,
  showActions,
  onApprove,
  onDecline,
  approvingId,
  decliningId,
}) => {
  const location = trainer.trainer_location ?? trainer.profile_location;
  const payoutLabel = !trainer.stripe_account_id
    ? 'Not connected'
    : trainer.payouts_enabled
      ? 'Synced — payouts enabled'
      : 'Connected — payouts pending';
  const payoutTone = !trainer.stripe_account_id
    ? 'text-ink/60'
    : trainer.payouts_enabled
      ? 'text-green-700'
      : 'text-amber-700';
  const missingFields = computeMissingTrainerFields(trainer);

  return (
    <div className="border border-ink/10">

      {/* ── Missing-fields flag strip ── */}
      {missingFields.length > 0 && (
        <div
          data-testid="missing-fields-strip"
          className="flex items-start gap-2 px-6 py-3 border-b border-amber-200 bg-amber-50"
        >
          <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">Missing: {missingFields.join(', ')}</p>
        </div>
      )}

      {/* ── SECTION 1: Header — identity + actions ── */}
      <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-ink/10 bg-ink/[0.02]">
        <div className="flex items-start gap-4 min-w-0">
          {trainer.avatar_url ? (
            <img
              src={trainer.avatar_url}
              alt={trainer.full_name ?? 'Trainer'}
              className="w-16 h-16 rounded-full object-cover border border-ink/10 shrink-0"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-ink/5 border border-ink/10 flex items-center justify-center text-lg text-ink/40 shrink-0">
              {(trainer.full_name?.trim() || trainer.email || 'U').charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 pt-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-lg text-ink font-medium truncate">{trainer.full_name?.trim() || 'No name provided'}</p>
              {trainer.credential_score != null && trainer.credential_score > 0 && (
                <span className="text-[10px] uppercase tracking-[0.15em] text-accent font-medium whitespace-nowrap">
                  Credential {Math.round(trainer.credential_score)}
                </span>
              )}
            </div>
            <p className="text-sm text-ink/60 truncate">{trainer.email}{trainer.phone ? ` · ${trainer.phone}` : ''}</p>
            <p className="text-xs text-ink/50 mt-0.5">
              Signed up {new Date(trainer.created_at).toLocaleDateString()}
              {trainer.last_sign_in_at && ` · Last sign-in ${new Date(trainer.last_sign_in_at).toLocaleDateString()}`}
            </p>
          </div>
        </div>
        {showActions && (
          <div className="flex gap-2 shrink-0 w-[220px]">
            <button
              onClick={() => onApprove?.(trainer.user_id)}
              disabled={approvingId === trainer.user_id || decliningId === trainer.user_id}
              className="flex-1 py-2 bg-green-600 text-white text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-green-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {approvingId === trainer.user_id ? '…' : 'Approve'}
            </button>
            <button
              onClick={() => onDecline?.(trainer.user_id)}
              disabled={approvingId === trainer.user_id || decliningId === trainer.user_id}
              className="flex-1 py-2 border border-red-200 text-red-700 text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {decliningId === trainer.user_id ? '…' : 'Decline'}
            </button>
          </div>
        )}
      </div>

      {/* ── SECTION 2: Pricing & Terms ── */}
      <div className="border-t border-ink/10 px-6 py-5">
        <p className="text-[10px] uppercase tracking-[0.2em] text-ink/55 font-medium mb-4">Pricing &amp; Terms</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink/55 font-medium mb-1.5">Specialty</p>
            {trainer.specialty
              ? <p className="text-sm text-ink">{trainer.specialty}</p>
              : <p className="text-sm text-ink/40 italic">Not provided</p>}
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink/55 font-medium mb-1.5">Hourly Rate</p>
            {trainer.hourly_rate != null
              ? <p className="text-sm text-ink tabular-nums">${Number(trainer.hourly_rate).toFixed(0)}/hr</p>
              : <p className="text-sm text-ink/40 italic">Not provided</p>}
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink/55 font-medium mb-1.5">Optimized Rate</p>
            {trainer.optimized_rate != null
              ? <p className="text-sm text-ink tabular-nums">${Number(trainer.optimized_rate).toFixed(0)}/hr</p>
              : <p className="text-sm text-ink/40 italic">Not provided</p>}
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink/55 font-medium mb-1.5">Discount</p>
            {trainer.discount_percentage != null
              ? <p className="text-sm text-ink tabular-nums">{Number(trainer.discount_percentage).toFixed(0)}%</p>
              : <p className="text-sm text-ink/40 italic">Not provided</p>}
          </div>
          <div className="col-span-2 md:col-span-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink/55 font-medium mb-1.5">Location</p>
            {location
              ? <p className="text-sm text-ink">{location}</p>
              : <p className="text-sm text-ink/40 italic">Not provided</p>}
          </div>
          {(trainer.years_experience != null || (trainer.expertise_tags?.length ?? 0) > 0) && (
            <div className="col-span-2 md:col-span-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-ink/55 font-medium mb-1.5">Experience</p>
              <div className="flex flex-wrap items-center gap-2">
                {trainer.years_experience != null && (
                  <span className="text-sm text-ink">
                    {trainer.years_experience} {trainer.years_experience === 1 ? 'year' : 'years'}
                  </span>
                )}
                {(trainer.expertise_tags?.length ?? 0) > 0 && trainer.expertise_tags!.map((tag, idx) => (
                  <span key={`expertise-${idx}`} className="px-2.5 py-1 border border-ink/10 text-[11px] text-ink/70">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── SECTION 3: Bio ── */}
      <div className="border-t border-ink/10 px-6 py-5">
        <p className="text-[10px] uppercase tracking-[0.2em] text-ink/55 font-medium mb-3">Bio</p>
        {trainer.bio?.trim()
          ? <p className="text-sm text-ink/80 leading-relaxed whitespace-pre-wrap">{trainer.bio.trim()}</p>
          : <p className="text-sm text-ink/40 italic">No bio provided yet.</p>}
      </div>

      {/* ── SECTION 4: Intro Video ── */}
      <div className="border-t border-ink/10 px-6 py-5">
        <p className="text-[10px] uppercase tracking-[0.2em] text-ink/55 font-medium mb-3">Intro Video</p>
        {trainer.intro_video_url ? (
          trainer.intro_video_thumbnail_url ? (
            <a
              href={trainer.intro_video_url}
              target="_blank"
              rel="noreferrer"
              className="inline-block relative w-48 aspect-video border border-ink/10 bg-ink/5 overflow-hidden group"
            >
              <img
                src={trainer.intro_video_thumbnail_url}
                alt="Intro video thumbnail"
                className="absolute inset-0 w-full h-full object-cover"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-ink/40 text-paper rounded-full w-10 h-10 flex items-center justify-center group-hover:bg-ink/60 transition-colors">
                  <span className="text-xs pl-0.5">▶</span>
                </div>
              </div>
            </a>
          ) : (
            <a
              href={trainer.intro_video_url}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-ink underline decoration-ink/30 underline-offset-2 hover:text-accent transition-colors"
            >
              View intro video
            </a>
          )
        ) : (
          <p className="text-sm text-ink/40 italic">No intro video uploaded.</p>
        )}
      </div>

      {/* ── SECTION 5: Gym Memberships ── */}
      <div className="border-t border-ink/10 px-6 py-5">
        <p className="text-[10px] uppercase tracking-[0.2em] text-ink/55 font-medium mb-3">Gym Memberships</p>
        {(trainer.gym_memberships?.length ?? 0) > 0 ? (
          <div className="flex flex-wrap gap-2">
            {trainer.gym_memberships!.map((gym, idx) => (
              <span key={`gym-${idx}`} className="px-2.5 py-1 border border-ink/10 text-[11px] text-ink/70">
                {gym}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink/40 italic">None listed.</p>
        )}
      </div>

      {/* ── SECTION 6: Certifications ── */}
      <div className="border-t border-ink/10 px-6 py-5 space-y-4">
        <p className="text-[10px] uppercase tracking-[0.2em] text-ink/55 font-medium">Certifications</p>
        {/* Cert chips */}
        {(trainer.certifications?.length ?? 0) > 0 ? (
          <div className="flex flex-wrap gap-2">
            {trainer.certifications!.map((cert, idx) => (
              <span key={`cert-${idx}`} className="px-2.5 py-1 border border-ink/10 text-[11px] text-ink/70">
                {cert}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink/40 italic">None listed.</p>
        )}
        {/* Cert number + file link from trainer_profile level */}
        {trainer.certification_number && (
          <p className="text-xs text-ink/55">Cert # {trainer.certification_number}</p>
        )}
        {trainer.certification_url && (
          <a
            href={trainer.certification_url}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-ink underline decoration-ink/30 underline-offset-2 hover:text-accent transition-colors"
          >
            View certification file
          </a>
        )}
        {/* Uploaded cert documents */}
        {trainer.cert_documents.length > 0 && (
          <div className="space-y-2 pt-1">
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink/55 font-medium">Uploaded Documents</p>
            {trainer.cert_documents.map((doc) => (
              <div key={doc.id} className="flex items-start gap-3 flex-wrap">
                <span className="text-sm text-ink">{doc.cert_name ?? doc.cert_code ?? 'Document'}</span>
                {doc.cert_number && (
                  <span className="text-xs text-ink/55">#{doc.cert_number}</span>
                )}
                <span className={`text-[10px] uppercase tracking-wider font-medium ${doc.status === 'approved' ? 'text-green-700' : doc.status === 'rejected' ? 'text-red-700' : 'text-amber-700'}`}>
                  {doc.status}
                </span>
                {doc.expiry_date && (
                  <span className="text-xs text-ink/55">expires {new Date(doc.expiry_date).toLocaleDateString()}</span>
                )}
                {(doc.file_path || doc.file_url) && (
                  <button
                    type="button"
                    onClick={() => openCertDoc(doc)}
                    className="text-sm text-ink underline decoration-ink/30 underline-offset-2 hover:text-accent transition-colors"
                  >
                    View file
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── SECTION 7: Account ── */}
      <div className="border-t border-ink/10 px-6 py-5">
        <p className="text-[10px] uppercase tracking-[0.2em] text-ink/55 font-medium mb-4">Account</p>
        <div className="space-y-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink/55 font-medium mb-1.5">Stripe Payout</p>
            <p className={`text-sm ${payoutTone}`}>{payoutLabel}</p>
            {trainer.stripe_account_id && (
              <p className="text-xs text-ink/55 font-mono mt-0.5 truncate">{trainer.stripe_account_id}</p>
            )}
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink/55 font-medium mb-1.5">User ID</p>
            <p className="text-xs text-ink/55 font-mono truncate">{trainer.user_id}</p>
          </div>
        </div>
      </div>

    </div>
  );
};

export default TrainerDetailCard;
