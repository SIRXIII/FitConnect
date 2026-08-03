CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT,
  auth_key TEXT,
  platform TEXT NOT NULL DEFAULT 'web' CHECK (platform IN ('web', 'ios')),
  device_token TEXT, -- iOS APNs/FCM token (platform='ios')
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own push subscriptions"
  ON push_subscriptions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role can read all for sending
CREATE POLICY "Service role read push subscriptions"
  ON push_subscriptions FOR SELECT
  TO service_role USING (true);
