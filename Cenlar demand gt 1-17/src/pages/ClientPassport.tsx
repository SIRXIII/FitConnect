import { useState, useEffect, useRef } from 'react';
import { Camera, Check } from 'lucide-react';
import { SkeletonCircle, SkeletonLine } from '@/components/shared/Skeleton';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';
import { FITNESS_GOALS, WORKOUT_TYPES, FREQUENCIES } from '@/lib/profileConstants';

// --- Image compression ---

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

// --- Component ---

const ClientPassport: React.FC = () => {
  const { user, profile, updateProfile } = useAuthStore();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Existing state
  const [bio, setBio] = useState('');
  const [fitnessGoals, setFitnessGoals] = useState<string[]>([]);
  const [workoutTypes, setWorkoutTypes] = useState<string[]>([]);
  const [trainingFrequency, setTrainingFrequency] = useState('');
  const [limitations, setLimitations] = useState('');
  const [avatarPreview, setAvatarPreview] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [loading, setLoading] = useState(true);

  // New state — Phase 23.1
  const [healthConditions, setHealthConditions] = useState<string[]>([]);
  const [intensityPreference, setIntensityPreference] = useState<string | null>(null);
  const [goalsRanked, setGoalsRanked] = useState<string[]>([]);

  // Personal stats (already in DB but now editable here)
  const [age, setAge] = useState<number | ''>('');
  const [weightLbs, setWeightLbs] = useState<number | ''>('');
  const [heightFt, setHeightFt] = useState<number | ''>('');
  const [heightIn, setHeightIn] = useState<number | ''>('');
  const [fitnessLevel, setFitnessLevel] = useState<string>('');

  // Load existing data on mount
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase as any)
          .from('client_profiles')
          .select('bio, fitness_goals, workout_types, training_frequency, health_notes, health_conditions, intensity_preference, goals_ranked, age, weight_lbs, height_ft, height_in, fitness_level')
          .eq('user_id', user.id)
          .single() as unknown as { data: Record<string, unknown> | null };
        if (data) {
          setBio((data.bio as string) ?? '');
          setFitnessGoals((data.fitness_goals as string[]) ?? []);
          setWorkoutTypes((data.workout_types as string[]) ?? []);
          setTrainingFrequency((data.training_frequency as string) ?? '');
          setLimitations((data.health_notes as string) ?? '');
          setHealthConditions((data.health_conditions as string[]) ?? []);
          setIntensityPreference((data.intensity_preference as string) ?? null);
          setGoalsRanked((data.goals_ranked as string[]) ?? []);
          setAge((data.age as number) ?? '');
          setWeightLbs((data.weight_lbs as number) ?? '');
          setHeightFt((data.height_ft as number) ?? '');
          setHeightIn((data.height_in as number) ?? '');
          setFitnessLevel((data.fitness_level as string) ?? '');
        }
      } catch {
        // No profile yet — that's fine
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  // Set avatar preview from profile
  useEffect(() => {
    if (profile?.avatar_url) setAvatarPreview(profile.avatar_url);
  }, [profile?.avatar_url]);

  const toggle = (arr: string[], val: string): string[] =>
    arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];

  const initials = profile?.full_name
    ? profile.full_name.trim().split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  // --- Auto-save helper ---
  const saveField = async (updates: Record<string, unknown>) => {
    if (!user) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('client_profiles')
      .upsert({ user_id: user.id, ...updates }, { onConflict: 'user_id' });
    if (!error) toast.success('Saved', { duration: 1200, id: 'profile-save' });
    else toast.error('Save failed');
  };

  // --- Progress ring computation ---
  const COMPLETION_FIELDS = [
    !!avatarPreview,
    !!(age),
    !!(weightLbs),
    !!(heightFt || heightIn),
    !!fitnessLevel,
    healthConditions.length > 0 || (limitations && limitations.trim().length > 0),
    !!intensityPreference,
    goalsRanked.length > 0,
  ];
  const completionPct = Math.round(
    (COMPLETION_FIELDS.filter(Boolean).length / COMPLETION_FIELDS.length) * 100
  );
  const missingFields: string[] = [];
  if (!age) missingFields.push('age');
  if (!weightLbs) missingFields.push('weight');
  if (!heightFt && !heightIn) missingFields.push('height');
  if (!fitnessLevel) missingFields.push('fitness level');
  if (!intensityPreference) missingFields.push('intensity preference');
  if (goalsRanked.length === 0) missingFields.push('goal ranking');

  // --- Avatar upload with compression ---
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const preview = URL.createObjectURL(file);
    setAvatarPreview(preview);
    setUploadingAvatar(true);

    try {
      const compressed = await compressImage(file);
      const path = `${user.id}/avatar.jpg`;
      const { error } = await supabase.storage
        .from('avatars')
        .upload(path, compressed, { upsert: true, contentType: 'image/jpeg' });
      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      await updateProfile({ avatar_url: publicUrl } as Parameters<typeof updateProfile>[0]);
      toast.success('Photo uploaded!');
    } catch {
      toast.error('Photo upload failed. Please try again.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-paper pt-24 pb-20 px-6">
        <div className="max-w-xl mx-auto flex flex-col items-center space-y-4 pt-16">
          <SkeletonCircle size="w-20 h-20" />
          <SkeletonLine width="w-48" className="h-5" />
          <SkeletonLine width="w-64" className="h-4" />
          <SkeletonLine width="w-56" className="h-4" />
          <SkeletonLine width="w-40" className="h-4" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper pt-24 pb-20 px-6">
      <div className="max-w-xl mx-auto space-y-10">

        {/* Header */}
        <div className="space-y-3">
          <h1 className="text-3xl serif font-light italic">Your Fitness Passport</h1>
          <p className="text-xs uppercase tracking-[0.25em] text-ink/40">
            Help trainers understand your goals and build sessions tailored to you
          </p>
        </div>

        {/* Avatar Section */}
        <div className="space-y-3">
          <label className="text-[10px] uppercase tracking-[0.2em] text-ink/40">
            Profile Photo
          </label>
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="relative w-20 h-20 rounded-full overflow-hidden border border-ink/15 hover:border-ink/40 transition-colors flex items-center justify-center bg-ink/5 group shrink-0"
            >
              {avatarPreview ? (
                <img
                  src={avatarPreview}
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
                {profile?.avatar_url ? 'Photo uploaded' : 'Click to add a photo'}
              </p>
              <p className="text-[10px] text-ink/30">Auto-compressed to save space</p>
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

        {/* Bio Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[10px] uppercase tracking-[0.2em] text-ink/40">
              Bio
            </label>
            <span className={`text-[10px] tracking-wide ${bio.length > 450 ? 'text-red-500' : 'text-ink/30'}`}>
              {bio.length}/500
            </span>
          </div>
          <textarea
            value={bio}
            onChange={e => setBio(e.target.value.slice(0, 500))}
            onBlur={() => saveField({ bio: bio.trim() || null })}
            rows={4}
            placeholder="Tell trainers about yourself, your fitness journey, and what you're looking for..."
            className="w-full border border-ink/15 bg-transparent p-4 text-sm font-light outline-none focus:border-ink/40 transition-colors placeholder:text-ink/20 resize-none"
          />
        </div>

        {/* Fitness Goals */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink/40">
              Fitness Goals
            </p>
            <span className="text-[10px] text-ink/30 tracking-wide">
              {fitnessGoals.length}/5 selected
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {FITNESS_GOALS.map(g => (
              <button
                key={g.value}
                onClick={() => {
                  if (!fitnessGoals.includes(g.value) && fitnessGoals.length >= 5) return;
                  const next = toggle(fitnessGoals, g.value);
                  setFitnessGoals(next);
                  saveField({ fitness_goals: next });
                }}
                className={`relative text-left py-3 px-4 border text-[11px] uppercase tracking-[0.1em] font-medium transition-all flex items-center justify-between ${
                  fitnessGoals.includes(g.value)
                    ? 'border-accent bg-accent/5 text-accent'
                    : 'border-ink/10 hover:border-ink/30 text-ink/60'
                }`}
              >
                {g.label}
                {fitnessGoals.includes(g.value) && <Check size={12} />}
              </button>
            ))}
          </div>
        </div>

        {/* Workout Types */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink/40">
              Workout Types
            </p>
            <span className="text-[10px] text-ink/30 tracking-wide">
              {workoutTypes.length}/8 selected
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {WORKOUT_TYPES.map(w => (
              <button
                key={w.value}
                onClick={() => {
                  if (!workoutTypes.includes(w.value) && workoutTypes.length >= 8) return;
                  const next = toggle(workoutTypes, w.value);
                  setWorkoutTypes(next);
                  saveField({ workout_types: next });
                }}
                className={`relative text-left py-3 px-4 border text-[11px] uppercase tracking-[0.1em] font-medium transition-all flex items-center justify-between ${
                  workoutTypes.includes(w.value)
                    ? 'border-accent bg-accent/5 text-accent'
                    : 'border-ink/10 hover:border-ink/30 text-ink/60'
                }`}
              >
                {w.label}
                {workoutTypes.includes(w.value) && <Check size={12} />}
              </button>
            ))}
          </div>
        </div>

        {/* Training Frequency */}
        <div className="space-y-3">
          <p className="text-[10px] uppercase tracking-[0.2em] text-ink/40">
            Training Frequency
          </p>
          <div className="flex gap-2">
            {FREQUENCIES.map(f => (
              <button
                key={f.value}
                onClick={() => {
                  setTrainingFrequency(f.value);
                  saveField({ training_frequency: f.value });
                }}
                className={`flex-1 py-3 border text-[11px] uppercase tracking-[0.15em] font-medium transition-all ${
                  trainingFrequency === f.value
                    ? 'border-accent bg-accent/5 text-accent'
                    : 'border-ink/10 hover:border-ink/30 text-ink/60'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Physical Limitations */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[10px] uppercase tracking-[0.2em] text-ink/40">
              Physical Limitations & Health Notes
            </label>
            <span className={`text-[10px] tracking-wide ${limitations.length > 900 ? 'text-red-500' : 'text-ink/30'}`}>
              {limitations.length}/1000
            </span>
          </div>
          <textarea
            value={limitations}
            onChange={e => setLimitations(e.target.value.slice(0, 1000))}
            onBlur={() => saveField({ health_notes: limitations.trim() || null })}
            rows={3}
            placeholder="e.g. Previous ACL surgery, avoid high-impact on left knee"
            className="w-full border border-ink/15 bg-transparent p-4 text-sm font-light outline-none focus:border-ink/40 transition-colors placeholder:text-ink/20 resize-none"
          />
        </div>

      </div>
    </div>
  );
};

export default ClientPassport;
