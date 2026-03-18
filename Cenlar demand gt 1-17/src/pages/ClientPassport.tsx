import { useState, useEffect, useRef } from 'react';
import { Camera, Check } from 'lucide-react';
import { SkeletonCircle, SkeletonLine } from '@/components/shared/Skeleton';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';
import { fitnessPassportSchema } from '@/lib/schemas';

// --- Constants ---

const FITNESS_GOALS = [
  { value: 'weight_loss', label: 'Weight Loss' },
  { value: 'muscle_gain', label: 'Build Muscle' },
  { value: 'endurance', label: 'Endurance' },
  { value: 'flexibility', label: 'Flexibility' },
  { value: 'general_fitness', label: 'General Fitness' },
  { value: 'rehabilitation', label: 'Rehabilitation' },
  { value: 'sports_performance', label: 'Sports Performance' },
];

const WORKOUT_TYPES = [
  { value: 'strength_training', label: 'Strength Training' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'hiit', label: 'HIIT' },
  { value: 'yoga', label: 'Yoga' },
  { value: 'pilates', label: 'Pilates' },
  { value: 'swimming', label: 'Swimming' },
  { value: 'running', label: 'Running' },
  { value: 'cycling', label: 'Cycling' },
  { value: 'martial_arts', label: 'Martial Arts' },
  { value: 'dance', label: 'Dance' },
  { value: 'crossfit', label: 'CrossFit' },
  { value: 'calisthenics', label: 'Calisthenics' },
];

const FREQUENCIES = [
  { value: '1-2', label: '1-2x/week' },
  { value: '3-4', label: '3-4x/week' },
  { value: '5-6', label: '5-6x/week' },
  { value: '7+', label: '7+/week' },
];

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

  const [bio, setBio] = useState('');
  const [fitnessGoals, setFitnessGoals] = useState<string[]>([]);
  const [workoutTypes, setWorkoutTypes] = useState<string[]>([]);
  const [trainingFrequency, setTrainingFrequency] = useState('');
  const [limitations, setLimitations] = useState('');
  const [avatarPreview, setAvatarPreview] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load existing data on mount
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const { data } = await supabase
          .from('client_profiles')
          .select('bio, fitness_goals, workout_types, training_frequency, health_notes')
          .eq('user_id', user.id)
          .single();
        if (data) {
          setBio(data.bio ?? '');
          setFitnessGoals(data.fitness_goals ?? []);
          setWorkoutTypes(data.workout_types ?? []);
          setTrainingFrequency(data.training_frequency ?? '');
          setLimitations(data.health_notes ?? '');
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

  // --- Save all form data ---
  const handleSave = async () => {
    if (!user) return;

    const validation = fitnessPassportSchema.safeParse({
      fitness_goals: fitnessGoals,
      workout_types: workoutTypes,
      training_frequency: trainingFrequency || undefined,
      physical_limitations: limitations || undefined,
      bio: bio || undefined,
    });

    if (!validation.success) {
      const firstError = validation.error.errors[0];
      toast.error(firstError.message);
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('client_profiles')
        .upsert(
          {
            user_id: user.id,
            bio: bio.trim() || null,
            fitness_goals: fitnessGoals,
            workout_types: workoutTypes,
            training_frequency: trainingFrequency,
            health_notes: limitations.trim() || null,
          },
          { onConflict: 'user_id' },
        );
      if (error) throw error;
      toast.success('Fitness Passport saved!');
    } catch (err) {
      console.error('[ClientPassport] save error:', err);
      toast.error('Failed to save. Please try again.');
    } finally {
      setSaving(false);
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
                  setFitnessGoals(toggle(fitnessGoals, g.value));
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
                  setWorkoutTypes(toggle(workoutTypes, w.value));
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
                onClick={() => setTrainingFrequency(f.value)}
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
            rows={3}
            placeholder="e.g. Previous ACL surgery, avoid high-impact on left knee"
            className="w-full border border-ink/15 bg-transparent p-4 text-sm font-light outline-none focus:border-ink/40 transition-colors placeholder:text-ink/20 resize-none"
          />
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-4 bg-ink text-white text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
              Saving...
            </span>
          ) : (
            'Save Fitness Passport'
          )}
        </button>
      </div>
    </div>
  );
};

export default ClientPassport;
