--
-- Audit log capturing every whitepaper request served by the delivery Worker.
-- Each row provides lifecycle teams with the metadata needed to evaluate
-- eligibility, investigate abuse, and reconcile marketing automation records.
--
CREATE TABLE IF NOT EXISTS whitepaper_requests (
  id TEXT PRIMARY KEY,
  whitepaper_slug TEXT NOT NULL,
  whitepaper_title TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT NOT NULL,
  role TEXT NOT NULL,
  justification TEXT NOT NULL,
  domain TEXT NOT NULL,
  domain_classification TEXT NOT NULL,
  domain_flags TEXT NOT NULL,
  domain_rationale TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  turnstile_success INTEGER NOT NULL,
  turnstile_score REAL,
  turnstile_action TEXT,
  mx_records TEXT,
  marketing_opt_in INTEGER NOT NULL,
  signed_url_expires_at TEXT NOT NULL,
  asset_object_key TEXT NOT NULL,
  asset_checksum TEXT NOT NULL,
  asset_content_type TEXT NOT NULL,
  source_url TEXT,
  utm TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_whitepaper_requests_created_at ON whitepaper_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_whitepaper_requests_slug ON whitepaper_requests(whitepaper_slug);
CREATE INDEX IF NOT EXISTS idx_whitepaper_requests_domain ON whitepaper_requests(domain);
