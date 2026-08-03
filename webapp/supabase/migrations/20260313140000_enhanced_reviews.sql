-- Phase 8: Enhanced Reviews
-- Adds multi-dimensional ratings, trainer responses, and admin moderation

-- 1. Add new columns to reviews
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS rating_punctuality   smallint CHECK (rating_punctuality   BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_expertise     smallint CHECK (rating_expertise     BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_communication smallint CHECK (rating_communication BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS trainer_response     text CHECK (char_length(trainer_response) <= 1000),
  ADD COLUMN IF NOT EXISTS trainer_response_at  timestamptz,
  ADD COLUMN IF NOT EXISTS is_flagged           boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS flagged_at           timestamptz,
  ADD COLUMN IF NOT EXISTS is_hidden            boolean NOT NULL DEFAULT false;

-- 2. RLS: trainers can add/edit their own response
CREATE POLICY "Trainers can respond to their reviews"
  ON reviews FOR UPDATE
  USING (trainer_id = auth.uid())
  WITH CHECK (trainer_id = auth.uid());

-- 3. RLS: clients can flag reviews they authored
CREATE POLICY "Clients can flag their own reviews"
  ON reviews FOR UPDATE
  USING (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());

-- 4. RLS: admin can hide/unhide any review
CREATE POLICY "Admin can moderate reviews"
  ON reviews FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 5. Computed aggregate view for trainer cards (optional - used by trainer_profiles avg)
CREATE OR REPLACE VIEW trainer_review_stats AS
  SELECT
    trainer_id,
    COUNT(*)                                          AS review_count,
    ROUND(AVG(rating)::numeric, 1)                   AS avg_overall,
    ROUND(AVG(rating_punctuality)::numeric, 1)       AS avg_punctuality,
    ROUND(AVG(rating_expertise)::numeric, 1)         AS avg_expertise,
    ROUND(AVG(rating_communication)::numeric, 1)     AS avg_communication
  FROM reviews
  WHERE is_hidden = false
  GROUP BY trainer_id;
