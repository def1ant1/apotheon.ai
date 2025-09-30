import { trackAnalyticsEvent, type TrackResult } from '../analytics';

/**
 * Prefetch navigation telemetry
 * -----------------------------
 *
 * This module encapsulates the logic for measuring how speculative prefetching
 * improves time-to-first-byte (TTFB) across the application. The intent is to
 * collect anonymous, aggregate-only insights that quantify whether a given
 * route was served from a prefetch warm cache versus a cold navigation. Every
 * public method is heavily documented so platform engineers understand how the
 * automation works end-to-end before enabling additional sampling.
 */

/** Labels for the coarse-grained TTFB histogram. Keeping the buckets small in
 * number keeps payloads tiny while still giving us directional insight. */
export const TTFB_BUCKET_LABELS = [
  '0-100ms',
  '100-200ms',
  '200-400ms',
  '400-800ms',
  '800-1600ms',
  '1600ms+',
] as const;

export type TtfbBucketLabel = (typeof TTFB_BUCKET_LABELS)[number];

/**
 * Storage shim so we can inject deterministic fakes inside Vitest. We only need
 * the standard `Storage` trio of methods for our persistence contract.
 */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface NavigationTimingInput {
  name: string;
  startTime: number;
  responseStart: number;
  type?: PerformanceNavigationTiming['type'];
}

export interface PrefetchMetricsBuckets {
  visits: number;
  buckets: Record<TtfbBucketLabel, number>;
}

export interface PrefetchMetricsRouteAggregate {
  route: string;
  prefetched: PrefetchMetricsBuckets;
  nonPrefetched: PrefetchMetricsBuckets;
  firstRecordedAt: string;
  lastUpdatedAt: string;
}

export interface PrefetchMetricsPayload {
  version: 1;
  recordedAt: string;
  routes: Array<{
    route: string;
    prefetched: PrefetchMetricsBuckets;
    nonPrefetched: PrefetchMetricsBuckets;
  }>;
}

export interface PrefetchTelemetryController {
  markPrefetched(url: string): void;
  recordNavigationTiming(timing: NavigationTimingInput, context?: { prefetched?: boolean }): void;
  hasPendingSamples(): boolean;
  buildAnalyticsPayload(): PrefetchMetricsPayload | null;
  clearAggregates(): void;
  submitPending(send?: typeof trackAnalyticsEvent): Promise<TrackResult | null>;
  getAggregates(): PrefetchMetricsRouteAggregate[];
}

export interface PrefetchTelemetryOptions {
  localStorage?: StorageLike | null;
  sessionStorage?: StorageLike | null;
  now?: () => number;
  origin?: string;
  performance?: Performance | null;
  performanceObserver?: typeof PerformanceObserver;
  setupObserver?: boolean;
  maxRoutes?: number;
}

const TELEMETRY_STORAGE_KEY = 'apotheon.prefetch.telemetry.v1';
const PREFETCHED_ROUTES_KEY = 'apotheon.prefetch.routes.v1';
const PREFETCH_FLAG_TTL_MS = 15 * 60 * 1000; // 15 minutes gives us a reasonable freshness window.
const MAX_ROUTE_BUCKETS = 48; // Keeps storage bounded even on long browsing sessions.
const MAX_TRACKABLE_VISITS = 10_000; // Defensive upper bound to avoid ballooning payloads.
const MAX_BUCKET_SEGMENTS = 4; // We only preserve the first few path segments when anonymising routes.
const MAX_SEGMENT_LENGTH = 48;

interface PrefetchedRouteStore {
  [route: string]: number;
}

interface PrefetchAggregateStore {
  [route: string]: PrefetchMetricsRouteAggregate;
}

/**
 * Primary implementation that persists aggregate-only telemetry locally. The
 * controller favours explicit, readable code so compliance reviewers can audit
 * behaviour without reverse-engineering terse logic.
 */
