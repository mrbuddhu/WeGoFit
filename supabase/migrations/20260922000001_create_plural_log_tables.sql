/*
  Realtime Migration 1 — Create plural log tables referenced by insert_* / upsert_* RPCs
  (Additive, zero-downtime, idempotent, zero UI/feature risk)

  Background: Migration 20260509 created tables `food_log`, `exercise_log`, `weight_log`,
  `water_log` (singular) with RLS. The working insert RPCs in 20260516 actually write to
  plural-named tables: `food_logs`, `exercise_logs`, `weight_logs`, `water_logs`, `sleep_logs`.
  Those plural tables may already exist in prod — we use CREATE TABLE IF NOT EXISTS so this
  script is safe either way. We also ensure RLS, policies, indexes, and REPLICA IDENTITY
  are present.

  NO existing data is mutated. NO columns are dropped. NO types are changed.
*/

-- ─── food_logs ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS food_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date            date NOT NULL DEFAULT CURRENT_DATE,
  meal            text NOT NULL DEFAULT 'snacks',
  food_id         text NOT NULL DEFAULT '',
  food_name       text NOT NULL DEFAULT '',
  servings        numeric NOT NULL DEFAULT 1,
  calories        int NOT NULL DEFAULT 0,
  protein_g       numeric NOT NULL DEFAULT 0,
  carbs_g         numeric NOT NULL DEFAULT 0,
  fat_g           numeric NOT NULL DEFAULT 0,
  quantity        numeric NOT NULL DEFAULT 1,
  unit            text NOT NULL DEFAULT 'g',
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE food_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "food_logs read own" ON food_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "food_logs insert own" ON food_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "food_logs delete own" ON food_logs FOR DELETE TO authenticated USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS food_logs_user_date ON food_logs(user_id, date);

-- ─── exercise_logs ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exercise_logs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date             date NOT NULL DEFAULT CURRENT_DATE,
  exercise_id      text NOT NULL DEFAULT '',
  name             text NOT NULL DEFAULT '',
  type             text NOT NULL DEFAULT 'cardio',
  duration_min     int NOT NULL DEFAULT 0,
  calories_burned  numeric NOT NULL DEFAULT 0,
  distance_km      numeric NOT NULL DEFAULT 0,
  avg_speed        numeric NOT NULL DEFAULT 0,
  step_count       int NOT NULL DEFAULT 0,
  integrity_score  numeric NOT NULL DEFAULT 0,
  verified         boolean NOT NULL DEFAULT false,
  source           text NOT NULL DEFAULT 'MANUAL',
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE exercise_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "exercise_logs read own" ON exercise_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "exercise_logs insert own" ON exercise_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "exercise_logs delete own" ON exercise_logs FOR DELETE TO authenticated USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS exercise_logs_user_date ON exercise_logs(user_id, date);

-- ─── weight_logs ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS weight_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date       date NOT NULL DEFAULT CURRENT_DATE,
  weight_kg  numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, date)
);

ALTER TABLE weight_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "weight_logs read own" ON weight_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "weight_logs insert own" ON weight_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "weight_logs update own" ON weight_logs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS weight_logs_user_date ON weight_logs(user_id, date);

-- ─── water_logs ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS water_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date       date NOT NULL DEFAULT CURRENT_DATE,
  litres     numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, date)
);

ALTER TABLE water_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "water_logs read own" ON water_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "water_logs insert own" ON water_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "water_logs update own" ON water_logs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS water_logs_user_date ON water_logs(user_id, date);

-- ─── sleep_logs ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sleep_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date       date NOT NULL DEFAULT CURRENT_DATE,
  bed_time   text NOT NULL DEFAULT '',
  wake_time  text NOT NULL DEFAULT '',
  duration   numeric NOT NULL DEFAULT 0,
  quality    text NOT NULL DEFAULT '',
  notes      text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, date)
);

ALTER TABLE sleep_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "sleep_logs read own" ON sleep_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "sleep_logs insert own" ON sleep_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "sleep_logs update own" ON sleep_logs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "sleep_logs delete own" ON sleep_logs FOR DELETE TO authenticated USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS sleep_logs_user_date ON sleep_logs(user_id, date);
