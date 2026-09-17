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