export class PrefetchNavigationTelemetry implements PrefetchTelemetryController {
  private readonly localStorage: StorageLike | null;
  private readonly sessionStorage: StorageLike | null;
  private readonly now: () => number;
  private readonly origin: string;
  private readonly maxRoutes: number;
  private readonly prefetchedRoutes = new Map<string, number>();
  private aggregates: PrefetchAggregateStore = {};
  private observer: PerformanceObserver | null = null;

  constructor(options: PrefetchTelemetryOptions = {}) {
    this.localStorage = resolveStorage(options.localStorage, 'local');
    this.sessionStorage = resolveStorage(options.sessionStorage, 'session');
    this.now = options.now ?? (() => Date.now());
    this.origin = options.origin ?? inferOrigin();
    this.maxRoutes = options.maxRoutes ?? MAX_ROUTE_BUCKETS;

    this.restoreAggregatesFromDisk();
    this.restorePrefetchedRoutes();

    if (options.setupObserver !== false) {
      this.bootstrapPerformanceObserver(options.performance, options.performanceObserver);
    }
  }

  markPrefetched(url: string): void {
    const route = this.normaliseRoute(url);
    if (!route) return;

    const timestamp = this.now();
    this.prefetchedRoutes.set(route, timestamp);
    this.persistPrefetchedRoutes();
  }

  recordNavigationTiming(
    timing: NavigationTimingInput,
    context: { prefetched?: boolean } = {},
  ): void {
    const route = this.normaliseRoute(timing.name);
    if (!route) {
      return;
    }

    // Discard navigations that are not real forward navigations. We only care about
    // cold/prefetched transitions, not history traversals that would skew the data.
    if (timing.type && !['navigate', 'reload'].includes(timing.type)) {
      return;
    }

    const prefetched = context.prefetched ?? this.consumePrefetchedFlag(route);
    const ttfbMs = clampTtfb(timing.responseStart - timing.startTime);
    if (ttfbMs === null) {
      return;
    }

    const aggregate = this.ensureAggregate(route);
    const target = prefetched ? aggregate.prefetched : aggregate.nonPrefetched;
    const bucket = resolveBucket(ttfbMs);
    target.visits = clampVisitCount(target.visits + 1);
    target.buckets[bucket] = clampVisitCount(target.buckets[bucket] + 1);
    aggregate.lastUpdatedAt = new Date(this.now()).toISOString();

    this.aggregates[route] = aggregate;
    this.trimRouteLimit();
    this.persistAggregates();
  }

  hasPendingSamples(): boolean {
    return Object.values(this.aggregates).some(
      (aggregate) => aggregate.prefetched.visits > 0 || aggregate.nonPrefetched.visits > 0,
    );
  }

  buildAnalyticsPayload(): PrefetchMetricsPayload | null {
    const routes = Object.values(this.aggregates)
      .filter((aggregate) => aggregate.prefetched.visits + aggregate.nonPrefetched.visits > 0)
      .map((aggregate) => ({
        route: aggregate.route,
        prefetched: cloneMetricBuckets(aggregate.prefetched),
        nonPrefetched: cloneMetricBuckets(aggregate.nonPrefetched),
      }));

    if (routes.length === 0) {
      return null;
    }

    return {
      version: 1,
      recordedAt: new Date(this.now()).toISOString(),
      routes,
    };
  }

  clearAggregates(): void {
    this.aggregates = {};
    if (this.localStorage) {
      try {
        this.localStorage.removeItem(TELEMETRY_STORAGE_KEY);
      } catch {
        // Intentionally ignored; failure to clear storage should not break navigation.
      }
    }
  }

  async submitPending(
    send: typeof trackAnalyticsEvent = trackAnalyticsEvent,
  ): Promise<TrackResult | null> {
    const payload = this.buildAnalyticsPayload();
    if (!payload) {
      return null;
    }

    const result = await send({
      event: 'prefetch_navigation_metrics',
      payload: payload as unknown as Record<string, unknown>,
      transport: 'beacon',
    });

    if (result.delivered) {
      this.clearAggregates();
    }

    return result;
  }

