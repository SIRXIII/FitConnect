import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, Search, Heart, Sparkles, Bell, Camera, Shield, User, LifeBuoy, Dumbbell } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';
import ReferralWidget from '@/components/shared/ReferralWidget';
import ProgressTab from '@/components/client/ProgressTab';
import { NotificationPreferencesSection } from '@/components/client/NotificationPreferencesSection';
import ProfileProgressRing from '@/components/client/ProfileProgressRing';
import ClientSettingsTab from '@/components/client/ClientSettingsTab';
import ClientSupportTab from '@/components/support/ClientSupportTab';
import NotificationPermissionPrompt from '@/components/NotificationPermissionPrompt';
import WorkoutTab from '@/components/client/WorkoutTab';

// ─── Profile completion calculation (mirrors ClientPassport logic) ─────────────
function computeCompletion(clientProfile: Record<string, unknown> | null, avatarUrl: string | null | undefined) {
  if (!clientProfile) return { pct: 0, missing: ['age', 'weight', 'height', 'fitness level', 'intensity preference', 'goals'] };
  const hasGoals = !!((clientProfile.goals_ranked as string[] | null)?.length || (clientProfile.fitness_goals as string[] | null)?.length);
  const hasHealth = !!((clientProfile.health_conditions as string[] | null)?.length || (clientProfile.health_notes as string | null)?.trim());
  const fields = [
    !!avatarUrl,
    !!(clientProfile.age),
    !!(clientProfile.weight_lbs),
    !!(clientProfile.height_ft || clientProfile.height_in),
    !!(clientProfile.fitness_level),
    hasHealth,
    !!(clientProfile.intensity_preference),
    hasGoals,
  ];
  const pct = Math.round((fields.filter(Boolean).length / fields.length) * 100);
  const missing: string[] = [];
  if (!clientProfile.age) missing.push('age');
  if (!clientProfile.weight_lbs) missing.push('weight');
  if (!clientProfile.height_ft && !clientProfile.height_in) missing.push('height');
  if (!clientProfile.fitness_level) missing.push('fitness level');
  if (!clientProfile.intensity_preference) missing.push('intensity preference');
  if (!hasGoals) missing.push('goals');
  return { pct, missing };
}

// ─── Quick action card ─────────────────────────────────────────────────────────
interface QuickActionProps {
  to: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}

const QuickActionCard: React.FC<QuickActionProps> = ({ to, icon, title, description }) => (
  <Link
    to={to}
    className="border border-ink/10 p-8 space-y-4 hover:border-accent/40 hover:bg-accent/[0.02] transition-all group"
  >
    <div className="flex items-center gap-3">
      <span className="text-ink/30 group-hover:text-accent transition-colors">{icon}</span>
      <p className="text-xs uppercase tracking-[0.2em] text-ink/50 font-medium group-hover:text-accent transition-colors">
        {title}
      </p>
    </div>
    <p className="text-sm text-ink/40 font-light leading-relaxed">
      {description}
    </p>
  </Link>
);

// ─── Main component ────────────────────────────────────────────────────────────

type TabId = 'overview' | 'profile' | 'workouts' | 'progress' | 'alerts' | 'settings' | 'support';

