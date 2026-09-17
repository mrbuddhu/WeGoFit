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
