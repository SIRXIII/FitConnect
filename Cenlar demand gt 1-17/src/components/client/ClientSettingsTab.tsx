import { useState, useRef } from 'react';
import { Camera, Eye, EyeOff, Mail, AlertTriangle, CreditCard, Check } from 'lucide-react';
import DeleteAccountModal from '@/components/shared/DeleteAccountModal';
import { toast } from 'sonner';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';
import { stripePromise, STRIPE_CONFIGURED } from '@/lib/stripe';

// ---- Image compression (mirrors SettingsTab pattern) ----
async function compressImage(file: File, maxSize = 400, quality = 0.7): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      if (width > height) {
        if (width > maxSize) { height *= maxSize / width; width = maxSize; }
      } else {
        if (height > maxSize) { width *= maxSize / height; height = maxSize; }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', quality);
    };
    img.src = URL.createObjectURL(file);
  });
}

// ---- Section wrapper ----
const Section: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({
  title,
  subtitle,
  children,
}) => (
  <div className="border border-ink/10 p-8 space-y-6">
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-[0.2em] text-ink/40 font-medium">{title}</p>
      {subtitle && <p className="text-sm text-ink/50 font-light">{subtitle}</p>}
    </div>
    {children}
  </div>
);

// ---- Field wrapper ----
const Field: React.FC<{ label: string; children: React.ReactNode; hint?: string }> = ({
  label,
  children,
  hint,
}) => (
  <div className="space-y-2">
    <label className="text-[10px] uppercase tracking-[0.2em] text-ink/40">{label}</label>
    {children}
    {hint && <p className="text-[10px] text-ink/30">{hint}</p>}
  </div>
);

// ---- Stripe setup form (inner component, rendered inside <Elements>) ----
interface SetupFormProps {
  onSuccess: (pmId: string, last4: string, brand: string) => void;
  onCancel: () => void;
}

const SetupForm: React.FC<SetupFormProps> = ({ onSuccess, onCancel }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSaving(true);
    setError(null);

    const { setupIntent, error: stripeError } = await stripe.confirmSetup({
      elements,
      redirect: 'if_required',
    });

    if (stripeError) {
      setError(stripeError.message ?? 'Card setup failed');
      setSaving(false);
      return;
    }

    const pmId = typeof setupIntent.payment_method === 'string'
      ? setupIntent.payment_method
      : setupIntent.payment_method?.id ?? '';

    try {
      const pm = await stripe.retrievePaymentMethod(pmId) as { paymentMethod?: { card?: { last4?: string; brand?: string } } };
      const last4 = pm?.paymentMethod?.card?.last4 ?? '••••';
      const brand = pm?.paymentMethod?.card?.brand ?? 'card';
      onSuccess(pmId, last4, brand);
    } catch {
      onSuccess(pmId, '••••', 'card');
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <PaymentElement />
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving || !stripe}
          className="border border-accent text-accent px-8 py-3 text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-accent hover:text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
              Saving...
            </span>
          ) : 'Save Card'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-[11px] uppercase tracking-[0.2em] text-ink/40 hover:text-ink transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