  getAggregates(): PrefetchMetricsRouteAggregate[] {
    return Object.values(this.aggregates).map((aggregate) => ({
      route: aggregate.route,
      prefetched: cloneMetricBuckets(aggregate.prefetched),
      nonPrefetched: cloneMetricBuckets(aggregate.nonPrefetched),
      firstRecordedAt: aggregate.firstRecordedAt,
      lastUpdatedAt: aggregate.lastUpdatedAt,
    }));
  }

  private bootstrapPerformanceObserver(
    performanceInstance: Performance | null | undefined,
    observerCtor: typeof PerformanceObserver | undefined,
  ): void {
    if (!performanceInstance && typeof performance !== 'undefined') {
      performanceInstance = performance;
    }

    if (!observerCtor && typeof PerformanceObserver !== 'undefined') {
      observerCtor = PerformanceObserver;
    }

    if (!performanceInstance || !observerCtor) {
      return;
    }

    try {
      this.observer = new observerCtor((list) => {
        for (const entry of list.getEntries()) {
          if (!('responseStart' in entry) || !('startTime' in entry)) {
            continue;
          }
          const timing = entry as PerformanceNavigationTiming;
          this.recordNavigationTiming({
            name: timing.name,
            startTime: timing.startTime,
            responseStart: timing.responseStart,
            type: timing.type,
          });
        }
      });
      this.observer.observe({ type: 'navigation', buffered: true });
    } catch (error) {
      console.warn('[prefetch-telemetry] Failed to initialise PerformanceObserver', error);
    }
  }

  private ensureAggregate(route: string): PrefetchMetricsRouteAggregate {
    const existing = this.aggregates[route];
    if (existing) {
      return existing;
    }

    const nowIso = new Date(this.now()).toISOString();
    const aggregate: PrefetchMetricsRouteAggregate = {
      route,
      prefetched: createEmptyBuckets(),
      nonPrefetched: createEmptyBuckets(),
      firstRecordedAt: nowIso,
      lastUpdatedAt: nowIso,
    };
    this.aggregates[route] = aggregate;
    return aggregate;
  }

  private trimRouteLimit(): void {
    const routes = Object.values(this.aggregates);
    if (routes.length <= this.maxRoutes) {
      return;
    }

    routes
      .sort((a, b) => a.lastUpdatedAt.localeCompare(b.lastUpdatedAt))
      .slice(0, routes.length - this.maxRoutes)
      .forEach((stale) => {
        delete this.aggregates[stale.route];
      });
  }

  private persistAggregates(): void {
    if (!this.localStorage) {
      return;
    }

    try {
      const serialisable = Object.values(this.aggregates).map((aggregate) => ({
        route: aggregate.route,
        prefetched: aggregate.prefetched,
        nonPrefetched: aggregate.nonPrefetched,
        firstRecordedAt: aggregate.firstRecordedAt,
        lastUpdatedAt: aggregate.lastUpdatedAt,
      }));
      this.localStorage.setItem(TELEMETRY_STORAGE_KEY, JSON.stringify(serialisable));
    } catch (error) {
      console.warn('[prefetch-telemetry] Unable to persist aggregates', error);
    }
  }

  private persistPrefetchedRoutes(): void {
    if (!this.sessionStorage) {
      return;
    }

    const nowTs = this.now();
    const serialisable: PrefetchedRouteStore = {};
    for (const [route, timestamp] of this.prefetchedRoutes.entries()) {
      if (nowTs - timestamp > PREFETCH_FLAG_TTL_MS) {
        continue;
      }
      serialisable[route] = timestamp;
    }

    try {
      this.sessionStorage.setItem(PREFETCHED_ROUTES_KEY, JSON.stringify(serialisable));
    } catch (error) {
      console.warn('[prefetch-telemetry] Unable to persist prefetched routes', error);
    }
  }

