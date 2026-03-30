-- Migration 009: add export settings columns to clips table
-- Stores the user's editor choices so re-exports use the same settings

ALTER TABLE clips
  ADD COLUMN IF NOT EXISTS caption_position TEXT DEFAULT 'bottom',
  ADD COLUMN IF NOT EXISTS caption_size     TEXT DEFAULT 'md',
  ADD COLUMN IF NOT EXISTS crop_mode        TEXT DEFAULT 'cover',
  ADD COLUMN IF NOT EXISTS crop_x           INTEGER DEFAULT 50,
  ADD COLUMN IF NOT EXISTS crop_y           INTEGER DEFAULT 50,
  ADD COLUMN IF NOT EXISTS crop_zoom        NUMERIC(4,2) DEFAULT 1.0;
