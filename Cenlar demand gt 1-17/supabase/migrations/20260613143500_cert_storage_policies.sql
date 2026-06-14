-- Storage RLS for the private trainer-certifications bucket.
-- Admin: full access (mint signed URLs for preview). Trainer: own folder only (path = <auth_uid>/...).
DROP POLICY IF EXISTS "admin manage cert files" ON storage.objects;
CREATE POLICY "admin manage cert files" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id='trainer-certifications' AND (SELECT role FROM public.profiles WHERE id=auth.uid())='admin')
  WITH CHECK (bucket_id='trainer-certifications' AND (SELECT role FROM public.profiles WHERE id=auth.uid())='admin');

DROP POLICY IF EXISTS "trainer manage own cert files" ON storage.objects;
CREATE POLICY "trainer manage own cert files" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id='trainer-certifications' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id='trainer-certifications' AND (storage.foldername(name))[1] = auth.uid()::text);
