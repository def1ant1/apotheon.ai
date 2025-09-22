/// <reference types="@cloudflare/workers-types" />

import { SEO_MANIFEST, resolveDeploymentStage } from '../config/seo/manifest.mjs';

import type {
  D1Database,
  D1DatabaseSession,
  D1ExecResult,
  D1PreparedStatement,
  D1Result,
  D1SessionBookmark,
} from '@cloudflare/workers-types';

interface SeoMonitorEnv {
  SEO_MONITOR_DB: D1Database;
  SEO_MONITOR_ALERT_WEBHOOK?: string;
  SEO_MONITOR_CRUX_API_KEY?: string;
  SEO_MONITOR_CRUX_COLLECTION?: string;
  SEO_MONITOR_SEARCH_CONSOLE_TOKEN?: string;
  SEO_MONITOR_SEARCH_CONSOLE_SITE?: string;
  SEO_MONITOR_PROPERTY_STAGE?: string;
  SEO_MONITOR_LCP_THRESHOLD?: string;
  SEO_MONITOR_INP_THRESHOLD?: string;
  SEO_MONITOR_CLS_THRESHOLD?: string;
  SEO_MONITOR_COVERAGE_ERROR_THRESHOLD?: string;
  SEO_MONITOR_DRY_RUN?: string;
}

interface MonitorOptions {
  dryRun?: boolean;
  fetchImplementation?: typeof fetch;
  logger?: Pick<typeof console, 'info' | 'error' | 'warn'>;
}

interface CoreWebVitalMeasurement {
  metric: string;
  percentile: number;
  value: number;
}

interface SearchConsoleCoverageRow {
  category: string;
  count: number;
}

const DEFAULT_THRESHOLDS = {
  lcp: 2500,
  inp: 200,
  cls: 0.1,
  coverageErrors: 0,
};

interface NormalizedLocaleDefinition {
  code?: string;
  origin?: URL;
  pathPrefix?: string;
  hrefLang?: string;
  searchConsole?: Record<string, string>;
}

type StagePropertyMap = Record<string, string>;

const SITE_ORIGIN = resolveSiteOrigin();
const LOCALE_DEFINITIONS = normaliseLocaleDefinitions(SEO_MANIFEST.locales?.definitions);
const DEFAULT_LOCALE: string =
  typeof SEO_MANIFEST.locales?.default === 'string' ? SEO_MANIFEST.locales.default : 'en-US';
const SEARCH_CONSOLE_STAGE_PROPERTIES = normaliseStageProperties(
  SEO_MANIFEST.searchConsole?.stages,
);

function resolveSiteOrigin(): URL {
  const siteCandidate = (SEO_MANIFEST as { site?: unknown }).site;
  const resolved = toUrl(siteCandidate);
  if (resolved) {
    return resolved;
  }
  return new URL('https://apotheon.ai');
}

function toUrl(candidate: unknown): URL | undefined {
  if (candidate instanceof URL) {
    return new URL(candidate.toString());
  }
  if (typeof candidate === 'string') {
    try {
      return new URL(candidate);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function normaliseStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') {
    return {};
  }
  const entries: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === 'string' && raw.length > 0) {
      entries[key] = raw;
    }
  }
  return entries;
}

function normaliseLocaleDefinition(value: unknown): NormalizedLocaleDefinition | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const normalized: NormalizedLocaleDefinition = {};

  if (typeof record.code === 'string' && record.code.length > 0) {
    normalized.code = record.code;
  }
  if (typeof record.pathPrefix === 'string' && record.pathPrefix.length > 0) {
    normalized.pathPrefix = record.pathPrefix;
  }
  if (typeof record.hrefLang === 'string' && record.hrefLang.length > 0) {
    normalized.hrefLang = record.hrefLang;
  }

  const origin = toUrl(record.origin);
  if (origin) {
    normalized.origin = origin;
  }

  const searchConsole = normaliseStringRecord(record.searchConsole);
  if (Object.keys(searchConsole).length > 0) {
    normalized.searchConsole = searchConsole;
  }

  return normalized;
}

