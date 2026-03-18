import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface LeaderboardEntry {
  rank: number;
  full_name: string;
  avatar_url: string | null;
  referral_count: number;
}

const ReferralLeaderboard: React.FC = () => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const { data, error } = await supabase.rpc('get_referral_leaderboard');
        if (!error && data) {
          setEntries(data as LeaderboardEntry[]);
        }
      } catch {
        // RPC may not exist yet — silently skip
      }
      setLoading(false);
    };
    fetchLeaderboard();
  }, []);

  // Don't render section if no data and not loading (empty leaderboard early on)
  if (!loading && entries.length === 0) return null;

  return (
    <section className="py-24 px-6 border-t border-ink/5">
      <div className="max-w-3xl mx-auto space-y-12">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2">
            <Trophy size={16} className="text-accent" />
            <p className="text-xs uppercase tracking-[0.3em] text-ink/40 font-medium">Top Referrers</p>
          </div>
          <h2 className="text-2xl md:text-3xl serif font-light italic text-ink">
            This Month's Leaders
          </h2>
          <p className="text-sm text-ink/40 font-light">
            Earn rewards by sharing FitRush with friends and trainers.
          </p>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="border border-ink/5 p-4 animate-pulse bg-ink/[0.02]" />
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-2"
          >
            {entries.map((entry) => (
              <div
                key={entry.rank}
                className="flex items-center justify-between border border-ink/10 p-5 hover:border-ink/20 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <span className={`text-sm font-light w-6 text-center ${entry.rank <= 3 ? 'text-accent font-medium' : 'text-ink/30'}`}>
                    {entry.rank}
                  </span>
                  {entry.avatar_url ? (
                    <img
                      src={entry.avatar_url}
                      alt={entry.full_name}
                      loading="lazy"
                      decoding="async"
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-ink/10 flex items-center justify-center">
                      <span className="text-xs text-ink/40 font-medium">
                        {entry.full_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <span className="text-sm font-light text-ink">{entry.full_name}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-light text-ink">{entry.referral_count}</span>
                  <p className="text-[10px] uppercase tracking-[0.15em] text-ink/30">
                    {entry.referral_count === 1 ? 'referral' : 'referrals'}
                  </p>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </div>
    </section>
  );
};

export default ReferralLeaderboard;
