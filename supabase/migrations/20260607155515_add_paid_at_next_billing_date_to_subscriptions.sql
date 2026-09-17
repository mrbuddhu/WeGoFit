ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS paid_at timestamptz;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS next_billing_date timestamptz;