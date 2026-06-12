-- Backfill: get_referral_leaderboard does not exist in live DB.
-- Extracted from 20260316000000_referral_system.sql which was applied
-- without running the CREATE FUNCTION block (or was applied before the
-- function section existed). CREATE OR REPLACE = safe to re-run.

CREATE OR REPLACE FUNCTION public.get_referral_leaderboard()
RETURNS TABLE (
  rank           bigint,
  full_name      text,
  avatar_url     text,
  referral_count bigint
)
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT
    ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC) AS rank,
    p.full_name,
    p.avatar_url,
    COUNT(*) AS referral_count
  FROM public.referrals r
  JOIN public.profiles p ON p.id = r.referrer_id
  WHERE r.status = 'rewarded'
    AND r.rewarded_at >= date_trunc('month', now())
  GROUP BY p.id, p.full_name, p.avatar_url
  ORDER BY referral_count DESC
  LIMIT 10;
$$;

GRANT EXECUTE ON FUNCTION public.get_referral_leaderboard() TO anon;
GRANT EXECUTE ON FUNCTION public.get_referral_leaderboard() TO authenticated;
