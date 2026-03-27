-- Add billing fields to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS billing_period_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS razorpay_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS razorpay_subscription_id TEXT;

-- Invite codes table
CREATE TABLE IF NOT EXISTS invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  created_by TEXT,
  redeemed_by TEXT,
  redeemed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alpha access on users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS alpha_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invite_code_used TEXT,
  ADD COLUMN IF NOT EXISTS daily_usage_seconds INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_usage_reset_at TIMESTAMPTZ;

ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;
