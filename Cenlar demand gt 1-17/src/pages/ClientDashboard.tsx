import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';
import ReferralWidget from '@/components/shared/ReferralWidget';

const ClientDashboard: React.FC = () => {
  const { profile, user } = useAuthStore();
  const [upcomingCount, setUpcomingCount] = useState(0);
  const [pastCount, setPastCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    const fetchCounts = async () => {
      const { count: upcoming } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', user.id)
        .in('status', ['pending', 'confirmed']);

      const { count: past } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', user.id)
        .in('status', ['completed', 'cancelled']);

      setUpcomingCount(upcoming ?? 0);
      setPastCount(past ?? 0);
    };

    fetchCounts();
  }, [user]);

  return (
    <div className="min-h-screen bg-paper pt-32 pb-20 px-6">
      <div className="max-w-5xl mx-auto space-y-12">
        <div className="space-y-4">
          <h1 className="text-3xl serif font-light italic text-ink">
            Welcome, {profile?.full_name || 'there'}
          </h1>
          <p className="text-xs uppercase tracking-[0.3em] text-ink/40">Your fitness journey</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                Past Sessions
              </p>
            </div>
            <p className="text-3xl serif font-light text-ink">{pastCount}</p>
          </div>
          <div className="border border-ink/10 p-8 space-y-3">
            <div className="flex items-center gap-2">
              <User size={14} className="text-accent" />
              <p className="text-xs uppercase tracking-[0.2em] text-ink/40 font-medium">
                Member Since
              </p>
            </div>
            <p className="text-lg serif font-light text-ink/60">
              {profile?.created_at
                ? new Date(profile.created_at).toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric',
                  })
                : '—'}
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link
            to="/client/bookings"
            className="border border-ink/10 p-10 space-y-4 hover:border-accent/30 transition-colors group"
          >
            <p className="text-xs uppercase tracking-[0.2em] text-ink/40 font-medium group-hover:text-accent transition-colors">
              My Bookings
            </p>
            <p className="text-sm text-ink/50 font-light">
              View and manage all your upcoming and past training sessions.
            </p>
          </Link>
          <Link
            to="/trainers"
            className="border border-ink/10 p-10 space-y-4 hover:border-accent/30 transition-colors group"
          >
            <p className="text-xs uppercase tracking-[0.2em] text-ink/40 font-medium group-hover:text-accent transition-colors">
              Browse Trainers
            </p>
            <p className="text-sm text-ink/50 font-light">
              Find certified trainers with optimized-rate sessions near you.
            </p>
          </Link>
        </div>

        {/* Referral Widget */}
        {profile?.referral_code && (
          <ReferralWidget referralCode={profile.referral_code} />
        )}
      </div>
    </div>
  );
};

export default ClientDashboard;
