-- Add trial_plan to track which plan a user trialled
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS trial_plan TEXT;
