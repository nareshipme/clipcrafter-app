-- Migration 006: stitched_exports table
-- Replaces single projects.stitch_url with a proper history table

CREATE TABLE IF NOT EXISTS stitched_exports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  clip_ids    TEXT[] NOT NULL,
  export_url  TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX stitched_exports_project_id_idx ON stitched_exports(project_id);

-- RLS: users can only see their own stitched exports
ALTER TABLE stitched_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own stitched exports"
  ON stitched_exports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = stitched_exports.project_id
        AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role full access to stitched_exports"
  ON stitched_exports FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
