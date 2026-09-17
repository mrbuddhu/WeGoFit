/*
 WeGoFit portable database export

 Apply this file to a fresh Supabase-compatible PostgreSQL database in the order shown below.
 It includes tables, row-level security policies, indexes, and protected RPC functions.
 Existing user rows and auth accounts are not included; export those separately from the source project.
*/

/* ===== 20260509155117_create_gofit_tables.sql ===== */
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


/* ===== Portable compatibility additions =====
 These columns and tables are declared before RPC functions because the historical
 migration set introduced some client-facing fields and plural log tables later.
*/
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS weight_kg numeric,
  ADD COLUMN IF NOT EXISTS goal_weight numeric,
  ADD COLUMN IF NOT EXISTS activity text,
  ADD COLUMN IF NOT EXISTS subscription text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS onboarded boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS calories int NOT NULL DEFAULT 1800,
  ADD COLUMN IF NOT EXISTS protein int NOT NULL DEFAULT 135,
  ADD COLUMN IF NOT EXISTS carbs int NOT NULL DEFAULT 180,
  ADD COLUMN IF NOT EXISTS fat int NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS is_vip boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS food_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  meal text NOT NULL DEFAULT 'snacks',
  food_name text NOT NULL DEFAULT '',
  calories numeric NOT NULL DEFAULT 0,
  protein numeric NOT NULL DEFAULT 0,
  carbs numeric NOT NULL DEFAULT 0,
  fat numeric NOT NULL DEFAULT 0,
  quantity numeric NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'g',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sleep_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  bed_time text NOT NULL DEFAULT '',
  wake_time text NOT NULL DEFAULT '',
  duration numeric NOT NULL DEFAULT 0,
  quality text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);
CREATE TABLE IF NOT EXISTS exercise_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  name text NOT NULL DEFAULT '',
  duration_min int NOT NULL DEFAULT 0,
  calories_burned numeric NOT NULL DEFAULT 0,
  distance_km numeric NOT NULL DEFAULT 0,
  avg_speed numeric NOT NULL DEFAULT 0,
  step_count int NOT NULL DEFAULT 0,
  integrity_score numeric NOT NULL DEFAULT 0,
  verified boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'MANUAL',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS water_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  litres numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);
CREATE TABLE IF NOT EXISTS weight_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  weight_kg numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

ALTER TABLE food_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sleep_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE water_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE weight_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "food_logs_select_own" ON food_logs;
CREATE POLICY "food_logs_select_own" ON food_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "food_logs_insert_own" ON food_logs;
CREATE POLICY "food_logs_insert_own" ON food_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "food_logs_update_own" ON food_logs;
CREATE POLICY "food_logs_update_own" ON food_logs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "food_logs_delete_own" ON food_logs;
CREATE POLICY "food_logs_delete_own" ON food_logs FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "sleep_logs_select_own" ON sleep_logs;
CREATE POLICY "sleep_logs_select_own" ON sleep_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "sleep_logs_insert_own" ON sleep_logs;
CREATE POLICY "sleep_logs_insert_own" ON sleep_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "sleep_logs_update_own" ON sleep_logs;
CREATE POLICY "sleep_logs_update_own" ON sleep_logs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "sleep_logs_delete_own" ON sleep_logs;
CREATE POLICY "sleep_logs_delete_own" ON sleep_logs FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "exercise_logs_select_own" ON exercise_logs;
CREATE POLICY "exercise_logs_select_own" ON exercise_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "exercise_logs_insert_own" ON exercise_logs;
CREATE POLICY "exercise_logs_insert_own" ON exercise_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "exercise_logs_update_own" ON exercise_logs;
CREATE POLICY "exercise_logs_update_own" ON exercise_logs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "exercise_logs_delete_own" ON exercise_logs;
CREATE POLICY "exercise_logs_delete_own" ON exercise_logs FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "water_logs_select_own" ON water_logs;
CREATE POLICY "water_logs_select_own" ON water_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "water_logs_insert_own" ON water_logs;
CREATE POLICY "water_logs_insert_own" ON water_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "water_logs_update_own" ON water_logs;
CREATE POLICY "water_logs_update_own" ON water_logs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "water_logs_delete_own" ON water_logs;
CREATE POLICY "water_logs_delete_own" ON water_logs FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "weight_logs_select_own" ON weight_logs;
CREATE POLICY "weight_logs_select_own" ON weight_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "weight_logs_insert_own" ON weight_logs;
CREATE POLICY "weight_logs_insert_own" ON weight_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "weight_logs_update_own" ON weight_logs;
CREATE POLICY "weight_logs_update_own" ON weight_logs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "weight_logs_delete_own" ON weight_logs;
CREATE POLICY "weight_logs_delete_own" ON weight_logs FOR DELETE TO authenticated USING (auth.uid() = user_id);

