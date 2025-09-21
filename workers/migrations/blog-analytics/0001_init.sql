--
-- Blog analytics schema centralizes editorial engagement telemetry so the BI team
-- can iterate without relying on ad-hoc exports. The D1 schema captures rollup
-- metrics per article, per customer domain, and per event type. Downstream
-- pipelines (nightly personalization and revenue attribution) read from these
-- tables, so keep column names stable and document any changes in
-- docs/dev/BLOG-ANALYTICS.md before shipping migrations.
--
CREATE TABLE IF NOT EXISTS blog_event_rollups (
  -- ISO-8601 calendar date (UTC) derived from the event timestamp. We aggregate
  -- at the day level to minimize write amplification while keeping marketing's
  -- cohort queries straightforward.
  event_date TEXT NOT NULL,
  -- Normalized article slug (Astro content collection slug). Always lowercase
  -- and hyphenated to align with static routes.
  article_slug TEXT NOT NULL,
  -- Event taxonomy currently allows "article_view", "interaction", and
  -- "conversion". Adding new values requires updating the Zod schema in
  -- workers/blog-analytics.ts and the docs/dev/BLOG-ANALYTICS.md taxonomy
  -- section.
  event_type TEXT NOT NULL,
  -- Domain derived from the visitor identity payload. We store the normalized
  -- domain to enable high-signal ABM reporting without exposing raw email
  -- addresses. Anonymous traffic is grouped under "unknown".
  domain TEXT NOT NULL,
  -- Classification emitted by analyzeDomain (allow/review/block). Retained for
  -- auditing and downstream segmentation.
  domain_classification TEXT NOT NULL,
  -- JSON payload produced by analyzeDomain.flags. Keeping the raw structure lets
  -- BI rerun fraud heuristics without reprocessing source events.
  domain_flags TEXT NOT NULL,
  -- Total number of events represented by the row.
  total_events INTEGER NOT NULL DEFAULT 0,
  -- Unique session approximations for the aggregation window. Workers sum the
  -- distinct session counts per batch; marketing understands the metric is an
  -- approximation and not a globally unique visitor count.
  unique_sessions INTEGER NOT NULL DEFAULT 0,
  -- Updated each time a row is touched so the purger job can evict stale
  -- rollups without scanning the entire table.
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (event_date, article_slug, event_type, domain)
);

CREATE INDEX IF NOT EXISTS idx_blog_event_rollups_article_event
  ON blog_event_rollups(article_slug, event_type);
CREATE INDEX IF NOT EXISTS idx_blog_event_rollups_domain
  ON blog_event_rollups(domain);

-- Raw payload storage gives security reviewers a trail to reconstruct incidents
-- without rehydrating from Cloudflare logs. Use sparingly and purge regularly.
CREATE TABLE IF NOT EXISTS blog_event_payloads (
  id TEXT PRIMARY KEY,
  raw_payload TEXT NOT NULL,
  ingested_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_blog_event_payloads_ingested
  ON blog_event_payloads(ingested_at);
