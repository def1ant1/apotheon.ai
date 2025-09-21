--
-- Centralized auditing table for inbound contact form submissions. Keeping the
-- schema here makes D1 migrations reproducible across environments and ensures
-- RevOps + Security teams can expand the log structure via pull requests.
--
CREATE TABLE IF NOT EXISTS contact_submissions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT NOT NULL,
  intent TEXT NOT NULL,
  message TEXT NOT NULL,
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
  source_url TEXT,
  utm TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_contact_submissions_created_at ON contact_submissions(created_at);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_domain ON contact_submissions(domain);
