import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Check, ShieldCheck, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';
import { trainerProfileSchema } from '@/lib/schemas';

const CERT_BODIES = ['NASM', 'ACE', 'NSCA', 'ISSA', 'ACSM', 'NCSF', 'NFPT', 'Other'];
const SPECIALTIES = [
  { value: 'strength_training', label: 'Strength Training' },
  { value: 'cardio_hiit', label: 'Cardio & HIIT' },
  { value: 'yoga_pilates', label: 'Yoga / Pilates' },
  { value: 'nutrition_coaching', label: 'Nutrition Coaching' },
  { value: 'injury_rehabilitation', label: 'Rehab & Recovery' },
];

interface FormData {
  full_name: string;
  cert_body: string;
  cert_confirmed: boolean;
  cert_number: string;
  cert_file: File | null;
  cert_url: string;
  bio: string;
  location: string;
  specialty: string;
  hourly_rate: string;
  optimized_rate: string;
  avatar_file: File | null;
  avatar_preview: string;
  avatar_url: string;
}

const TrainerOnboarding: React.FC = () => {
  const { user, profile, updateProfile } = useAuthStore();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const TOTAL_STEPS = 4;
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const certFileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormData>({
    full_name: profile?.full_name ?? '',
    cert_body: '',
    cert_confirmed: false,
    cert_number: '',
    cert_file: null,
    cert_url: '',
    bio: '',
    location: '',
    specialty: 'strength_training',
    hourly_rate: '100',
    optimized_rate: '60',
    avatar_file: null,
    avatar_preview: '',
    avatar_url: '',
  });
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCert, setUploadingCert] = useState(false);

  if (!user) {
    navigate('/login', { replace: true });
    return null;
  }

  const canProceed = () => {
    if (step === 1) return form.full_name.trim().length > 0;
    if (step === 2) return form.cert_body !== '' && form.cert_confirmed;
    if (step === 3) return form.location.trim().length > 0;
    return true;
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setForm(f => ({ ...f, avatar_file: file, avatar_preview: preview }));

    // Upload immediately for instant feedback
    setUploadingAvatar(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/avatar.${ext}`;
      const { error } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      setForm(f => ({ ...f, avatar_url: publicUrl }));
      toast.success('Photo uploaded!');
    } catch {
      toast.error('Photo upload failed — you can add it later from your profile.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleCertFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setForm(f => ({ ...f, cert_file: file }));

    setUploadingCert(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/cert.${ext}`;
      const { error } = await supabase.storage
        .from('certifications')
        .upload(path, file, { upsert: true });
      if (error) throw error;
      // Get a signed URL valid for 1 year (3600 * 24 * 365)
      const { data } = await supabase.storage
        .from('certifications')
        .createSignedUrl(path, 31536000);
      setForm(f => ({ ...f, cert_url: data?.signedUrl ?? '' }));
      toast.success('Certificate uploaded!');
    } catch {
      toast.error('Certificate upload failed — you can add it later.');
    } finally {
      setUploadingCert(false);
    }
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      const hourly = parseFloat(form.hourly_rate) || 100;
      const optimized = parseFloat(form.optimized_rate) || 60;

      // Validate with Zod schema before saving
      const validation = trainerProfileSchema.safeParse({
        full_name: form.full_name.trim(),
        bio: form.bio.trim() || undefined,
        location: form.location.trim(),
        specialty: form.specialty,
        hourly_rate: hourly,
        optimized_rate: Math.min(optimized, hourly),
      });

      if (!validation.success) {
        const firstError = validation.error.issues[0];
        toast.error(firstError.message);
        setSaving(false);
        return;
      }

      const profileUpdate: Record<string, unknown> = { onboarding_complete: true };
      if (form.full_name.trim()) profileUpdate.full_name = form.full_name.trim();
      if (form.avatar_url) profileUpdate.avatar_url = form.avatar_url;
      await updateProfile(profileUpdate as Parameters<typeof updateProfile>[0]);

      const { error } = await supabase
        .from('trainer_profiles')
        .update({
          bio: form.bio.trim() || null,
          location: form.location.trim(),
          specialty: form.specialty,
          hourly_rate: hourly,
          optimized_rate: Math.min(optimized, hourly),
          certification_number: form.cert_number.trim() || null,
          certification_url: form.cert_url || null,
        })
        .eq('user_id', user.id);

      if (error) throw error;

      toast.success('Profile complete! Welcome to FitRush.');
      navigate('/trainer/dashboard?welcome=true', { replace: true });
    } catch (err) {
      console.error('[TrainerOnboarding] save error:', err);
      toast.error('Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const stepLabels = ['Name', 'Certification', 'Profile', 'Rates'];
  const initials = form.full_name.trim()
    ? form.full_name.trim().split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <div className="min-h-screen bg-paper pt-24 pb-20 px-6">
      <div className="max-w-xl mx-auto space-y-10">

        {/* Progress */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.3em] text-ink/40">
              Step {step} of {TOTAL_STEPS}
            </p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink/40">{stepLabels[step - 1]}</p>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div key={i} className={`h-0.5 flex-1 transition-colors duration-300 ${i < step ? 'bg-accent' : 'bg-ink/10'}`} />
            ))}
          </div>
        </div>

        {/* ── Step 1: Name ── */}
        {step === 1 && (
          <div className="space-y-8">
            <div className="space-y-3">
              <h2 className="text-3xl serif font-light italic">What's your name?</h2>
              <p className="text-xs uppercase tracking-[0.25em] text-ink/40">
                Your public trainer name on FitRush
              </p>
            </div>
            <input
              type="text"
              value={form.full_name}
              onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              placeholder="Full name"
              autoFocus
              className="w-full border-b border-ink/20 bg-transparent pb-3 text-xl font-light outline-none focus:border-ink/60 transition-colors placeholder:text-ink/20"
            />
          </div>
        )}

        {/* ── Step 2: Certification ── */}
        {step === 2 && (
          <div className="space-y-8">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <ShieldCheck size={20} className="text-accent" strokeWidth={1.5} />
                <h2 className="text-3xl serif font-light italic">Certification</h2>
              </div>
              <p className="text-xs uppercase tracking-[0.25em] text-ink/40">
                FitRush is for certified personal trainers only
              </p>
            </div>
            <div className="space-y-6">
              <div className="space-y-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-ink/40">Certifying body</p>
                <div className="grid grid-cols-2 gap-2">
                  {CERT_BODIES.map(cb => (
                    <button
                      key={cb}
                      onClick={() => setForm(f => ({ ...f, cert_body: cb }))}
                      className={`py-3 px-4 border text-[11px] uppercase tracking-[0.15em] font-medium transition-all flex items-center justify-between ${form.cert_body === cb ? 'border-accent bg-accent/5 text-accent' : 'border-ink/10 hover:border-ink/30 text-ink/60'}`}
                    >
                      {cb}
                      {form.cert_body === cb && <Check size={12} />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cert number (optional) */}
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-[0.2em] text-ink/40">
                  Certification Number <span className="normal-case text-ink/30">(optional)</span>
                </label>
                <input
                  type="text"
                  value={form.cert_number}
                  onChange={e => setForm(f => ({ ...f, cert_number: e.target.value }))}
                  placeholder="e.g. CPT-123456"
                  className="w-full border-b border-ink/20 bg-transparent pb-2 text-base font-light outline-none focus:border-ink/60 transition-colors placeholder:text-ink/20"
                />
              </div>

              {/* Cert file upload (optional) */}
              <div className="space-y-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-ink/40">
                  Upload Certificate <span className="normal-case text-ink/30">(optional — PDF or image)</span>
                </p>
                <input
                  ref={certFileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleCertFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => certFileInputRef.current?.click()}
                  disabled={uploadingCert}
                  className="border border-ink/15 px-6 py-2.5 text-[11px] uppercase tracking-[0.2em] text-ink/50 hover:border-ink/30 hover:text-ink transition-all disabled:opacity-50"
                >
                  {uploadingCert
                    ? 'Uploading…'
                    : form.cert_file
                    ? `✓ ${form.cert_file.name}`
                    : 'Choose File'}
                </button>
              </div>

              <button
                onClick={() => setForm(f => ({ ...f, cert_confirmed: !f.cert_confirmed }))}
                className={`w-full text-left p-5 border transition-all flex items-start gap-4 ${form.cert_confirmed ? 'border-accent bg-accent/5' : 'border-ink/10 hover:border-ink/20'}`}
              >
                <div className={`w-4 h-4 border flex-shrink-0 mt-0.5 flex items-center justify-center transition-all ${form.cert_confirmed ? 'border-accent bg-accent' : 'border-ink/30'}`}>
                  {form.cert_confirmed && <Check size={10} className="text-white" strokeWidth={3} />}
                </div>
                <p className="text-sm font-light text-ink/70 leading-relaxed">
                  I confirm that I am a <strong className="font-semibold text-ink">Certified Personal Trainer</strong> with a valid, current certification and I agree to uphold FitRush's professional standards.
                </p>
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Profile ── */}
        {step === 3 && (
          <div className="space-y-8">
            <div className="space-y-3">
              <h2 className="text-3xl serif font-light italic">Your trainer profile</h2>
              <p className="text-xs uppercase tracking-[0.25em] text-ink/40">Visible to potential clients</p>
            </div>
            <div className="space-y-6">

              {/* Avatar upload */}
              <div className="space-y-3">
                <label className="text-[10px] uppercase tracking-[0.2em] text-ink/40">
                  Profile Photo <span className="normal-case text-ink/30">(optional)</span>
                </label>
                <div className="flex items-center gap-5">
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="relative w-20 h-20 rounded-full overflow-hidden border border-ink/15 hover:border-ink/40 transition-colors flex items-center justify-center bg-ink/5 group shrink-0"
                  >
                    {form.avatar_preview ? (
                      <img
                        src={form.avatar_preview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
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
                      {form.avatar_url ? 'Photo uploaded ✓' : 'Click to add a photo'}
                    </p>
                    <p className="text-[10px] text-ink/30">JPG, PNG or GIF · Max 5 MB</p>
                  </div>
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-[0.2em] text-ink/40">Location *</label>
                <input
                  type="text"
                  value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="City, State (e.g. Miami, FL)"
                  className="w-full border-b border-ink/20 bg-transparent pb-2 text-base font-light outline-none focus:border-ink/60 transition-colors placeholder:text-ink/20"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-[0.2em] text-ink/40">Specialty</label>
                <div className="grid grid-cols-2 gap-2">
                  {SPECIALTIES.map(sp => (
                    <button
                      key={sp.value}
                      onClick={() => setForm(f => ({ ...f, specialty: sp.value }))}
                      className={`py-3 px-4 border text-[11px] uppercase tracking-[0.1em] font-medium transition-all flex items-center justify-between ${form.specialty === sp.value ? 'border-accent bg-accent/5 text-accent' : 'border-ink/10 hover:border-ink/30 text-ink/60'}`}
                    >
                      {sp.label}
                      {form.specialty === sp.value && <Check size={12} />}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-[0.2em] text-ink/40">Bio <span className="normal-case text-ink/30">(optional)</span></label>
                <textarea
                  value={form.bio}
                  onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                  rows={4}
                  placeholder="Tell clients about your training philosophy, experience, and what makes your sessions special..."
                  className="w-full border border-ink/15 bg-transparent p-4 text-sm font-light outline-none focus:border-ink/40 transition-colors placeholder:text-ink/20 resize-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Step 4: Rates ── */}
        {step === 4 && (
          <div className="space-y-8">
            <div className="space-y-3">
              <h2 className="text-3xl serif font-light italic">Your rates</h2>
              <p className="text-xs uppercase tracking-[0.25em] text-ink/40">
                Set what you earn per session
              </p>
            </div>
            <div className="space-y-8">
              <div className="space-y-3 p-6 border border-ink/10">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] font-semibold">Standard Rate</p>
                    <p className="text-xs text-ink/40 mt-1 font-light">What you normally charge per hour</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-ink/40 text-sm">$</span>
                    <input
                      type="number" min={20} max={500} value={form.hourly_rate}
                      onChange={e => setForm(f => ({ ...f, hourly_rate: e.target.value }))}
                      className="w-20 text-right text-xl font-light border-b border-ink/20 bg-transparent outline-none focus:border-ink/60 transition-colors"
                    />
                    <span className="text-ink/40 text-xs">/hr</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 p-6 border border-accent/30 bg-accent/5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] font-semibold text-accent">Optimized Rate</p>
                    <p className="text-xs text-ink/40 mt-1 font-light">Discounted rate for idle hour bookings. You keep 92%.</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-ink/40 text-sm">$</span>
                    <input
                      type="number" min={20} max={parseInt(form.hourly_rate) || 100} value={form.optimized_rate}
                      onChange={e => setForm(f => ({ ...f, optimized_rate: e.target.value }))}
                      className="w-20 text-right text-xl font-light border-b border-accent/30 bg-transparent outline-none focus:border-accent transition-colors text-accent"
                    />
                    <span className="text-ink/40 text-xs">/hr</span>
                  </div>
                </div>
                <p className="text-[11px] text-ink/40 font-light">
                  You keep <strong className="text-ink">${(parseFloat(form.optimized_rate || '0') * 0.92).toFixed(2)}</strong> per session booked at optimized rate.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4">
          <button
            onClick={() => step > 1 ? setStep(s => s - 1) : navigate(-1)}
            className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-ink/40 hover:text-ink transition-colors"
          >
            <ChevronLeft size={14} />
            Back
          </button>
          <button
            onClick={step < TOTAL_STEPS ? () => setStep(s => s + 1) : handleFinish}
            disabled={!canProceed() || saving}
            className="px-10 py-3 bg-ink text-white text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                Saving…
              </span>
            ) : step === TOTAL_STEPS ? 'Go to Dashboard' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TrainerOnboarding;
