import { useState, useEffect, useRef } from 'react';
import { Camera, Check, AlertTriangle } from 'lucide-react';
import AccountSecuritySection from '@/components/shared/AccountSecuritySection';
import DeleteAccountModal from '@/components/shared/DeleteAccountModal';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';
import { useTier } from '@/hooks/useTier';
import { bioLimitForTier } from '@/lib/tierGates';
import WorkoutLocationsManager from '@/components/trainer/WorkoutLocationsManager';
import LocationAutocomplete from '@/components/shared/LocationAutocomplete';

// ---- Image compression (mirrors ClientPassport pattern) ----
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

const SPECIALTIES = [
  { value: 'strength_training', label: 'Strength Training' },
  { value: 'cardio_hiit', label: 'Cardio & HIIT' },
  { value: 'yoga_pilates', label: 'Yoga / Pilates' },
  { value: 'nutrition_coaching', label: 'Nutrition Coaching' },
  { value: 'injury_rehabilitation', label: 'Rehab & Recovery' },
];

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

// ---- Main component ----
const SettingsTab: React.FC = () => {
  const { user, profile, trainerProfile, updateProfile, fetchProfile } = useAuthStore();
  const { tier } = useTier();
  const bioLimit = bioLimitForTier(tier);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Profile form state — initialised from store
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [bio, setBio] = useState(trainerProfile?.bio ?? '');
  const [location, setLocation] = useState(trainerProfile?.location ?? '');
  const [specialty, setSpecialty] = useState(trainerProfile?.specialty ?? 'strength_training');
  const [hourlyRate, setHourlyRate] = useState(String(trainerProfile?.hourly_rate ?? 100));
  const [optimizedRate, setOptimizedRate] = useState(String(trainerProfile?.optimized_rate ?? 60));
  const [yearsExperience, setYearsExperience] = useState(
    trainerProfile?.years_experience != null ? String(trainerProfile.years_experience) : ''
  );
  const [expertiseTags, setExpertiseTags] = useState((trainerProfile?.expertise_tags ?? []).join(', '));
  const [successStory, setSuccessStory] = useState(trainerProfile?.success_story ?? '');
  const [avatarPreview, setAvatarPreview] = useState(profile?.avatar_url ?? '');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Suggested optimized rate — non-critical: any error, an empty result (non-
  // trainer), or show_suggestion === false simply renders no chip.
  const [suggestedRate, setSuggestedRate] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchSuggestion = async () => {
      const { data, error } = await (supabase as any).rpc('get_trainer_suggested_rate');
      if (cancelled || error) return;
      const row = data?.[0];
      if (!row || !row.show_suggestion || row.suggested_rate == null) return;
      setSuggestedRate(Math.round(Number(row.suggested_rate)));
    };

    fetchSuggestion();
    return () => {
      cancelled = true;
    };
  }, []);

  const initials = fullName.trim()
    ? fullName.trim().split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : (profile?.full_name ?? '?')[0].toUpperCase();

  // ---- Avatar upload ----
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Instant preview
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
      // Update profile avatar_url immediately so it persists after refresh
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
    if (!user || !trainerProfile) return;

    const trimmedName = fullName.trim();
    const trimmedBio = bio.trim();
    const trimmedLocation = location.trim();
    const hourly = parseFloat(hourlyRate) || 100;
    const optimized = parseFloat(optimizedRate) || 60;

    if (!trimmedName) {
      toast.error('Full name is required.');
      return;
    }
    if (!trimmedLocation) {
      toast.error('Location is required.');
      return;
    }
    if (trimmedBio.length > bioLimit) {
      toast.error(`Bio must be under ${bioLimit} characters.`);
      return;
    }
    if (optimized > hourly) {
      toast.error('Optimized rate cannot exceed standard rate.');
      return;
    }

    const parsedYearsExperience = yearsExperience.trim() ? parseInt(yearsExperience, 10) : null;
    const parsedExpertiseTags = expertiseTags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    const trimmedSuccessStory = successStory.trim();

    setSavingProfile(true);
    try {
      // Update profiles table (name + avatar already saved inline)
      await updateProfile({ full_name: trimmedName });

      // Update trainer_profiles table
      const { error } = await supabase
        .from('trainer_profiles')
        .update({
          bio: trimmedBio || null,
          location: trimmedLocation,
          specialty,
          hourly_rate: hourly,
          optimized_rate: Math.min(optimized, hourly),
          years_experience: parsedYearsExperience,
          expertise_tags: parsedExpertiseTags.length > 0 ? parsedExpertiseTags : null,
          success_story: trimmedSuccessStory || null,
        })
        .eq('user_id', user.id);

      if (error) throw error;

      // Refresh store
      await fetchProfile(user.id);
      toast.success('Profile saved.');
    } catch (err) {
      console.error('[SettingsTab] save profile error:', err);
      toast.error('Failed to save profile — please try again.');
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="space-y-8">

      {/* ── Section 1: Profile Info ── */}
      <Section title="Profile Info" subtitle="Visible to clients when they view your trainer card.">

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
            <p className="text-[10px] text-ink/30">Auto-compressed to save space</p>
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
            placeholder="Your public trainer name"
            className="w-full border-b border-ink/20 bg-transparent pb-2 text-base font-light outline-none focus:border-ink/60 transition-colors placeholder:text-ink/20"
          />
        </Field>

        {/* Bio */}
        <Field
          label="Bio"
          hint={`${bio.length} / ${bioLimit} characters${tier === 'free' ? ' — upgrade to Pro for 1000 characters' : ''}`}
        >
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            maxLength={bioLimit}
            placeholder="Tell clients about your training philosophy, experience, and what makes your sessions special..."
            className="w-full border border-ink/15 bg-transparent p-4 text-sm font-light outline-none focus:border-ink/40 transition-colors placeholder:text-ink/20 resize-none"
          />
        </Field>

        {/* Location */}
        <Field label="Location">
          <LocationAutocomplete
            value={location}
            onChange={setLocation}
          />
        </Field>

        {/* Specialty */}
        <Field label="Specialty">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {SPECIALTIES.map((sp) => (
              <button
                key={sp.value}
                type="button"
                onClick={() => setSpecialty(sp.value)}
                className={`py-3 px-4 border text-[11px] uppercase tracking-[0.1em] font-medium transition-all flex items-center justify-between ${
                  specialty === sp.value
                    ? 'border-accent bg-accent/5 text-accent'
                    : 'border-ink/10 hover:border-ink/30 text-ink/60'
                }`}
              >
                {sp.label}
                {specialty === sp.value && <Check size={12} />}
              </button>
            ))}
          </div>
        </Field>

        {/* Years of Experience */}
        <Field label="Years of Experience">
          <input
            type="number"
            min={0}
            max={80}
            value={yearsExperience}
            onChange={(e) => setYearsExperience(e.target.value)}
            placeholder="e.g. 5"
            className="w-full border-b border-ink/20 bg-transparent pb-2 text-base font-light outline-none focus:border-ink/60 transition-colors placeholder:text-ink/20"
          />
        </Field>

        {/* Expertise Tags */}
        <Field label="Areas of Expertise" hint="Comma-separated, e.g. Strength Training, Weight Loss, Mobility">
          <input
            type="text"
            value={expertiseTags}
            onChange={(e) => setExpertiseTags(e.target.value)}
            placeholder="Strength Training, Weight Loss, Mobility"
            className="w-full border-b border-ink/20 bg-transparent pb-2 text-base font-light outline-none focus:border-ink/60 transition-colors placeholder:text-ink/20"
          />
        </Field>

        {/* Success Story */}
        <Field label="Success Story" hint="A brief client result or transformation story shown on your profile">
          <textarea
            value={successStory}
            onChange={(e) => setSuccessStory(e.target.value)}
            rows={3}
            placeholder="Share a client success story that showcases your coaching..."
            className="w-full border border-ink/15 bg-transparent p-4 text-sm font-light outline-none focus:border-ink/40 transition-colors placeholder:text-ink/20 resize-none"
          />
        </Field>

        {/* Rates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Standard Rate ($/hr)" hint="Your normal hourly rate">
            <div className="flex items-center gap-2 border-b border-ink/20 pb-2">
              <span className="text-ink/40 text-sm">$</span>
              <input
                type="number"
                min={20}
                max={500}
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                className="flex-1 bg-transparent text-base font-light outline-none text-ink"
              />
              <span className="text-ink/40 text-xs">/hr</span>
            </div>
          </Field>

          <Field label="Optimized Rate ($/hr)" hint="Discounted rate for off-peak bookings">
            <div className="flex items-center gap-2 border-b border-accent/30 pb-2">
              <span className="text-ink/40 text-sm">$</span>
              <input
                type="number"
                min={20}
                max={parseFloat(hourlyRate) || 500}
                value={optimizedRate}
                onChange={(e) => setOptimizedRate(e.target.value)}
                className="flex-1 bg-transparent text-base font-light outline-none text-accent"
              />
              <span className="text-ink/40 text-xs">/hr</span>
            </div>
            {suggestedRate !== null && Number(optimizedRate) !== suggestedRate && (
              <button
                type="button"
                onClick={() => setOptimizedRate(String(suggestedRate))}
                className="border border-accent/30 text-accent px-3 py-1.5 text-[10px] uppercase tracking-[0.15em] hover:border-accent transition-colors"
              >
                Suggested: ${suggestedRate}/hr
              </button>
            )}
          </Field>
        </div>

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
      <AccountSecuritySection />

      {/* ── Section 3: Workout Locations ── */}
      <Section
        title="Workout Locations"
        subtitle="Pin the gyms, parks, and in-home areas where you train clients."
      >
        {trainerProfile?.id ? (
          <WorkoutLocationsManager trainerId={trainerProfile.id} />
        ) : (
          <p className="text-sm text-ink/40 font-light">Loading trainer profile...</p>
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
              Or contact support@fitrush.io for assistance
            </p>
          </div>
        </div>
      </div>

      <DeleteAccountModal open={showDeleteModal} onClose={() => setShowDeleteModal(false)} />

    </div>
  );
};

export default SettingsTab;
