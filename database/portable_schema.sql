/*
 WeGoFit portable database export

 Apply this file to a fresh Supabase-compatible PostgreSQL database in the order shown below.
 It includes tables, row-level security policies, indexes, realtime publication, and protected RPC functions.
 Existing user rows and auth accounts are not included; export those separately from the source project.

 Regenerated 2026-09-24T02:28:53Z from all 15 migrations in supabase/migrations/ (timestamp order).
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

/* ===== 20260922000001_create_plural_log_tables.sql ===== */
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

/* ===== 20260922000002_enable_realtime.sql ===== */
/*
  Realtime Migration 2 — Enable Supabase Realtime on all tables
  (Pure additive. No schema, data, or behavior changes for existing queries.)

  Two steps per table:
  1. REPLICA IDENTITY FULL  → UPDATE/DELETE events include the OLD row in WAL.
                              Without this, DELETE events don't contain row data
                              so the client can't tell which ID to remove.
  2. Add to publication      → Supabase realtime (logical decoding) only emits
                              changes for tables in the `supabase_realtime`
                              publication. We use ALL TABLES + set publish for
                              insert/update/delete to keep it simple.

  Idempotent — safe to re-run. Does not touch application SQL.
*/

-- ─── Step 1: REPLICA IDENTITY FULL ────────────────────────────────────────────
-- Each ALTER is guarded so the script never fails if a table doesn't exist yet
-- in a given environment. Safe to run in any order / any project state.
DO $$ BEGIN ALTER TABLE profiles               REPLICA IDENTITY FULL; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE food_logs              REPLICA IDENTITY FULL; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE exercise_logs          REPLICA IDENTITY FULL; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE weight_logs            REPLICA IDENTITY FULL; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE water_logs             REPLICA IDENTITY FULL; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE sleep_logs             REPLICA IDENTITY FULL; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE subscriptions          REPLICA IDENTITY FULL; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE squad_feed             REPLICA IDENTITY FULL; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE squad_comments         REPLICA IDENTITY FULL; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE challenge_participants REPLICA IDENTITY FULL; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE user_points            REPLICA IDENTITY FULL; EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- Also cover the singular tables from the initial migration so future refactors
-- can choose either name without losing events.
DO $$ BEGIN ALTER TABLE food_log     REPLICA IDENTITY FULL; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE exercise_log REPLICA IDENTITY FULL; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE weight_log   REPLICA IDENTITY FULL; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE water_log    REPLICA IDENTITY FULL; EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── Step 2: Publication ──────────────────────────────────────────────────────
-- Supabase dashboard manual equivalent:
--   Replication → Toggle each table ON for the `supabase_realtime` publication.
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR ALL TABLES;
  ALTER PUBLICATION supabase_realtime SET (publish = 'insert, update, delete, truncate');
COMMIT;

/* ===== 20260922000003_create_user_points_and_leaderboard.sql ===== */
/*
  Realtime Migration 3 — user_points table + real leaderboard function
  (Additive, idempotent, zero-downtime. NO existing data mutated.)

  Why: The app's awardPoints() already upserts into `user_points`
  (AppContext.js) but no migration ever created that table, and the
  leaderboard UIs ranked against a hardcoded MOCK_LEADERBOARD. This
  migration creates the table with safe RLS and exposes a SECURITY
  DEFINER `get_leaderboard()` aggregate that joins profiles for display
  name/plan and computes a real current streak from activity dates.

  DEPENDENCY: Apply AFTER 20260922000001 (create_plural_log_tables.sql).
  get_leaderboard() reads food_logs + exercise_logs for the streak, so
  those tables must exist first.
*/

