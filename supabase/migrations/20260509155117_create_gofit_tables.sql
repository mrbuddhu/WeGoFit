/*
  # GoFit — Initial Schema

  1. New Tables
    - `profiles` — user profile data (synced from onboarding)
      - `id` (uuid, PK, references auth.users)
      - `name`, `age`, `gender`, `height_cm`, `current_weight_kg`, `goal_weight_kg`
      - `goal`, `activity_level`, `subscription_status`, `member_since`
    - `food_log` — daily food entries
      - `id`, `user_id`, `date`, `meal`, `food_name`, `servings`, `calories`, macros
    - `exercise_log` — exercise sessions
      - `id`, `user_id`, `date`, `exercise_name`, `type`, `duration_min`, `calories_burned`
    - `weight_log` — weight tracking
      - `id`, `user_id`, `date`, `weight_kg`
    - `water_log` — daily water intake
      - `id`, `user_id`, `date`, `glasses`

  2. Security
    - RLS enabled on all tables
    - Authenticated users can only read/write their own data
*/

-- Profiles
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  age int NOT NULL DEFAULT 0,
  gender text NOT NULL DEFAULT 'male',
  height_cm numeric NOT NULL DEFAULT 0,
  current_weight_kg numeric NOT NULL DEFAULT 0,
  goal_weight_kg numeric NOT NULL DEFAULT 0,
  goal text NOT NULL DEFAULT 'lose',
  activity_level text NOT NULL DEFAULT 'active',
  subscription_status text NOT NULL DEFAULT 'free',
  member_since date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Food log
CREATE TABLE IF NOT EXISTS food_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  meal text NOT NULL DEFAULT 'breakfast',
  food_id text NOT NULL DEFAULT '',
  food_name text NOT NULL DEFAULT '',
  servings numeric NOT NULL DEFAULT 1,
  calories int NOT NULL DEFAULT 0,
  protein_g numeric NOT NULL DEFAULT 0,
  carbs_g numeric NOT NULL DEFAULT 0,
  fat_g numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE food_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own food log"
  ON food_log FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own food log"
  ON food_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own food log"
  ON food_log FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Exercise log
CREATE TABLE IF NOT EXISTS exercise_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  exercise_id text NOT NULL DEFAULT '',
  exercise_name text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'cardio',
  duration_min int NOT NULL DEFAULT 0,
  calories_burned int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE exercise_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own exercise log"
  ON exercise_log FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own exercise log"
  ON exercise_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own exercise log"
  ON exercise_log FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Weight log
CREATE TABLE IF NOT EXISTS weight_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  weight_kg numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE weight_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own weight log"
  ON weight_log FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own weight log"
  ON weight_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Water log
CREATE TABLE IF NOT EXISTS water_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  glasses int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE water_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own water log"
  ON water_log FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own water log"
  ON water_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own water log"
  ON water_log FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS food_log_user_date ON food_log(user_id, date);
CREATE INDEX IF NOT EXISTS exercise_log_user_date ON exercise_log(user_id, date);
CREATE INDEX IF NOT EXISTS weight_log_user_date ON weight_log(user_id, date);
