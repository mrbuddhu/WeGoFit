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
