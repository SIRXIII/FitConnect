-- Add intro video columns to trainer_profiles
ALTER TABLE trainer_profiles
  ADD COLUMN IF NOT EXISTS intro_video_url TEXT,
  ADD COLUMN IF NOT EXISTS intro_video_thumbnail_url TEXT;

-- Create trainer-videos storage bucket (public read)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'trainer-videos',
  'trainer-videos',
  true,
  52428800, -- 50MB
  ARRAY['video/mp4', 'video/webm', 'video/quicktime']
) ON CONFLICT (id) DO NOTHING;

-- RLS: trainers can upload/delete only their own folder
CREATE POLICY "Trainer upload own video"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'trainer-videos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Trainer delete own video"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'trainer-videos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Public read trainer videos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'trainer-videos');
