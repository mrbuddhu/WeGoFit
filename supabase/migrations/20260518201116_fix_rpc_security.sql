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
