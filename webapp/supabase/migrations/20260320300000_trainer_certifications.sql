-- Trainer certifications table
CREATE TABLE IF NOT EXISTS trainer_certifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trainer_id UUID REFERENCES trainer_profiles(id) ON DELETE CASCADE NOT NULL,
  cert_code TEXT NOT NULL,
  cert_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  expiry_date DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE trainer_certifications ENABLE ROW LEVEL SECURITY;

-- Trainers can view their own certs
CREATE POLICY "Trainers can view own certifications" ON trainer_certifications
  FOR SELECT USING (trainer_id IN (SELECT id FROM trainer_profiles WHERE user_id = auth.uid()));

-- Trainers can insert their own certs
CREATE POLICY "Trainers can upload certifications" ON trainer_certifications
  FOR INSERT WITH CHECK (trainer_id IN (SELECT id FROM trainer_profiles WHERE user_id = auth.uid()));

-- Admins can view all and update
CREATE POLICY "Admins can view all certifications" ON trainer_certifications
  FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update certifications" ON trainer_certifications
  FOR UPDATE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Storage bucket for cert documents
INSERT INTO storage.buckets (id, name, public) VALUES ('trainer-certifications', 'trainer-certifications', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Trainers can upload cert docs" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'trainer-certifications' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can view cert docs" ON storage.objects
  FOR SELECT USING (bucket_id = 'trainer-certifications');

-- Add verified flag to trainer_profiles if not exists
DO $$ BEGIN
  ALTER TABLE trainer_profiles ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;
  ALTER TABLE trainer_profiles ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
