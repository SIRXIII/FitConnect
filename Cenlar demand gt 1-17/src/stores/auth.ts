import { create } from 'zustand';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export type UserRole = 'trainer' | 'client';

export interface Profile {
  id: string;
  role: UserRole | null;
  full_name: string;
  avatar_url: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface TrainerProfile {
  id: string;
  user_id: string;
  specialty: string;
  bio: string | null;
  hourly_rate: number;
  optimized_rate: number;
  location: string;
  latitude: number | null;
  longitude: number | null;
  certifications: string[];
  verified: boolean;
  rating: number;
  review_count: number;
  stripe_account_id: string | null;
  created_at: string;
  updated_at: string;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  trainerProfile: TrainerProfile | null;
  loading: boolean;
  initialized: boolean;

  initialize: () => Promise<void>;
  fetchProfile: (userId: string) => Promise<void>;
  signInWithProvider: (provider: 'google' | 'facebook' | 'apple') => Promise<void>;
  signOut: () => Promise<void>;
  setRole: (role: UserRole) => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  profile: null,
  trainerProfile: null,
  loading: true,
  initialized: false,

  initialize: async () => {
    if (get().initialized) return;

    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user ?? null;

    set({ session, user, initialized: true });

    if (user) {
      await get().fetchProfile(user.id);
    }

    set({ loading: false });

    supabase.auth.onAuthStateChange(async (_event, session) => {
      const user = session?.user ?? null;
      set({ session, user });

      if (user) {
        await get().fetchProfile(user.id);
      } else {
        set({ profile: null, trainerProfile: null });
      }
    });
  },

  fetchProfile: async (userId: string) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    set({ profile: profile as Profile | null });

    if (profile?.role === 'trainer') {
      const { data: trainerProfile } = await supabase
        .from('trainer_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      set({ trainerProfile: trainerProfile as TrainerProfile | null });
    }
  },

  signInWithProvider: async (provider) => {
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, session: null, profile: null, trainerProfile: null });
  },

  setRole: async (role: UserRole) => {
    const user = get().user;
    if (!user) return;

    const { error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', user.id);

    if (error) throw error;

    if (role === 'trainer') {
      const { error: trainerError } = await supabase
        .from('trainer_profiles')
        .insert({
          user_id: user.id,
          specialty: 'strength_training',
          hourly_rate: 100,
          optimized_rate: 60,
          location: '',
        });

      if (trainerError) throw trainerError;
    }

    await get().fetchProfile(user.id);
  },

  updateProfile: async (updates: Partial<Profile>) => {
    const user = get().user;
    if (!user) return;

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);

    if (error) throw error;

    await get().fetchProfile(user.id);
  },
}));
