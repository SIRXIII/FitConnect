-- C1: Add certification number + URL fields to trainer_profiles
ALTER TABLE trainer_profiles
  ADD COLUMN IF NOT EXISTS certification_number text,
  ADD COLUMN IF NOT EXISTS certification_url text;

-- C2: Storage buckets for avatars and certifications

-- Public avatars bucket (anyone can view, owner can upload/update)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
CREATE POLICY "Anyone can view avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users upload own avatar" ON storage.objects;
CREATE POLICY "Users upload own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users update own avatar" ON storage.objects;
CREATE POLICY "Users update own avatar"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Private certifications bucket (owner only)
INSERT INTO storage.buckets (id, name, public)
VALUES ('certifications', 'certifications', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Trainers upload own certs" ON storage.objects;
CREATE POLICY "Trainers upload own certs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'certifications' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Trainers read own certs" ON storage.objects;
CREATE POLICY "Trainers read own certs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'certifications' AND auth.uid()::text = (storage.foldername(name))[1]);