/* ===== 20260516065750_create_delete_user_rpc.sql ===== */
/*
  # Create delete_user RPC function

  Allows authenticated users to delete their own auth account.
  Called from the GoFit app's Delete Account flow.

  Security: SECURITY DEFINER so it can delete from auth.users,
  but only deletes the row matching the calling user's auth.uid().
*/

CREATE OR REPLACE FUNCTION delete_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;


/* ===== 20260516094748_create_update_profile_rpc.sql ===== */
/*
  # Create update_profile RPC function

  ## Purpose
  Provides a SECURITY DEFINER function to upsert profile data during onboarding.
  This bypasses RLS so the newly-authenticated user can write their own profile
  row even if the RLS policies haven't been fully satisfied yet.

  ## Parameters
  All parameters map 1-to-1 with the profiles table columns.

  ## Security
  - SECURITY DEFINER runs as the function owner (postgres), bypassing RLS
  - The function validates that p_id matches auth.uid() so a user can only
    update their own profile
*/

CREATE OR REPLACE FUNCTION update_profile(
  p_id          uuid,
  p_name        text    DEFAULT '',
  p_age         int     DEFAULT NULL,
  p_gender      text    DEFAULT '',
  p_height_cm   numeric DEFAULT NULL,
  p_weight_kg   numeric DEFAULT NULL,
  p_goal_weight numeric DEFAULT NULL,
  p_activity    text    DEFAULT 'light',
  p_goal        text    DEFAULT 'maintain',
  p_calories    int     DEFAULT 1800,
  p_protein     int     DEFAULT 135,
  p_carbs       int     DEFAULT 180,
  p_fat         int     DEFAULT 60
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ensure caller can only update their own profile
  IF auth.uid() IS DISTINCT FROM p_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO profiles (
    id, name, age, gender, height_cm, weight_kg, goal_weight,
    activity, goal, calories, protein, carbs, fat, onboarded
  )
  VALUES (
    p_id, p_name, p_age, p_gender, p_height_cm, p_weight_kg, p_goal_weight,
    p_activity, p_goal, p_calories, p_protein, p_carbs, p_fat, true
  )
  ON CONFLICT (id) DO UPDATE SET
    name        = EXCLUDED.name,
    age         = EXCLUDED.age,
    gender      = EXCLUDED.gender,
    height_cm   = EXCLUDED.height_cm,
    weight_kg   = EXCLUDED.weight_kg,
    goal_weight = EXCLUDED.goal_weight,
    activity    = EXCLUDED.activity,
    goal        = EXCLUDED.goal,
    calories    = EXCLUDED.calories,
    protein     = EXCLUDED.protein,
    carbs       = EXCLUDED.carbs,
    fat         = EXCLUDED.fat,
    onboarded   = true;
END;
$$;


/* ===== 20260516103418_create_log_rpc_functions.sql ===== */
/*
  # Create RPC functions for all log tables

  ## Purpose
  Provides SECURITY DEFINER functions for inserting/upserting log data.
  These bypass RLS so authenticated users can always write their own logs
  without RLS policy conflicts.

  ## Functions created
  1. insert_food_log     — inserts a single food log entry
  2. insert_sleep_log    — upserts today's sleep log entry
  3. insert_exercise_log — inserts a single exercise log entry
  4. upsert_water_log    — upserts today's water intake
  5. insert_weight_log   — upserts a weight entry for a given date

  ## Security
  - All functions are SECURITY DEFINER (run as postgres, bypass RLS)
  - Each function validates auth.uid() === p_user_id before writing
*/

-- ─── insert_food_log ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION insert_food_log(
  p_user_id   uuid,
  p_date      text,
  p_meal      text    DEFAULT 'snacks',
  p_food_name text    DEFAULT '',
  p_calories  numeric DEFAULT 0,
  p_protein   numeric DEFAULT 0,
  p_carbs     numeric DEFAULT 0,
  p_fat       numeric DEFAULT 0,
  p_quantity  numeric DEFAULT 1,
  p_unit      text    DEFAULT 'g'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO food_logs (
    user_id, date, meal, food_name,
    calories, protein, carbs, fat, quantity, unit
  ) VALUES (
    p_user_id, p_date, p_meal, p_food_name,
    p_calories, p_protein, p_carbs, p_fat, p_quantity, p_unit
  );
END;
$$;

-- ─── insert_sleep_log ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION insert_sleep_log(
  p_user_id   uuid,
  p_date      text,
  p_bed_time  text    DEFAULT '',
  p_wake_time text    DEFAULT '',
  p_duration  numeric DEFAULT 0,
  p_quality   text    DEFAULT '',
  p_notes     text    DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO sleep_logs (
    user_id, date, bed_time, wake_time, duration, quality, notes
  ) VALUES (
    p_user_id, p_date, p_bed_time, p_wake_time, p_duration, p_quality, p_notes
  )
  ON CONFLICT (user_id, date) DO UPDATE SET
    bed_time  = EXCLUDED.bed_time,
    wake_time = EXCLUDED.wake_time,
    duration  = EXCLUDED.duration,
    quality   = EXCLUDED.quality,
    notes     = EXCLUDED.notes;
END;
$$;

-- ─── insert_exercise_log ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION insert_exercise_log(
  p_user_id         uuid,
  p_date            text,
  p_name            text    DEFAULT '',
  p_duration_min    int     DEFAULT 0,
  p_calories_burned numeric DEFAULT 0,
  p_distance_km     numeric DEFAULT 0,
  p_avg_speed       numeric DEFAULT 0,
  p_step_count      int     DEFAULT 0,
  p_integrity_score numeric DEFAULT 0,
  p_verified        boolean DEFAULT false,
  p_source          text    DEFAULT 'MANUAL'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO exercise_logs (
    user_id, date, name, duration_min,
    calories_burned, distance_km, avg_speed,
    step_count, integrity_score, verified, source
  ) VALUES (
    p_user_id, p_date, p_name, p_duration_min,
    p_calories_burned, p_distance_km, p_avg_speed,
    p_step_count, p_integrity_score, p_verified, p_source
  );
END;
$$;

-- ─── upsert_water_log ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION upsert_water_log(
  p_user_id uuid,
  p_date    text,
  p_litres  numeric DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO water_logs (user_id, date, litres)
  VALUES (p_user_id, p_date, p_litres)
  ON CONFLICT (user_id, date) DO UPDATE SET
    litres = EXCLUDED.litres;
END;
$$;

-- ─── insert_weight_log ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION insert_weight_log(
  p_user_id   uuid,
  p_date      text,
  p_weight_kg numeric DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO weight_logs (user_id, date, weight_kg)
  VALUES (p_user_id, p_date, p_weight_kg)
  ON CONFLICT (user_id, date) DO UPDATE SET
    weight_kg = EXCLUDED.weight_kg;
END;
$$;


/* ===== 20260518201116_fix_rpc_security.sql ===== */
/*
  # Fix RPC function security issues

  ## Changes
  1. Recreate delete_user with SET search_path = public (fixes mutable search path)
  2. Revoke EXECUTE from anon role on all SECURITY DEFINER RPC functions:
     - delete_user
     - insert_food_log
     - insert_sleep_log
     - insert_exercise_log
     - upsert_water_log
     - insert_weight_log
     - update_profile

  ## Security notes
  - anon (unauthenticated) users should never be able to call these functions
  - authenticated users retain EXECUTE — these functions are intentionally for logged-in users
  - delete_user now has a fixed search_path to prevent search_path injection
*/

-- Fix delete_user: add SET search_path = public
CREATE OR REPLACE FUNCTION delete_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

-- Revoke anon EXECUTE from all SECURITY DEFINER RPC functions
REVOKE EXECUTE ON FUNCTION delete_user() FROM anon;
REVOKE EXECUTE ON FUNCTION insert_food_log(uuid, text, text, text, numeric, numeric, numeric, numeric, numeric, text) FROM anon;
REVOKE EXECUTE ON FUNCTION insert_sleep_log(uuid, text, text, text, numeric, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION insert_exercise_log(uuid, text, text, int, numeric, numeric, numeric, int, numeric, boolean, text) FROM anon;
REVOKE EXECUTE ON FUNCTION upsert_water_log(uuid, text, numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION insert_weight_log(uuid, text, numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION update_profile(uuid, text, int, text, numeric, numeric, numeric, text, text, int, int, int, int) FROM anon;


/* ===== 20260518211538_create_subscriptions_table.sql ===== */
/*
  # Create subscriptions table

  ## Purpose
  Stores Pesapal payment subscription records for GoFit users.

  ## New Tables
  - `subscriptions`
    - `id` (uuid, primary key)
    - `user_id` (uuid, FK → profiles.id, not null)
    - `email` (text, not null)
    - `plan` (text: 'monthly' | 'annual')
    - `currency` (text: 'USD' | 'UGX' | 'KES')
    - `amount` (numeric, amount charged)
    - `status` (text: 'pending' | 'active' | 'cancelled' | 'failed')
    - `pesapal_order_id` (text, the Pesapal merchant reference)
    - `pesapal_tracking_id` (text, returned by Pesapal after payment)
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ## Security
  - RLS enabled
  - Users can insert and read their own subscription rows
  - Users can update their own subscription rows (for status checks)
  - Service role (used by Edge Functions) can manage all rows
*/

CREATE TABLE IF NOT EXISTS subscriptions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  email                text NOT NULL DEFAULT '',
  plan                 text NOT NULL DEFAULT 'monthly',
  currency             text NOT NULL DEFAULT 'USD',
  amount               numeric NOT NULL DEFAULT 0,
  status               text NOT NULL DEFAULT 'pending',
  pesapal_order_id     text NOT NULL DEFAULT '',
  pesapal_tracking_id  text NOT NULL DEFAULT '',
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS subscriptions_pesapal_order_id_idx ON subscriptions(pesapal_order_id);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own subscriptions"
  ON subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own subscriptions"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions"
  ON subscriptions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


/* ===== 20260525173133_create_squad_tables.sql ===== */
/*
  # Create Squad / Community Tables

  1. New Tables
    - `squad_feed`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users – nullable so coach posts don't break)
      - `user_name` (text)
      - `user_initials` (text)
      - `is_coach` (boolean, default false)
      - `is_pinned` (boolean, default false)
      - `type` (text – workout | meal | challenge | water | streak | weight | announcement | custom)
      - `emoji` (text)
      - `content` (text)
      - `workout_data` (jsonb – optional stats snapshot)
      - `likes` (integer, default 0)
      - `liked_by` (uuid[], default '{}')
      - `comments` (integer, default 0)
      - `created_at` (timestamptz, default now())

    - `squad_comments`
      - `id` (uuid, primary key)
      - `post_id` (uuid, references squad_feed)
      - `user_id` (uuid, references auth.users – nullable)
      - `user_name` (text)
      - `user_initials` (text)
      - `is_coach` (boolean, default false)
      - `content` (text)
      - `created_at` (timestamptz, default now())

    - `challenge_participants`
      - `id` (uuid, primary key)
      - `challenge_id` (text – matches PRESET_CHALLENGES id e.g. "ch001")
      - `user_id` (uuid, references auth.users)
      - `progress` (numeric, default 0)
      - `is_active` (boolean, default true)
      - `completed_at` (timestamptz – nullable)
      - `created_at` (timestamptz, default now())
      - UNIQUE (challenge_id, user_id)

  2. Security
    - RLS enabled on all tables
    - squad_feed: authenticated users can read all, insert own rows; coach can update (pin/delete)
    - squad_comments: authenticated users can read all, insert own rows
    - challenge_participants: users can read/insert/update own rows; coaches can read all

  3. Notes
    - liked_by is a uuid array for O(1) membership checks on small arrays
    - challenge_participants uses upsert-friendly unique constraint
*/

-- ─── squad_feed ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS squad_feed (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        REFERENCES auth.users ON DELETE SET NULL,
  user_name     text        NOT NULL DEFAULT '',
  user_initials text        NOT NULL DEFAULT '',
  is_coach      boolean     NOT NULL DEFAULT false,
  is_pinned     boolean     NOT NULL DEFAULT false,
  type          text        NOT NULL DEFAULT 'custom',
  emoji         text        NOT NULL DEFAULT '✨',
  content       text        NOT NULL DEFAULT '',
  workout_data  jsonb,
  likes         integer     NOT NULL DEFAULT 0,
  liked_by      uuid[]      NOT NULL DEFAULT '{}',
  comments      integer     NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE squad_feed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read squad_feed"
  ON squad_feed FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert own squad_feed posts"
  ON squad_feed FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update own squad_feed posts"
  ON squad_feed FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- ─── squad_comments ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS squad_comments (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id       uuid        NOT NULL REFERENCES squad_feed ON DELETE CASCADE,
  user_id       uuid        REFERENCES auth.users ON DELETE SET NULL,
  user_name     text        NOT NULL DEFAULT '',
  user_initials text        NOT NULL DEFAULT '',
  is_coach      boolean     NOT NULL DEFAULT false,
  content       text        NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE squad_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read squad_comments"
  ON squad_comments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert own squad_comments"
  ON squad_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- ─── challenge_participants ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS challenge_participants (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id   text        NOT NULL,
  user_id        uuid        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  progress       numeric     NOT NULL DEFAULT 0,
  is_active      boolean     NOT NULL DEFAULT true,
  completed_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, user_id)
);

ALTER TABLE challenge_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own challenge_participants"
  ON challenge_participants FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own challenge_participants"
  ON challenge_participants FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own challenge_participants"
  ON challenge_participants FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


/* ===== 20260525180331_fix_squad_feed_rls.sql ===== */
/*
  # Fix squad_feed RLS policies

  ## Changes
  1. Drop all existing squad_feed RLS policies
  2. Re-create permissive policies:
     - SELECT: any authenticated user can read all posts
     - INSERT: authenticated users can insert their own posts (user_id = auth.uid() OR user_id IS NULL for system posts)
     - UPDATE: users can update their own posts; coaches can update any post
     - DELETE: users can delete their own posts; coach emails can delete any post

  ## Notes
  - Coach emails: gofit.fitnessapp@gmail.com and arintina77@gmail.com
  - Also adds `edited` boolean and `edited_at` timestamptz columns for edit tracking
*/

-- Add edit tracking columns if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'squad_feed' AND column_name = 'edited'
  ) THEN
    ALTER TABLE squad_feed ADD COLUMN edited boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'squad_feed' AND column_name = 'edited_at'
  ) THEN
    ALTER TABLE squad_feed ADD COLUMN edited_at timestamptz;
  END IF;
END $$;

-- Drop all existing policies on squad_feed
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE tablename = 'squad_feed'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON squad_feed', pol.policyname);
  END LOOP;
END $$;

-- Enable RLS (ensure it is on)
ALTER TABLE squad_feed ENABLE ROW LEVEL SECURITY;

-- SELECT: all authenticated users can read all posts
CREATE POLICY "Authenticated users can read all squad posts"
  ON squad_feed FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: users can insert posts where user_id matches their uid, or user_id is null (system posts)
CREATE POLICY "Users can insert own squad posts"
  ON squad_feed FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- UPDATE: users update own posts; coaches can update any
CREATE POLICY "Users can update own posts or coaches update any"
  ON squad_feed FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR (SELECT email FROM auth.users WHERE id = auth.uid()) IN (
      'gofit.fitnessapp@gmail.com',
      'arintina77@gmail.com'
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    OR (SELECT email FROM auth.users WHERE id = auth.uid()) IN (
      'gofit.fitnessapp@gmail.com',
      'arintina77@gmail.com'
    )
  );

-- DELETE: users delete own posts; coaches delete any
CREATE POLICY "Users can delete own posts or coaches delete any"
  ON squad_feed FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR (SELECT email FROM auth.users WHERE id = auth.uid()) IN (
      'gofit.fitnessapp@gmail.com',
      'arintina77@gmail.com'
    )
  );


/* ===== 20260607155145_add_start_date_to_subscriptions.sql ===== */
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS start_date timestamptz;

/* ===== 20260607155515_add_paid_at_next_billing_date_to_subscriptions.sql ===== */
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS paid_at timestamptz;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS next_billing_date timestamptz;

/* ===== 20260613140107_add_new_profile_columns.sql ===== */
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS weight_kg numeric,
  ADD COLUMN IF NOT EXISTS goal_weight numeric,
  ADD COLUMN IF NOT EXISTS activity text,
  ADD COLUMN IF NOT EXISTS subscription text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS onboarded boolean NOT NULL DEFAULT false;


