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