function normaliseLocaleDefinitions(value: unknown): Record<string, NormalizedLocaleDefinition> {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const entries: Record<string, NormalizedLocaleDefinition> = {};
  for (const [locale, definition] of Object.entries(value as Record<string, unknown>)) {
    const normalized = normaliseLocaleDefinition(definition);
    if (normalized) {
      entries[locale] = normalized;
    }
  }

  return entries;
}

function normaliseStageProperties(value: unknown): StagePropertyMap {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const entries: StagePropertyMap = {};
  for (const [stage, definition] of Object.entries(value as Record<string, unknown>)) {
    if (!definition || typeof definition !== 'object') {
      continue;
    }
    const propertyId = (definition as Record<string, unknown>).propertyId;
    if (typeof propertyId === 'string' && propertyId.length > 0) {
      entries[stage] = propertyId;
    }
  }
  return entries;
}

function resolveLocaleList(): string[] {
  const locales = Object.keys(LOCALE_DEFINITIONS);
  if (locales.length === 0) {
    return [DEFAULT_LOCALE];
  }
  if (!locales.includes(DEFAULT_LOCALE)) {
    locales.unshift(DEFAULT_LOCALE);
  }
  return locales;
}

function resolveLocaleOriginUrl(locale: string): URL {
  const definition = LOCALE_DEFINITIONS[locale];
  if (definition?.origin) {
    return new URL(definition.origin.toString());
  }
  return new URL(SITE_ORIGIN.toString());
}

function selectSearchConsoleStage(env: SeoMonitorEnv): string {
  if (env.SEO_MONITOR_PROPERTY_STAGE) {
    return env.SEO_MONITOR_PROPERTY_STAGE;
  }
  const stage = resolveDeploymentStage(env as unknown as Record<string, string>);
  if (stage === 'production') {
    return 'production';
  }
  return 'preview';
}

function resolveSearchConsoleProperty(
  locale: string,
  stage: string,
  env: SeoMonitorEnv,
): string | undefined {
  const definition = LOCALE_DEFINITIONS[locale];
  const localeProperties = definition?.searchConsole ?? {};
  const localeStageProperty = localeProperties[stage];
  if (localeStageProperty) {
    return localeStageProperty;
  }
  if (env.SEO_MONITOR_SEARCH_CONSOLE_SITE) {
    return env.SEO_MONITOR_SEARCH_CONSOLE_SITE;
  }
  const globalStageProperty = SEARCH_CONSOLE_STAGE_PROPERTIES[stage];
  if (globalStageProperty) {
    return globalStageProperty;
  }
  return SEARCH_CONSOLE_STAGE_PROPERTIES.production;
}

