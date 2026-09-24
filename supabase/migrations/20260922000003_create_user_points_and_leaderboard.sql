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
