-- Add Phase 6 columns to projects table
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Expand status check to include Phase 6 processing stages
ALTER TABLE projects
  DROP CONSTRAINT IF EXISTS projects_status_check;

ALTER TABLE projects
  ADD CONSTRAINT projects_status_check CHECK (
    status = ANY (ARRAY[
      'pending',
      'uploading',
      'processing',
      'extracting_audio',
      'transcribing',
      'generating_highlights',
      'completed',
      'failed'
    ])
  );