function parseThresholds(env: SeoMonitorEnv) {
  const resolveNumeric = (value: string | undefined, fallback: number): number => {
    if (!value) {
      return fallback;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  return {
    lcp: resolveNumeric(env.SEO_MONITOR_LCP_THRESHOLD, DEFAULT_THRESHOLDS.lcp),
    inp: resolveNumeric(env.SEO_MONITOR_INP_THRESHOLD, DEFAULT_THRESHOLDS.inp),
    cls: resolveNumeric(env.SEO_MONITOR_CLS_THRESHOLD, DEFAULT_THRESHOLDS.cls),
    coverageErrors: resolveNumeric(
      env.SEO_MONITOR_COVERAGE_ERROR_THRESHOLD,
      DEFAULT_THRESHOLDS.coverageErrors,
    ),
  };
}

async function fetchCoreWebVitals(
  locale: string,
  env: SeoMonitorEnv,
  fetchImpl: typeof fetch,
  logger: Pick<typeof console, 'info' | 'error' | 'warn'>,
): Promise<CoreWebVitalMeasurement[]> {
  if (!env.SEO_MONITOR_CRUX_API_KEY) {
    logger.warn(
      '[seo-monitor] Skipping Core Web Vitals collection because SEO_MONITOR_CRUX_API_KEY is not configured.',
    );
    return [];
  }

  const origin = resolveLocaleOriginUrl(locale).toString();
  const collectionId = env.SEO_MONITOR_CRUX_COLLECTION ?? 'ALL_FORM_FACTORS';

  const response = await fetchImpl(
    `https://chromeuxreport.googleapis.com/v1/records:queryRecord?key=${encodeURIComponent(env.SEO_MONITOR_CRUX_API_KEY)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origin,
        formFactor: collectionId,
        metrics: [
          'largest_contentful_paint',
          'interaction_to_next_paint',
          'cumulative_layout_shift',
        ],
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `CrUX API request failed for ${origin}: ${response.status} ${response.statusText} ${text}`,
    );
  }

  const payload: unknown = await response.json();
  if (!payload || typeof payload !== 'object') {
    return [];
  }
  const record = (payload as Record<string, unknown>).record;
  if (!record || typeof record !== 'object') {
    return [];
  }
  const metricsNode = (record as Record<string, unknown>).metrics;
  if (!metricsNode || typeof metricsNode !== 'object') {
    return [];
  }

  const metrics: CoreWebVitalMeasurement[] = [];
  for (const [metric, details] of Object.entries(metricsNode)) {
    if (!details || typeof details !== 'object') continue;
    const percentiles = (details as Record<string, unknown>).percentiles;
    if (!percentiles || typeof percentiles !== 'object') continue;
    const p75 = (percentiles as Record<string, unknown>).p75;
    const p50 = (percentiles as Record<string, unknown>).p50;
    const rawValue = typeof p75 !== 'undefined' ? p75 : p50;
    const numericValue = typeof rawValue === 'number' ? rawValue : Number(rawValue);
    if (!Number.isFinite(numericValue)) continue;

    const percentile = typeof p75 !== 'undefined' ? 75 : 50;
    metrics.push({ metric, percentile, value: Number(numericValue) });
  }

  return metrics;
}

async function fetchSearchConsoleCoverage(
  propertyId: string | undefined,
  env: SeoMonitorEnv,
  fetchImpl: typeof fetch,
  logger: Pick<typeof console, 'info' | 'error' | 'warn'>,
): Promise<SearchConsoleCoverageRow[]> {
  if (!propertyId) {
    logger.warn(
      '[seo-monitor] Skipping Search Console coverage fetch because no property ID was resolved.',
    );
    return [];
  }
  if (!env.SEO_MONITOR_SEARCH_CONSOLE_TOKEN) {
    logger.warn(
      '[seo-monitor] Skipping Search Console coverage fetch because SEO_MONITOR_SEARCH_CONSOLE_TOKEN is not configured.',
    );
    return [];
  }

  const endpoint = `https://searchconsole.googleapis.com/v1/sites/${encodeURIComponent(propertyId)}/coverageSummary`;
  const response = await fetchImpl(endpoint, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${env.SEO_MONITOR_SEARCH_CONSOLE_TOKEN}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Search Console coverage request failed for ${propertyId}: ${response.status} ${response.statusText} ${text}`,
    );
  }

  const payload: unknown = await response.json();
  if (!payload || typeof payload !== 'object') {
    return [];
  }
  const coverageNode =
    (payload as Record<string, unknown>).coverage ??
    (payload as Record<string, unknown>).coverageSummary ??
    [];
  const entries = Array.isArray(coverageNode) ? coverageNode : [];

  const rows: SearchConsoleCoverageRow[] = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue;
    const categoryCandidate =
      (entry as Record<string, unknown>).category ?? (entry as Record<string, unknown>).state;
    const category = typeof categoryCandidate === 'string' ? categoryCandidate : 'unknown';
    const countCandidate =
      (entry as Record<string, unknown>).count ?? (entry as Record<string, unknown>).value ?? 0;
    const count = typeof countCandidate === 'number' ? countCandidate : Number(countCandidate);
    rows.push({ category, count: Number.isFinite(count) ? count : 0 });
  }
  return rows;
}

async function persistCoreWebVitals(
  db: D1Database,
  locale: string,
  metrics: CoreWebVitalMeasurement[],
): Promise<void> {
  for (const metric of metrics) {
    await db
      .prepare(
        `INSERT INTO seo_monitor_core_web_vitals (locale, metric, percentile, value, collected_at)
         VALUES (?1, ?2, ?3, ?4, datetime('now'))`,
      )
      .bind(locale, metric.metric, metric.percentile, metric.value)
      .run();
  }
}

async function persistSearchConsoleCoverage(
  db: D1Database,
  propertyId: string,
  coverage: SearchConsoleCoverageRow[],
): Promise<void> {
  for (const row of coverage) {
    await db
      .prepare(
        `INSERT INTO seo_monitor_search_console_coverage (property, category, coverage_count, collected_at)
         VALUES (?1, ?2, ?3, datetime('now'))`,
      )
      .bind(propertyId, row.category, row.count)
      .run();
  }
}

async function recordAlert(
  db: D1Database,
  alertType: string,
  message: string,
  payload: unknown,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO seo_monitor_alerts (alert_type, message, payload, created_at)
       VALUES (?1, ?2, ?3, datetime('now'))`,
    )
    .bind(alertType, message, JSON.stringify(payload))
    .run();
}

async function sendAlert(
  env: SeoMonitorEnv,
  message: string,
  payload: unknown,
  fetchImpl: typeof fetch,
  logger: Pick<typeof console, 'info' | 'error' | 'warn'>,
  dryRun: boolean,
): Promise<void> {
  if (!env.SEO_MONITOR_ALERT_WEBHOOK) {
    logger.warn('[seo-monitor] Alert webhook not configured; logging alert only.');
    return;
  }
  if (dryRun) {
    logger.info(`[seo-monitor] Dry-run alert: ${message}`);
    return;
  }
  const response = await fetchImpl(env.SEO_MONITOR_ALERT_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: message, payload }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Failed to dispatch alert webhook: ${response.status} ${response.statusText} ${text}`,
    );
  }
}

export async function runSeoMonitor(
  env: SeoMonitorEnv,
  options: MonitorOptions = {},
): Promise<void> {
  const fetchImpl = options.fetchImplementation ?? fetch;
  const logger = options.logger ?? console;
  const dryRun = options.dryRun ?? env.SEO_MONITOR_DRY_RUN === 'true';
  const thresholds = parseThresholds(env);
  const locales = resolveLocaleList();
  const stage = selectSearchConsoleStage(env);

  logger.info(
    `[seo-monitor] Starting scheduled scan (dryRun=${dryRun}, locales=${locales.join(', ')}, stage=${stage}).`,
  );

  for (const locale of locales) {
    const propertyId = resolveSearchConsoleProperty(locale, stage, env);
    const [coreVitals, coverage] = await Promise.all([
      fetchCoreWebVitals(locale, env, fetchImpl, logger),
      fetchSearchConsoleCoverage(propertyId, env, fetchImpl, logger),
    ]);

    if (coreVitals.length > 0) {
      if (!dryRun) {
        await persistCoreWebVitals(env.SEO_MONITOR_DB, locale, coreVitals);
      }
      for (const metric of coreVitals) {
        if (metric.metric.includes('largest_contentful_paint') && metric.value > thresholds.lcp) {
          const message = `LCP regression detected for ${locale} (${metric.value}ms > ${thresholds.lcp}ms)`;
          logger.warn(`[seo-monitor] ${message}`);
          await recordAlert(env.SEO_MONITOR_DB, 'core_web_vitals', message, { locale, metric });
          await sendAlert(env, message, { locale, metric }, fetchImpl, logger, dryRun);
        }
        if (metric.metric.includes('interaction_to_next_paint') && metric.value > thresholds.inp) {
          const message = `INP regression detected for ${locale} (${metric.value}ms > ${thresholds.inp}ms)`;
          logger.warn(`[seo-monitor] ${message}`);
          await recordAlert(env.SEO_MONITOR_DB, 'core_web_vitals', message, { locale, metric });
          await sendAlert(env, message, { locale, metric }, fetchImpl, logger, dryRun);
        }
        if (metric.metric.includes('cumulative_layout_shift') && metric.value > thresholds.cls) {
          const message = `CLS regression detected for ${locale} (${metric.value} > ${thresholds.cls})`;
          logger.warn(`[seo-monitor] ${message}`);
          await recordAlert(env.SEO_MONITOR_DB, 'core_web_vitals', message, { locale, metric });
          await sendAlert(env, message, { locale, metric }, fetchImpl, logger, dryRun);
        }
      }
    }

    if (coverage.length > 0 && propertyId) {
      if (!dryRun) {
        await persistSearchConsoleCoverage(env.SEO_MONITOR_DB, propertyId, coverage);
      }
      const errorRow = coverage.find((row) => row.category.toLowerCase().includes('error'));
      if (errorRow && errorRow.count > thresholds.coverageErrors) {
        const message = `Search Console reports ${errorRow.count} error URLs for ${propertyId} (threshold ${thresholds.coverageErrors}).`;
        logger.warn(`[seo-monitor] ${message}`);
        await recordAlert(env.SEO_MONITOR_DB, 'search_console', message, { propertyId, errorRow });
        await sendAlert(env, message, { propertyId, errorRow }, fetchImpl, logger, dryRun);
      }
    }
  }
}

const scheduledHandler: ExportedHandler<SeoMonitorEnv> = {
  async scheduled(_event, env, ctx) {
    const execution = runSeoMonitor(env);
    ctx.waitUntil(execution);
    await execution;
  },
};

export default scheduledHandler;

class MemoryD1Statement implements D1PreparedStatement {
  constructor(
    private readonly sql: string,
    private readonly db: MemoryD1Database,
    private readonly params: unknown[] = [],
  ) {}

  bind(...values: unknown[]): D1PreparedStatement {
    return new MemoryD1Statement(this.sql, this.db, [...this.params, ...values]);
  }

  first<T = unknown>(colName: string): Promise<T | null>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  first<T = unknown>(_colNameOrOptions?: string | { columnNames: true }): Promise<T | null> {
    void _colNameOrOptions;
    return Promise.reject(new Error('Not implemented in MemoryD1Statement stub.'));
  }

  run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    this.db.executed.push({ sql: this.sql, params: this.params });
    const result: D1Result<T> = {
      success: true,
      results: [],
      meta: {
        duration: 0,
        size_after: 0,
        rows_read: 0,
        rows_written: 0,
        last_row_id: 0,
        changed_db: false,
        changes: 0,
      },
    };
    return Promise.resolve(result);
  }

  all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    return Promise.reject(new Error('Not implemented in MemoryD1Statement stub.'));
  }

  raw<T = unknown[]>(options: { columnNames: true }): Promise<[string[], ...T[]]>;
  raw<T = unknown[]>(options?: { columnNames?: false }): Promise<T[]>;
  raw<T = unknown[]>(_options?: { columnNames?: boolean }): Promise<T[] | [string[], ...T[]]> {
    void _options;
    return Promise.reject(new Error('Not implemented in MemoryD1Statement stub.'));
  }
}

class MemoryD1DatabaseSession implements D1DatabaseSession {
  constructor(private readonly db: MemoryD1Database) {}

  prepare(query: string): D1PreparedStatement {
    return this.db.prepare(query);
  }

  batch<T = unknown>(_statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    void _statements;
    return Promise.reject<D1Result<T>[]>(
      new Error('Not implemented in MemoryD1DatabaseSession stub.'),
    );
  }

  getBookmark(): D1SessionBookmark | null {
    return null;
  }
}

export class MemoryD1Database implements D1Database {
  public readonly executed: Array<{ sql: string; params: unknown[] }> = [];

  prepare(query: string): D1PreparedStatement {
    return new MemoryD1Statement(query, this);
  }

  batch<T = unknown>(_statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    void _statements;
    return Promise.reject<D1Result<T>[]>(new Error('Not implemented in MemoryD1Database stub.'));
  }

  dump(): Promise<ArrayBuffer> {
    return Promise.reject<ArrayBuffer>(new Error('Not implemented in MemoryD1Database stub.'));
  }

  exec(): Promise<D1ExecResult> {
    return Promise.resolve({ count: 0, duration: 0 });
  }

  withSession(_constraintOrBookmark?: unknown): D1DatabaseSession {
    void _constraintOrBookmark;
    return new MemoryD1DatabaseSession(this);
  }
}

if (import.meta.main) {
  const dryRun = process.argv.includes('--dry-run');
  const env: SeoMonitorEnv = {
    SEO_MONITOR_DB: new MemoryD1Database(),
    SEO_MONITOR_DRY_RUN: dryRun ? 'true' : 'false',
    SEO_MONITOR_SEARCH_CONSOLE_SITE: SEO_MANIFEST.searchConsole?.stages?.production?.propertyId,
  };

  runSeoMonitor(env, { dryRun, logger: console })
    .then(() => {
      console.info('[seo-monitor] Dry-run execution completed.');
    })
    .catch((error) => {
      console.error('[seo-monitor] Dry-run execution failed:', error);
      process.exitCode = 1;
    });
}