  private restoreAggregatesFromDisk(): void {
    if (!this.localStorage) {
      return;
    }

    try {
      const raw = this.localStorage.getItem(TELEMETRY_STORAGE_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as PrefetchMetricsRouteAggregate[];
      if (!Array.isArray(parsed)) {
        this.localStorage.removeItem(TELEMETRY_STORAGE_KEY);
        return;
      }

      const hydrated: PrefetchAggregateStore = {};
      for (const entry of parsed) {
        if (!entry || typeof entry.route !== 'string') {
          continue;
        }
        hydrated[entry.route] = {
          route: entry.route,
          prefetched: normaliseBuckets(entry.prefetched),
          nonPrefetched: normaliseBuckets(entry.nonPrefetched),
          firstRecordedAt: entry.firstRecordedAt ?? new Date(this.now()).toISOString(),
          lastUpdatedAt: entry.lastUpdatedAt ?? new Date(this.now()).toISOString(),
        };
      }
      this.aggregates = hydrated;
    } catch (error) {
      console.warn('[prefetch-telemetry] Unable to restore aggregates, clearing storage', error);
      try {
        this.localStorage.removeItem(TELEMETRY_STORAGE_KEY);
      } catch {
        // ignored
      }
    }
  }

  private restorePrefetchedRoutes(): void {
    if (!this.sessionStorage) {
      return;
    }

    try {
      const raw = this.sessionStorage.getItem(PREFETCHED_ROUTES_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as PrefetchedRouteStore;
      if (!parsed || typeof parsed !== 'object') {
        this.sessionStorage.removeItem(PREFETCHED_ROUTES_KEY);
        return;
      }

      const nowTs = this.now();
      for (const [route, timestamp] of Object.entries(parsed)) {
        if (typeof timestamp !== 'number') {
          continue;
        }
        if (nowTs - timestamp > PREFETCH_FLAG_TTL_MS) {
          continue;
        }
        this.prefetchedRoutes.set(route, timestamp);
      }
    } catch (error) {
      console.warn('[prefetch-telemetry] Unable to restore prefetched route cache', error);
      try {
        this.sessionStorage.removeItem(PREFETCHED_ROUTES_KEY);
      } catch {
        // ignored
      }
    }
  }

  private consumePrefetchedFlag(route: string): boolean {
    const timestamp = this.prefetchedRoutes.get(route);
    const nowTs = this.now();
    const prefetched = Boolean(timestamp && nowTs - timestamp <= PREFETCH_FLAG_TTL_MS);
    if (timestamp) {
      this.prefetchedRoutes.delete(route);
      this.persistPrefetchedRoutes();
    }
    return prefetched;
  }

  private normaliseRoute(input: string): string | null {
    try {
      const url = new URL(input, this.origin);
      return anonymisePath(url.pathname);
    } catch {
      return null;
    }
  }
}

class NoopPrefetchTelemetry implements PrefetchTelemetryController {
  markPrefetched(): void {}
  recordNavigationTiming(): void {}
  hasPendingSamples(): boolean {
    return false;
  }
  buildAnalyticsPayload(): PrefetchMetricsPayload | null {
    return null;
  }
  clearAggregates(): void {}
  submitPending(): Promise<TrackResult | null> {
    return Promise.resolve(null);
  }
  getAggregates(): PrefetchMetricsRouteAggregate[] {
    return [];
  }
}

function resolveStorage(
  candidate: StorageLike | null | undefined,
  type: 'local' | 'session',
): StorageLike | null {
  if (candidate) {
    return candidate;
  }

  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const storage = type === 'local' ? window.localStorage : window.sessionStorage;
    const probeKey = `prefetch-telemetry-probe-${type}`;
    storage.setItem(probeKey, '1');
    storage.removeItem(probeKey);
    return storage;
  } catch {
    return null;
  }
}

function inferOrigin(): string {
  if (typeof window !== 'undefined' && window.location) {
    return window.location.origin;
  }
  return 'https://apotheon.ai';
}

function clampTtfb(value: number): number | null {
  if (!Number.isFinite(value)) {
    return null;
  }
  const rounded = Math.max(0, Math.min(20_000, Math.round(value)));
  if (rounded === 0) {
    return null;
  }
  return rounded;
}

function clampVisitCount(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(MAX_TRACKABLE_VISITS, Math.max(0, Math.round(value)));
}

function resolveBucket(ttfbMs: number): TtfbBucketLabel {
  if (ttfbMs < 100) return '0-100ms';
  if (ttfbMs < 200) return '100-200ms';
  if (ttfbMs < 400) return '200-400ms';
  if (ttfbMs < 800) return '400-800ms';
  if (ttfbMs < 1600) return '800-1600ms';
  return '1600ms+';
}

function createEmptyBuckets(): PrefetchMetricsBuckets {
  const buckets: Record<TtfbBucketLabel, number> = {
    '0-100ms': 0,
    '100-200ms': 0,
    '200-400ms': 0,
    '400-800ms': 0,
    '800-1600ms': 0,
    '1600ms+': 0,
  };
  return { visits: 0, buckets };
}

function cloneMetricBuckets(input: PrefetchMetricsBuckets): PrefetchMetricsBuckets {
  return {
    visits: input.visits,
    buckets: { ...input.buckets },
  };
}

function normaliseBuckets(input: PrefetchMetricsBuckets | undefined): PrefetchMetricsBuckets {
  if (!input) {
    return createEmptyBuckets();
  }

  const buckets: Record<TtfbBucketLabel, number> = {
    '0-100ms': clampVisitCount(input.buckets?.['0-100ms'] ?? 0),
    '100-200ms': clampVisitCount(input.buckets?.['100-200ms'] ?? 0),
    '200-400ms': clampVisitCount(input.buckets?.['200-400ms'] ?? 0),
    '400-800ms': clampVisitCount(input.buckets?.['400-800ms'] ?? 0),
    '800-1600ms': clampVisitCount(input.buckets?.['800-1600ms'] ?? 0),
    '1600ms+': clampVisitCount(input.buckets?.['1600ms+'] ?? 0),
  };
  const visits = clampVisitCount(
    input.visits ?? Object.values(buckets).reduce((sum, value) => sum + value, 0),
  );
  return { visits, buckets };
}

function anonymisePath(pathname: string): string {
  if (!pathname) {
    return '/';
  }

  const safePath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const segments = safePath
    .split('/')
    .slice(0, MAX_BUCKET_SEGMENTS + 1)
    .map((segment) => sanitiseSegment(segment))
    .filter((segment, index, array) => segment !== '' || index === 0 || index === array.length - 1);

  const normalised = segments.join('/');
  return normalised || '/';
}

function sanitiseSegment(segment: string): string {
  if (!segment) return '';
  let decoded = segment;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    decoded = segment;
  }

