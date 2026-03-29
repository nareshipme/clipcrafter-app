CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  stage TEXT NOT NULL,
  provider TEXT,
  status TEXT NOT NULL DEFAULT 'success',
  duration_ms INTEGER,
  input_tokens INTEGER,
  output_tokens INTEGER,
  audio_seconds INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_usage_logs_project_id_idx ON ai_usage_logs(project_id);
CREATE INDEX IF NOT EXISTS ai_usage_logs_created_at_idx ON ai_usage_logs(created_at);
CREATE INDEX IF NOT EXISTS ai_usage_logs_stage_idx ON ai_usage_logs(stage);