const ClientDashboard: React.FC = () => {
  const { profile, user } = useAuthStore();
  const [upcomingCount, setUpcomingCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [clientProfile, setClientProfile] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      // Booking counts
      const { count: upcoming } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', user.id)
        .in('status', ['pending', 'confirmed']);

      const { count: completed } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', user.id)
        .eq('status', 'completed');

      setUpcomingCount(upcoming ?? 0);
      setCompletedCount(completed ?? 0);

      // Client profile for completion ring
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from('client_profiles')
          .select('age, weight_lbs, height_ft, height_in, fitness_level, health_conditions, health_notes, intensity_preference, goals_ranked, fitness_goals, workout_types, training_frequency, bio')
          .eq('user_id', user.id)
          .maybeSingle() as unknown as { data: Record<string, unknown> | null; error: unknown };
        if (!error && data) setClientProfile(data);
      } catch {
        // No profile yet
      }
    };

    fetchData();
  }, [user]);

  const { pct: completionPct, missing: missingFields } = computeCompletion(clientProfile, profile?.avatar_url);

  const initials = profile?.full_name
    ? profile.full_name.trim().split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const TABS: { id: TabId; label: string; icon?: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'profile', label: 'Fitness Profile' },
    { id: 'workouts', label: 'Workouts', icon: <Dumbbell size={11} /> },
    { id: 'settings', label: 'Settings', icon: <User size={11} /> },
    { id: 'progress', label: 'Progress' },
    { id: 'alerts', label: 'Alerts', icon: <Bell size={11} /> },
    { id: 'support', label: 'Support', icon: <LifeBuoy size={11} /> },
  ];

  // Passport summary values
  const fitnessLevel = clientProfile?.fitness_level as string | null;
  const goalsRanked = (clientProfile?.goals_ranked as string[] | null) ?? [];
  const workoutTypes = (clientProfile?.workout_types as string[] | null) ?? [];
  const intensityPreference = clientProfile?.intensity_preference as string | null;
  const hasPassportData = !!(fitnessLevel || goalsRanked.length || workoutTypes.length || intensityPreference);

  return (
    <div className="min-h-screen bg-paper pt-24 md:pt-32 pb-20 px-4 sm:px-6">
      {/* Push notification permission prompt — manages its own visibility */}
      {user && <NotificationPermissionPrompt userId={user.id} />}
      <div className="max-w-5xl mx-auto space-y-10">

        {/* ── Profile Header Card ───────────────────────────────────── */}
        <div className="border border-ink/10 p-8 sm:p-10">
          <div className="flex flex-col sm:flex-row sm:items-center gap-8">

            {/* Avatar */}
            <div className="shrink-0 relative w-20 h-20">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.full_name || ''}
                  className="w-20 h-20 rounded-full object-cover border border-ink/10"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-ink/5 border border-ink/10 flex items-center justify-center">
                  <span className="text-2xl serif font-light text-ink/30">{initials}</span>
                </div>
              )}
              <Link
                to="/client/passport"
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-paper border border-ink/15 flex items-center justify-center hover:border-accent/50 hover:text-accent transition-colors"
                title="Edit profile photo"
              >
                <Camera size={12} className="text-ink/40" />
              </Link>
            </div>

            {/* Name + email + member since */}
            <div className="flex-1 min-w-0 space-y-1.5">
              <h1 className="text-2xl serif font-light italic text-ink truncate">
                {profile?.full_name || 'Welcome'}
              </h1>
              {user?.email && (
                <p className="text-xs text-ink/40 font-light">{user.email}</p>
              )}
              {profile?.created_at && (
                <p className="text-[10px] uppercase tracking-[0.2em] text-ink/30">
                  Member since{' '}
                  {new Date(profile.created_at).toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              )}
              <Link
                to="/client/passport"
                className="inline-block mt-3 text-[10px] uppercase tracking-[0.2em] border border-ink/15 px-4 py-2 hover:border-accent/40 hover:text-accent transition-colors"
              >
                Edit Profile
              </Link>
            </div>

            {/* Progress ring */}
            <div className="shrink-0">
              <ProfileProgressRing completionPct={completionPct} missingFields={missingFields} />
              <p className="text-center text-[9px] uppercase tracking-[0.15em] text-ink/30 mt-1">
                Profile complete
              </p>
            </div>
          </div>
        </div>

        {/* ── Tab Navigation ────────────────────────────────────────── */}
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <div className="flex gap-4 sm:gap-6 border-b border-ink/10 min-w-max sm:min-w-0 px-4 sm:px-0">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-4 text-[11px] uppercase tracking-[0.2em] font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === tab.id
                    ? 'text-ink border-b-2 border-accent'
                    : 'text-ink/30 hover:text-ink/50'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab Content ───────────────────────────────────────────── */}

        {activeTab === 'overview' && (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
              <div className="border border-ink/10 p-8 space-y-3">
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-accent" />
                  <p className="text-xs uppercase tracking-[0.2em] text-ink/40 font-medium">
                    Upcoming Sessions
                  </p>
                </div>
                <p className="text-3xl serif font-light text-ink">{upcomingCount}</p>
              </div>
              <div className="border border-ink/10 p-8 space-y-3">
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-accent" />
                  <p className="text-xs uppercase tracking-[0.2em] text-ink/40 font-medium">
                    Sessions Completed
                  </p>
                </div>
                <p className="text-3xl serif font-light text-ink">{completedCount}</p>
              </div>
              <div className="border border-ink/10 p-8 space-y-3">
                <div className="flex items-center gap-2">
                  <Heart size={14} className="text-accent" />
                  <p className="text-xs uppercase tracking-[0.2em] text-ink/40 font-medium">
                    Profile Complete
                  </p>
                </div>
                <p className="text-3xl serif font-light text-ink">{completionPct}%</p>
              </div>
            </div>

            {/* Quick Actions — 4-card grid */}
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-ink/30 mb-5">Quick Actions</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <QuickActionCard
                  to="/trainers"
                  icon={<Search size={16} />}
                  title="Find Trainers"
                  description="Browse certified trainers and book sessions near you."
                />
                <QuickActionCard
                  to="/client/bookings"
                  icon={<Calendar size={16} />}
                  title="My Bookings"
                  description="View and manage your upcoming and past sessions."
                />
                <QuickActionCard
                  to="/client/passport"
                  icon={<Heart size={16} />}
                  title="Fitness Passport"
                  description="Update your goals, health info, and preferences."
                />
                <QuickActionCard
                  to="/#search"
                  icon={<Sparkles size={16} />}
                  title="AI Recommendations"
                  description="Get trainer suggestions tailored to your fitness profile."
                />
              </div>
            </div>

            {/* Payment Methods */}
            <div className="border border-ink/10 p-8 space-y-4">
              <div className="flex items-center gap-3">
                <Shield size={14} className="text-accent" />
                <p className="text-xs uppercase tracking-[0.2em] text-ink/40 font-medium">
                  Payment Methods
                </p>
              </div>
              <p className="text-sm text-ink/50 font-light leading-relaxed max-w-xl">
                Payment is handled securely through Stripe at the time of booking. No card storage
                required — your details are processed directly by Stripe's encrypted checkout.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                <p className="text-[10px] uppercase tracking-[0.2em] text-ink/30">
                  Secured by Stripe
                </p>
              </div>
            </div>

            {/* Referral Widget */}
            {profile?.referral_code && (
              <ReferralWidget referralCode={profile.referral_code} />
            )}
          </>
        )}

        {activeTab === 'profile' && (
          <div className="space-y-8">
            {/* Summary card */}
            <div className="border border-ink/10 p-8 sm:p-10 space-y-8">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <h2 className="text-xl serif font-light italic text-ink">Fitness Passport</h2>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-ink/30">
                    How trainers see you
                  </p>
                </div>
                <Link
                  to="/client/passport"
                  className="shrink-0 text-[10px] uppercase tracking-[0.2em] border border-ink/15 px-5 py-2.5 hover:border-accent/40 hover:text-accent transition-colors"
                >
                  Edit
                </Link>
              </div>

              {hasPassportData ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-6">
                  {fitnessLevel && (
                    <div className="space-y-1">
                      <p className="text-[9px] uppercase tracking-[0.2em] text-ink/30">Fitness Level</p>
                      <p className="text-sm text-ink font-light capitalize">{fitnessLevel}</p>
                    </div>
                  )}
                  {intensityPreference && (
                    <div className="space-y-1">
                      <p className="text-[9px] uppercase tracking-[0.2em] text-ink/30">Intensity</p>
                      <p className="text-sm text-ink font-light capitalize">{intensityPreference}</p>
                    </div>
                  )}
                  {goalsRanked.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[9px] uppercase tracking-[0.2em] text-ink/30">Top Goals</p>
                      <div className="flex flex-wrap gap-2">
                        {goalsRanked.slice(0, 3).map((g, i) => (
                          <span
                            key={g}
                            className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.1em] border border-ink/10 px-3 py-1 text-ink/60"
                          >
                            <span className="text-accent/60 font-medium">{i + 1}.</span>
                            {g.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {workoutTypes.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[9px] uppercase tracking-[0.2em] text-ink/30">Workout Types</p>
                      <div className="flex flex-wrap gap-2">
                        {workoutTypes.slice(0, 4).map(w => (
                          <span
                            key={w}
                            className="text-[10px] uppercase tracking-[0.1em] border border-ink/10 px-3 py-1 text-ink/50"
                          >
                            {w.replace(/_/g, ' ')}
                          </span>
                        ))}
                        {workoutTypes.length > 4 && (
                          <span className="text-[10px] text-ink/30 py-1">
                            +{workoutTypes.length - 4} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Empty state CTA */
                <div className="py-6 space-y-4 text-center">
                  <div className="w-12 h-12 mx-auto rounded-full bg-accent/5 border border-accent/10 flex items-center justify-center">
                    <Heart size={18} className="text-accent/40" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-ink/50 font-light">
                      Your Fitness Passport is empty
                    </p>
                    <p className="text-xs text-ink/30 max-w-sm mx-auto">
                      Add your goals, fitness level, and preferences to help trainers find and match
                      with you more accurately.
                    </p>
                  </div>
                  <Link
                    to="/client/passport"
                    className="inline-block text-[10px] uppercase tracking-[0.2em] border border-accent/30 px-8 py-3 text-accent hover:bg-accent hover:text-white transition-all"
                  >
                    Complete Your Profile
                  </Link>
                </div>
              )}
            </div>

            {/* Completion nudge if partial */}
            {hasPassportData && completionPct < 100 && (
              <div className="border border-accent/15 bg-accent/[0.02] p-6 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.2em] text-ink/50 font-medium">
                    {100 - completionPct}% remaining
                  </p>
                  <p className="text-sm text-ink/40 font-light">
                    Complete your profile to improve trainer matching accuracy.
                  </p>
                </div>
                <Link
                  to="/client/passport"
                  className="shrink-0 text-[10px] uppercase tracking-[0.2em] border border-accent/30 px-5 py-2.5 text-accent hover:bg-accent hover:text-white transition-all"
                >
                  Continue
                </Link>
              </div>
            )}
          </div>
        )}

        {activeTab === 'workouts' && (
          <WorkoutTab userId={user!.id} />
        )}

        {activeTab === 'settings' && (
          <ClientSettingsTab />
        )}

        {activeTab === 'progress' && (
          <ProgressTab userId={user!.id} />
        )}

        {activeTab === 'alerts' && (
          <NotificationPreferencesSection />
        )}

        {activeTab === 'support' && (
          <ClientSupportTab />
        )}

      </div>
    </div>
  );
};

export default ClientDashboard;
