-- Tracks rendered OpenGraph assets so platform ops can trace cache invalidations
-- and correlate Worker activity with downstream analytics.
CREATE TABLE IF NOT EXISTS og_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scope TEXT NOT NULL,
  slug TEXT NOT NULL,
  variant TEXT NOT NULL DEFAULT 'default',
  format TEXT NOT NULL,
  cache_key TEXT NOT NULL,
  signature TEXT NOT NULL,
  source_url TEXT,
  title TEXT NOT NULL,
  subtitle TEXT,
  theme TEXT NOT NULL DEFAULT 'dark',
  accent TEXT,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  checksum TEXT NOT NULL,
  rendered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL
  UNIQUE(scope, slug, variant, format)
);

CREATE INDEX IF NOT EXISTS idx_og_assets_scope_slug ON og_assets(scope, slug);
CREATE INDEX IF NOT EXISTS idx_og_assets_rendered_at ON og_assets(rendered_at DESC);