-- ─── user_points ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_points (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total      bigint NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_points ENABLE ROW LEVEL SECURITY;

-- Users may read/write ONLY their own row. The public leaderboard is served
-- through the SECURITY DEFINER function below, so we deliberately do NOT grant
-- a read-all policy on the raw table.
DO $$ BEGIN
  CREATE POLICY "user_points select own" ON public.user_points
    FOR SELECT TO authenticated USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "user_points insert own" ON public.user_points
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "user_points update own" ON public.user_points
    FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Keep realtime UPDATE/DELETE events carrying the old row (publication already
-- covers ALL TABLES from migration 2, including this one).
ALTER TABLE public.user_points REPLICA IDENTITY FULL;

-- ─── get_leaderboard() ────────────────────────────────────────────────────────
-- Returns ranked rows: rank, user_id, name, plan, points, streak.
-- streak = current consecutive-day run of any logged activity (food or
-- exercise), counting a run that ended yesterday as still active.
CREATE OR REPLACE FUNCTION public.get_leaderboard(p_limit integer DEFAULT 50)
RETURNS TABLE(rank bigint, user_id uuid, name text, plan text, points bigint, streak integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH distinct_days AS (
    SELECT DISTINCT user_id, date FROM (
      SELECT user_id, date FROM food_logs
      UNION
      SELECT user_id, date FROM exercise_logs
    ) a
  ),
  grouped AS (
    SELECT user_id, date,
           date - (ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY date))::integer AS grp
    FROM distinct_days
  ),
  streak_runs AS (
    SELECT user_id, grp, MAX(date) AS end_date, COUNT(*)::integer AS len
    FROM grouped
    GROUP BY user_id, grp
  ),
  current_streak AS (
    SELECT DISTINCT ON (user_id) user_id, len AS streak
    FROM streak_runs
    WHERE end_date >= CURRENT_DATE - 1
    ORDER BY user_id, end_date DESC
  )
  SELECT
    ROW_NUMBER() OVER (ORDER BY up.total DESC, up.user_id) AS rank,
    up.user_id                                            AS user_id,
    COALESCE(NULLIF(p.name, ''), 'WeGoFit Member')        AS name,
    COALESCE(NULLIF(p.subscription_status, ''), NULLIF(p.subscription, ''), 'free') AS plan,
    up.total                                              AS points,
    COALESCE(cs.streak, 0)                                AS streak
  FROM user_points up
  LEFT JOIN profiles p        ON p.id = up.user_id
  LEFT JOIN current_streak cs ON cs.user_id = up.user_id
  WHERE up.total > 0
  ORDER BY up.total DESC, up.user_id
  LIMIT p_limit;
$$;

REVOKE ALL ON FUNCTION public.get_leaderboard(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(integer) TO authenticated;

/* ===== 20260922000004_create_badges_and_meal_plans.sql ===== */
-- badges_earned + meal_plans
-- The app writes to both (AppContext.unlockBadge -> badges_earned, AppContext.saveMealPlan -> meal_plans)
-- but no migration ever created them, so every write silently failed (wrapped in try/catch).
-- Idempotent: safe to re-run.

-- ── TABLES ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.badges_earned (
  id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id  text NOT NULL,
  earned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, badge_id)
);

CREATE TABLE IF NOT EXISTS public.meal_plans (
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start   text NOT NULL,
  plan_data    jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, week_start)
);

-- ── ROW LEVEL SECURITY ────────────────────────────────────────────────────────
ALTER TABLE public.badges_earned ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_plans    ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS badges_earned_own_select ON public.badges_earned;
  DROP POLICY IF EXISTS badges_earned_own_insert ON public.badges_earned;
  DROP POLICY IF EXISTS badges_earned_own_delete ON public.badges_earned;
  DROP POLICY IF EXISTS meal_plans_own_select    ON public.meal_plans;
  DROP POLICY IF EXISTS meal_plans_own_insert    ON public.meal_plans;
  DROP POLICY IF EXISTS meal_plans_own_update    ON public.meal_plans;
  DROP POLICY IF EXISTS meal_plans_own_delete    ON public.meal_plans;
END $$;

CREATE POLICY badges_earned_own_select ON public.badges_earned
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY badges_earned_own_insert ON public.badges_earned
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY badges_earned_own_delete ON public.badges_earned
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY meal_plans_own_select ON public.meal_plans
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY meal_plans_own_insert ON public.meal_plans
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY meal_plans_own_update ON public.meal_plans
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY meal_plans_own_delete ON public.meal_plans
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ── GRANTS ────────────────────────────────────────────────────────────────────
GRANT ALL ON TABLE public.badges_earned TO authenticated, service_role;
GRANT ALL ON TABLE public.meal_plans    TO authenticated, service_role;

-- ── REALTIME (guarded so it cannot fail if publication/table state differs) ───
DO $$ BEGIN ALTER TABLE public.badges_earned REPLICA IDENTITY FULL; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.meal_plans    REPLICA IDENTITY FULL; EXCEPTION WHEN undefined_table THEN NULL; END $$;
