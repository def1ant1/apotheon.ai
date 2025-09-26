CREATE TABLE IF NOT EXISTS synthetic_health_runs (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  check_name TEXT NOT NULL,
  status TEXT NOT NULL,
  latency_ms INTEGER NOT NULL,
  response_status INTEGER NOT NULL,
  audit_id TEXT,
  failure_reason TEXT,
  request_url TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS synthetic_health_runs_run_id_idx
  ON synthetic_health_runs (run_id, created_at DESC);

CREATE INDEX IF NOT EXISTS synthetic_health_runs_created_at_idx
  ON synthetic_health_runs (created_at DESC);