  decoded = decoded.trim();
  if (decoded.length === 0) {
    return '';
  }

  const lower = decoded.toLowerCase();
  if (/^\d+$/.test(lower)) {
    return ':int';
  }
  if (/^[0-9a-f]{8,}$/.test(lower.replace(/-/g, ''))) {
    return ':hash';
  }
  if (/^[-0-9a-z_]{16,}$/.test(lower)) {
    return decoded.slice(0, 16);
  }

  return decoded.slice(0, MAX_SEGMENT_LENGTH);
}

/**
 * Public singleton that consumers should use. It automatically falls back to a
 * noop implementation during SSR or if browser storage is unavailable.
 */
export const prefetchTelemetry: PrefetchTelemetryController = (() => {
  if (typeof window === 'undefined') {
    return new NoopPrefetchTelemetry();
  }
  try {
    return new PrefetchNavigationTelemetry();
  } catch (error) {
    console.warn('[prefetch-telemetry] Falling back to noop controller', error);
    return new NoopPrefetchTelemetry();
  }
})();

export function createPrefetchTelemetry(
  options?: PrefetchTelemetryOptions,
): PrefetchTelemetryController {
  if (typeof window === 'undefined') {
    if (!options) {
      return new NoopPrefetchTelemetry();
    }
    return new PrefetchNavigationTelemetry(options);
  }
  return new PrefetchNavigationTelemetry(options);
}

export const __internal = {
  anonymisePath,
  sanitiseSegment,
  clampTtfb,
  resolveBucket,
  createEmptyBuckets,
  normaliseBuckets,
};
