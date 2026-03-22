CREATE TABLE IF NOT EXISTS clips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  title TEXT,
  start_sec NUMERIC(10,3) NOT NULL,
  end_sec NUMERIC(10,3) NOT NULL,
  duration_sec NUMERIC(10,3) GENERATED ALWAYS AS (end_sec - start_sec) STORED,
  score INTEGER DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  score_reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'exporting', 'exported')),
  caption_style TEXT DEFAULT 'hormozi',
  aspect_ratio TEXT DEFAULT '9:16',
  export_url TEXT,
  hashtags TEXT[],
  clip_title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE clips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clips_owner" ON clips FOR ALL USING (
  project_id IN (
    SELECT p.id FROM projects p
    JOIN users u ON p.user_id = u.id
    WHERE u.clerk_id = current_setting('app.clerk_id', true)
  )
);

CREATE TRIGGER clips_updated_at BEFORE UPDATE ON clips FOR EACH ROW EXECUTE FUNCTION update_updated_at();
