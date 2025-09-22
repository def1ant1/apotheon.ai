-- Schema supporting the scheduled SEO monitoring Worker. Tables capture Core Web Vitals snapshots,
-- Search Console coverage summaries, and alert payloads that were dispatched to incident channels.

CREATE TABLE IF NOT EXISTS seo_monitor_core_web_vitals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  locale TEXT NOT NULL,
  metric TEXT NOT NULL,
  percentile INTEGER NOT NULL,
  value REAL NOT NULL,
  collected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS seo_monitor_search_console_coverage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  property TEXT NOT NULL,
  category TEXT NOT NULL,
  coverage_count INTEGER NOT NULL,
  collected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS seo_monitor_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alert_type TEXT NOT NULL,
  message TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_seo_monitor_core_web_vitals_locale ON seo_monitor_core_web_vitals (locale);
CREATE INDEX IF NOT EXISTS idx_seo_monitor_core_web_vitals_metric ON seo_monitor_core_web_vitals (metric);
CREATE INDEX IF NOT EXISTS idx_seo_monitor_search_console_property ON seo_monitor_search_console_coverage (property);
CREATE INDEX IF NOT EXISTS idx_seo_monitor_alerts_type ON seo_monitor_alerts (alert_type);
