-- Initializes the audit table for the analytics proxy Worker. We intentionally
-- avoid storing raw payloads; only metadata necessary for rate-limit forensics
-- is captured. Rows inherit Cloudflare ray + geo info so the privacy team can
-- satisfy regulatory inquiries without exposing user-level data.
CREATE TABLE IF NOT EXISTS analytics_forwarding_audit (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  event TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  cf_ray TEXT,
  country TEXT NOT NULL,
  occurred_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_analytics_forwarding_audit_session
  ON analytics_forwarding_audit (session_id);

CREATE INDEX IF NOT EXISTS idx_analytics_forwarding_audit_created
  ON analytics_forwarding_audit (occurred_at);
