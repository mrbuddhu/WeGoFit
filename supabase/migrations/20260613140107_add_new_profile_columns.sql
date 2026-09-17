ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS weight_kg numeric,
  ADD COLUMN IF NOT EXISTS goal_weight numeric,
  ADD COLUMN IF NOT EXISTS activity text,
  ADD COLUMN IF NOT EXISTS subscription text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS onboarded boolean NOT NULL DEFAULT false;
