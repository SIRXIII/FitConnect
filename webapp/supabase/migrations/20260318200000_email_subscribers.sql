CREATE TABLE IF NOT EXISTS public.email_subscribers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_subscribers_email
  ON public.email_subscribers (lower(email));

ALTER TABLE public.email_subscribers ENABLE ROW LEVEL SECURITY;

-- No anon SELECT policy (hide subscriber list from public)
-- INSERT handled by service-role key in Edge Function (bypasses RLS)
-- Admin read policy can be added later when admin panel needs access
