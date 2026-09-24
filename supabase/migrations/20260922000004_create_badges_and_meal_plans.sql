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