// ---- Main component ----
const ClientSettingsTab: React.FC = () => {
  const { user, profile, updateProfile, fetchProfile } = useAuthStore();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Profile form state
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState('');
  const [avatarPreview, setAvatarPreview] = useState(profile?.avatar_url ?? '');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // Password form state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Payment method state
  const [setupClientSecret, setSetupClientSecret] = useState<string | null>(null);
  const [loadingSetupIntent, setLoadingSetupIntent] = useState(false);
  const [savedCard, setSavedCard] = useState<{ last4: string; brand: string } | null>(null);

  const initials = fullName.trim()
    ? fullName.trim().split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : (profile?.full_name ?? '?')[0].toUpperCase();

  // ---- Avatar upload ----
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setAvatarPreview(URL.createObjectURL(file));
    setUploadingAvatar(true);

    try {
      const compressed = await compressImage(file);
      const path = `${user.id}/avatar.jpg`;
      const { error } = await supabase.storage
        .from('avatars')
        .upload(path, compressed, { upsert: true, contentType: 'image/jpeg' });
      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      const urlWithCacheBust = `${publicUrl}?t=${Date.now()}`;
      await updateProfile({ avatar_url: urlWithCacheBust });
      setAvatarPreview(urlWithCacheBust);
      toast.success('Photo updated.');
    } catch {
      toast.error('Photo upload failed — please try again.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  // ---- Save profile ----
  const handleSaveProfile = async () => {
    if (!user) return;

    const trimmedName = fullName.trim();
    if (!trimmedName) {
      toast.error('Full name is required.');
      return;
    }

    setSavingProfile(true);
    try {
      await updateProfile({ full_name: trimmedName });
      await fetchProfile(user.id);
      toast.success('Profile saved.');
    } catch (err) {
      console.error('[ClientSettingsTab] save profile error:', err);
      toast.error('Failed to save profile — please try again.');
    } finally {
      setSavingProfile(false);
    }
  };

  // ---- Change password ----
  const handleChangePassword = async () => {
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Password updated.');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
    } catch (err) {
      console.error('[ClientSettingsTab] password update error:', err);
      toast.error(err instanceof Error ? err.message : 'Password update failed.');
    } finally {
      setSavingPassword(false);
    }
  };

  // ---- Payment method setup ----
  const handleAddPaymentMethod = async () => {
    if (!stripePromise || !user) return;
    setLoadingSetupIntent(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-setup-intent`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${session?.access_token}` },
        },
      );
      const json = await res.json();
      if (!res.ok || !json.clientSecret) {
        throw new Error(json.error ?? 'Failed to initialize payment setup');
      }
      setSetupClientSecret(json.clientSecret);
    } catch (err) {
      console.error('[ClientSettingsTab] setup intent error:', err);
      toast.error(err instanceof Error ? err.message : 'Payment setup failed — please try again.');
    } finally {
      setLoadingSetupIntent(false);
    }
  };

  const handlePaymentSuccess = async (pmId: string, last4: string, brand: string) => {
    if (!user) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('client_profiles').upsert(
        {
          user_id: user.id,
          stripe_payment_method_id: pmId,
          stripe_payment_last4: last4,
          stripe_payment_brand: brand,
        },
        { onConflict: 'user_id' },
      );
      setSavedCard({ last4, brand });
      setSetupClientSecret(null);
      toast.success('Payment method saved.');
    } catch (err) {
      console.error('[ClientSettingsTab] save payment method error:', err);
      toast.error('Card saved with Stripe but failed to store details — please refresh.');
    }
  };

  return (
    <div className="space-y-8">

      {/* ── Section 1: Profile Info ── */}
      <Section title="Profile Info" subtitle="Your name and photo visible to trainers.">

        {/* Avatar */}
        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            disabled={uploadingAvatar}
            className="relative w-20 h-20 rounded-full overflow-hidden border border-ink/15 hover:border-ink/40 transition-colors flex items-center justify-center bg-ink/5 group shrink-0"
            aria-label="Change profile photo"
          >
            {avatarPreview ? (
              <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl serif text-ink/30 font-light">{initials}</span>
            )}
            <div className="absolute inset-0 bg-ink/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
              <Camera size={18} className="text-white" />
            </div>
            {uploadingAvatar && (
              <div className="absolute inset-0 bg-ink/60 flex items-center justify-center rounded-full">
                <div className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </button>
          <div className="space-y-1">
            <p className="text-sm text-ink/60 font-light">
              {uploadingAvatar ? 'Uploading...' : avatarPreview ? 'Click to change photo' : 'Click to add a photo'}
            </p>
            <p className="text-[10px] text-ink/30">Auto-compressed to 400px</p>
          </div>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="hidden"
          />
        </div>

        {/* Full Name */}
        <Field label="Full Name">
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your name"
            className="w-full border-b border-ink/20 bg-transparent pb-2 text-base font-light outline-none focus:border-ink/60 transition-colors placeholder:text-ink/20"
          />
        </Field>

        {/* Phone (optional) */}
        <Field label="Phone Number" hint="Optional — not shared publicly">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(555) 000-0000"
            className="w-full border-b border-ink/20 bg-transparent pb-2 text-base font-light outline-none focus:border-ink/60 transition-colors placeholder:text-ink/20"
          />
        </Field>

        {/* Save button */}
        <div className="pt-2">
          <button
            onClick={handleSaveProfile}
            disabled={savingProfile}
            className="border border-accent text-accent px-10 py-3 text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-accent hover:text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {savingProfile ? (
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                Saving...
              </span>
            ) : (
              'Save Profile'
            )}
          </button>
        </div>
      </Section>

      {/* ── Section 2: Account Security ── */}
      <Section title="Account Security">

        {/* Email (display only) */}
        <Field label="Email Address" hint="Email changes require contacting support.">
          <div className="flex items-center gap-3 pb-2 border-b border-ink/10">
            <Mail size={16} className="text-ink/30 shrink-0" />
            <span className="text-base font-light text-ink/70">{user?.email ?? '—'}</span>
          </div>
        </Field>

        {/* Change password toggle */}
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setShowPasswordForm((v) => !v)}
            className="border border-ink/20 px-8 py-3 text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-ink hover:text-white transition-all duration-300"
          >
            {showPasswordForm ? 'Cancel' : 'Change Password'}
          </button>

          {showPasswordForm && (
            <div className="space-y-4 pt-2">
              <Field label="New Password">
                <div className="flex items-center gap-2 border-b border-ink/20 pb-2">
                  <input
                    type={showNewPw ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    className="flex-1 bg-transparent text-base font-light outline-none placeholder:text-ink/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw((v) => !v)}
                    className="text-ink/30 hover:text-ink transition-colors"
                    aria-label={showNewPw ? 'Hide password' : 'Show password'}
                  >
                    {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </Field>

              <Field label="Confirm Password">
                <div className="flex items-center gap-2 border-b border-ink/20 pb-2">
                  <input
                    type={showConfirmPw ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="flex-1 bg-transparent text-base font-light outline-none placeholder:text-ink/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPw((v) => !v)}
                    className="text-ink/30 hover:text-ink transition-colors"
                    aria-label={showConfirmPw ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </Field>

              <button
                onClick={handleChangePassword}
                disabled={savingPassword || !newPassword || !confirmPassword}
                className="border border-ink/20 px-8 py-3 text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-ink hover:text-white transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {savingPassword ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                    Updating...
                  </span>
                ) : (
                  'Update Password'
                )}
              </button>
            </div>
          )}
        </div>
      </Section>

      {/* ── Section 3: Payment Method ── */}
      <Section
        title="Payment Method"
        subtitle="Your saved card is used at checkout when booking sessions."
      >
        {/* Saved card display */}
        {savedCard && (
          <div className="flex items-center gap-3 py-3 px-4 border border-green-200 bg-green-50/50">
            <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
            <CreditCard size={14} className="text-green-600 shrink-0" />
            <p className="text-sm font-light text-green-800 capitalize">
              {savedCard.brand} ending in {savedCard.last4}
            </p>
            <Check size={14} className="text-green-600 ml-auto shrink-0" />
          </div>
        )}

        {/* Stripe Elements form */}
        {setupClientSecret && stripePromise ? (
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret: setupClientSecret,
              appearance: { theme: 'stripe' },
            }}
          >
            <SetupForm
              onSuccess={handlePaymentSuccess}
              onCancel={() => setSetupClientSecret(null)}
            />
          </Elements>
        ) : (
          <div className="space-y-4">
            {!savedCard && (
              <p className="text-sm text-ink/50 font-light leading-relaxed">
                No payment method saved. Add a card to speed up the checkout process when booking sessions.
              </p>
            )}

            {STRIPE_CONFIGURED ? (
              <button
                onClick={handleAddPaymentMethod}
                disabled={loadingSetupIntent}
                className="border border-ink/20 px-8 py-3 text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-ink hover:text-white transition-all duration-300 disabled:opacity-50"
              >
                {loadingSetupIntent ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                    Loading...
                  </span>
                ) : savedCard ? (
                  'Update Payment Method'
                ) : (
                  'Add Payment Method'
                )}
              </button>
            ) : (
              <div className="flex items-center gap-2 py-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                <p className="text-[10px] uppercase tracking-[0.2em] text-ink/30">
                  Payments secured by Stripe at checkout
                </p>
              </div>
            )}
          </div>
        )}
      </Section>

      {/* ── Section 4: Danger Zone ── */}
      <div className="border border-red-200/60 p-8 space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" strokeWidth={1.5} />
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-red-400/80 font-medium">Danger Zone</p>
            <p className="text-sm font-light text-ink/50">
              Permanently delete your account and all associated data. This cannot be undone.
            </p>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="border border-red-300 text-red-600 px-6 py-2.5 text-[10px] uppercase tracking-[0.2em] font-medium hover:bg-red-50 transition-colors"
            >
              Delete My Account
            </button>
            <p className="text-[10px] text-ink/30">
              Or contact support@fitrush.app for assistance
            </p>
          </div>
        </div>
      </div>

      <DeleteAccountModal open={showDeleteModal} onClose={() => setShowDeleteModal(false)} />

    </div>
  );
};

export default ClientSettingsTab;
