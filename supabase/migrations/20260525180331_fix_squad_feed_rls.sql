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
