import { create } from 'zustand';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/supabase';

export type UserRole = 'trainer' | 'client' | 'admin';

export type Profile = Tables<'profiles'>;
export type TrainerProfile = Tables<'trainer_profiles'> & {
  years_experience?: number | null;
  expertise_tags?: string[] | null;
  success_story?: string | null;
  faqs?: { q: string; a: string }[] | null;
  slug?: string | null;
  social_links?: Record<string, string> | null;
  gym_memberships?: string[] | null;
  booking_count?: number | null;
  is_verified?: boolean | null;
};

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
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
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

    supabase.auth.onAuthStateChange(async (event, session) => {
      const user = session?.user ?? null;
      set({ session, user });

      // Password recovery: redirect to the reset-password page
      if (event === 'PASSWORD_RECOVERY') {
        window.location.replace('/auth/reset-password');
        return;
      }

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
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (err) {
      throw err instanceof Error ? err : new Error(`Sign in with ${provider} failed`);
    }
  },

  signInWithEmail: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data.user) await get().fetchProfile(data.user.id);
  },

  signUpWithEmail: async (email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) throw error;
    if (data.user && data.session) await get().fetchProfile(data.user.id);
  },

  signOut: async () => {
    // 'local' scope clears localStorage immediately without a server round-trip.
    // This prevents the app from re-authenticating on the next getSession() call.
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      // Fallback: even if the scope flag fails, clear state below
    }
    set({ user: null, session: null, profile: null, trainerProfile: null });
  },

  setRole: async (role: UserRole) => {
    const user = get().user;
    if (!user) return;

    if (role === 'trainer') {
      // Use server-authoritative RPC — handles profiles.role update +
      // trainer_profiles insert atomically inside SECURITY DEFINER function
      // (bypasses the new RLS WITH CHECK on profiles).
      const { error } = await supabase.rpc('promote_to_trainer');
      if (error) throw error;
    } else {
      // Client (and other non-trainer) role updates: direct profiles.update.
      // The RLS WITH CHECK allows this because role IS NOT DISTINCT FROM current role
      // (client → client is a no-op role change, which passes the policy).
      const { error } = await supabase
        .from('profiles')
        .update({ role })
        .eq('id', user.id);
      if (error) throw error;
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
