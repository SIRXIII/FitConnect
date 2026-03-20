ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS hourly_budget_max integer;
COMMENT ON COLUMN client_profiles.hourly_budget_max IS 'Client max hourly budget preference for AI matching (nullable)';
