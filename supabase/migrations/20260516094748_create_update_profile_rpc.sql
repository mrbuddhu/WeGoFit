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
