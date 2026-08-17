import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface Opportunity {
  day_of_week: number;
  hour: number;
  idle_count: number;
  potential_cents: number;
}

interface WeeklyInsight {
  total_slots: number;
  idle_slots: number;
  booked_slots: number;
  missed_income_cents: number;
  top_opportunities: Opportunity[];
}

// Monday-based, matching Postgres date_trunc('week', ...) used by the RPC.
function lastCompletedWeekUTC(): { start: string; end: string } {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const thisMonday = new Date(today);
  thisMonday.setUTCDate(today.getUTCDate() - ((today.getUTCDay() + 6) % 7));
  const lastMonday = new Date(thisMonday);
  lastMonday.setUTCDate(thisMonday.getUTCDate() - 7);
  return { start: lastMonday.toISOString(), end: thisMonday.toISOString() };
}

function hourLabel(hour: number): string {
  const suffix = hour < 12 ? 'am' : 'pm';
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}${suffix}`;
}

function insightSentence(top: Opportunity | undefined): string {
  if (!top) return 'Every slot you offered last week was booked.';
  const times = top.idle_count === 1 ? 'once' : `${top.idle_count} times`;
  return `Your ${DAYS[top.day_of_week]} ${hourLabel(top.hour)} slot went unbooked ${times} last week.`;
}

const RevenueInsightCard: React.FC = () => {
  const [insight, setInsight] = useState<WeeklyInsight | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchInsight = async () => {
      const { start, end } = lastCompletedWeekUTC();
      const { data, error } = await (supabase as any).rpc('get_trainer_weekly_missed_income', {
        p_week_start: start,
        p_week_end: end,
      });

      if (cancelled) return;
      setInsight(error ? null : ((data?.[0] as WeeklyInsight | undefined) ?? null));
      setLoading(false);
    };

    fetchInsight();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="border border-ink/10 p-6 animate-pulse space-y-3">
        <div className="h-3 w-32 bg-ink/5" />
        <div className="h-8 w-28 bg-ink/5" />
        <div className="h-3 w-3/4 bg-ink/5" />
      </div>
    );
  }

  if (!insight || insight.total_slots < 5) return null;

  const dollars = (insight.missed_income_cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });

  return (
    <div className="border border-ink/10 p-6 space-y-3">
      <p className="text-[9px] uppercase tracking-[0.2em] text-ink/70 font-medium">
        Revenue Insights &mdash; Last Week
      </p>

      <div className="flex items-baseline gap-3">
        <span className="text-3xl font-light text-ink">{dollars}</span>
        <span className="text-xs text-ink/70">missed income from unbooked slots</span>
      </div>

      <p className="text-sm text-ink/60">{insightSentence(insight.top_opportunities?.[0])}</p>

      <p className="text-[10px] text-ink/60">
        {insight.total_slots} slots &middot; {insight.booked_slots} booked &middot; {insight.idle_slots} unbooked
      </p>
    </div>
  );
};

export default RevenueInsightCard;
