-- Security advisor ERROR fix: view ran as SECURITY DEFINER (creator's RLS).
-- Underlying table `reviews` has a public SELECT policy (using true), so
-- switching to invoker semantics changes no visible rows for any role.
ALTER VIEW public.trainer_review_stats SET (security_invoker = true);
