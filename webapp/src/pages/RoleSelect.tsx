import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dumbbell, User } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore, type UserRole } from '@/stores/auth';
import { readReferralCode, clearReferralCode } from '@/lib/referral';
import { supabase } from '@/lib/supabase';

const RoleSelect: React.FC = () => {
  const { setRole, user, profile, loading } = useAuthStore();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<UserRole | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!user && !loading) {
    navigate('/login', { replace: true });
    return null;
  }

  const handleContinue = async () => {
    if (!selected) return;

    setSubmitting(true);
    try {
      await setRole(selected);

      // Referral attribution — only for new users. The handle_new_user trigger
      // pre-sets role to 'client', so role is never null here; "hasn't finished
      // onboarding" is the real new-user signal. Referral double-insert is
      // prevented by clearReferralCode() after first attribution.
      if (!profile?.onboarding_complete) {
        const refCode = readReferralCode();
        if (refCode && user) {
          try {
            const { data: referrer } = await supabase
              .from('profiles')
              .select('id, full_name')
              .eq('referral_code', refCode)
              .maybeSingle();

            if (referrer && referrer.id !== user.id) {
              const { error: referralInsertError } = await supabase.from('referrals').insert({
                referrer_id: referrer.id,
                referred_id: user.id,
                referred_role: selected, // 'trainer' or 'client'
                status: 'pending',
              });

              if (!referralInsertError) {
                clearReferralCode();

                // Give side of give/get: a referred client gets $5 off their
                // first booking, set at signup (the get side is the referrer's
                // reward, granted later by process-referral-reward). This is a
                // self-update on the new user's own profiles row, already
                // within profiles_update_own's existing RLS scope.
                if (selected === 'client') {
                  await supabase
                    .from('profiles')
                    .update({ referral_discount_pending: true })
                    .eq('id', user.id);
                }

                // Attribution-time notification: tell the referrer someone signed up
                // (REFERRAL-06 requires notification at signup AND at reward time)
                const { data: newUserProfile } = await supabase
                  .from('profiles')
                  .select('full_name')
                  .eq('id', user.id)
                  .maybeSingle();

                await supabase.from('notifications').insert({
                  user_id: referrer.id,
                  type: 'referral_new',
                  title: 'New referral',
                  message: `${newUserProfile?.full_name || 'Someone'} signed up with your referral link. Earn your reward when they complete their first booking.`,
                  link: selected === 'trainer' ? '/trainer/dashboard' : '/trainers',
                  read: false,
                });
              }
            }
          } catch (err) {
            // Silent failure — never block role selection for referral errors
            console.error('[RoleSelect] referral attribution error:', err);
          }
        }

        // First-touch UTM attribution, best effort, never blocks signup
        try {
          const raw = localStorage.getItem('fitrush_first_touch');
          if (raw && user) {
            const firstTouch = JSON.parse(raw) as {
              utm_source?: string | null;
              utm_medium?: string | null;
              utm_campaign?: string | null;
            };
            const utmUpdate = {
              utm_source: firstTouch.utm_source ?? null,
              utm_medium: firstTouch.utm_medium ?? null,
              utm_campaign: firstTouch.utm_campaign ?? null,
            };
            // utm_* columns exist only in a not-yet-applied migration; generated
            // Supabase types don't know about them yet, hence the (as any) cast.
            await (supabase as any).from('profiles').update(utmUpdate).eq('id', user.id);
          }
        } catch (err) {
          // Silent failure, never block role selection for attribution errors
          console.error('[RoleSelect] first-touch attribution error:', err);
        }
      }

      if (selected === 'trainer') {
        navigate('/onboarding/trainer', { replace: true });
      } else {
        navigate('/onboarding/client', { replace: true });
      }
    } catch (err) {
      toast.error('Failed to set up your account. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-6">
      <div className="w-full max-w-2xl space-y-16 text-center">
        {/* Header */}
        <div className="space-y-4">
          <h1 className="text-3xl md:text-4xl serif font-light italic text-ink">
            Join as a trainer or trainee?
          </h1>
          <p className="text-xs uppercase tracking-[0.3em] text-ink/40">
            This sets up your experience on FitRush
          </p>
        </div>

        {/* Role cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Trainer card */}
          <button
            onClick={() => setSelected('trainer')}
            className={`group text-left p-10 border transition-all duration-300 space-y-6 ${
              selected === 'trainer'
                ? 'border-accent bg-accent/5'
                : 'border-ink/10 hover:border-ink/30'
            }`}
          >
            <div className={`transition-colors ${selected === 'trainer' ? 'text-accent' : 'text-ink/40 group-hover:text-ink/60'}`}>
              <Dumbbell size={28} strokeWidth={1} />
            </div>
            <div className="space-y-3">
              <h3 className="text-xs uppercase tracking-[0.2em] font-semibold text-ink">
                Certified Personal Trainer
              </h3>
              {/* Keep the percentages in sync with platform_settings.platform_fee_pct */}
              <p className="text-sm text-ink/50 leading-relaxed font-light">
                Fill your open hours with off-peak sessions. Keep 87% of every booking, or 100% for your first 12 months as a Founding Trainer. Set your own rates and availability.
              </p>
              <p className="text-[10px] uppercase tracking-[0.15em] text-accent/70 font-medium">
                Requires valid CPT certification
              </p>
            </div>
          </button>

          {/* Client card */}
          <button
            onClick={() => setSelected('client')}
            className={`group text-left p-10 border transition-all duration-300 space-y-6 ${
              selected === 'client'
                ? 'border-accent bg-accent/5'
                : 'border-ink/10 hover:border-ink/30'
            }`}
          >
            <div className={`transition-colors ${selected === 'client' ? 'text-accent' : 'text-ink/40 group-hover:text-ink/60'}`}>
              <User size={28} strokeWidth={1} />
            </div>
            <div className="space-y-3">
              <h3 className="text-xs uppercase tracking-[0.2em] font-semibold text-ink">
                I'm a Trainee
              </h3>
              <p className="text-sm text-ink/50 leading-relaxed font-light">
                Access elite certified trainers at optimized rates during their available hours. World-class coaching, smart pricing.
              </p>
              <p className="text-[10px] uppercase tracking-[0.15em] text-ink/30 font-medium">
                Open to everyone
              </p>
            </div>
          </button>
        </div>

        {/* Continue button */}
        <div>
          <button
            onClick={handleContinue}
            disabled={!selected || submitting}
            className={`px-16 py-4 text-[11px] uppercase tracking-[0.2em] font-medium transition-all duration-300 ${
              selected
                ? 'bg-ink text-white hover:bg-ink/80 cursor-pointer'
                : 'bg-ink/10 text-ink/30 cursor-not-allowed'
            }`}
          >
            {submitting ? (
              <span className="flex items-center gap-3">
                <span className="w-3 h-3 border border-white/50 border-t-transparent rounded-full animate-spin" />
                Setting up
              </span>
            ) : (
              'Continue'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoleSelect;
