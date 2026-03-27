-- Add stitch_url to projects for storing the latest stitched export URL
ALTER TABLE projects ADD COLUMN IF NOT EXISTS stitch_url TEXT;
