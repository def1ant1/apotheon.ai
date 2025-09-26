/**
 * Experiment evaluation utilities
 * -------------------------------
 *
 * GrowthBook powers progressive delivery for both the SSR pipeline and hydrated
 * islands. This module centralises how we fetch definitions from the
 * `experiments-proxy` Worker, evaluate feature gates, and expose ergonomic React
 * primitives. Keeping everything in one place reduces the risk of subtle drift
 * between server-rendered markup and hydrated DOM. The verbose comments double
 * as an on-call runbook—feature flag regressions frequently stem from cache
 * configuration or mismatched GrowthBook attributes, so we prefer to document
 * the reasoning inline.
 */
import { GrowthBook, type Attributes, type FeatureDefinitions } from '@growthbook/growthbook';
import { useEffect, useMemo, useState } from 'react';

type ExperimentSource = 'origin' | 'cache' | 'fallback';

type FeatureResultSource = ReturnType<GrowthBook['evalFeature']>['source'];

type FetchImplementation = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface ExperimentsSnapshot {
  /** Raw feature map surfaced by the proxy Worker. */
  readonly features: FeatureDefinitions;
  /** ISO timestamp of when the payload was generated. */
  readonly fetchedAt: string;
  /** SHA-256 digest returned by the Worker for integrity verification. */
  readonly hash: string;
  /** Where the data originated (fresh fetch, cache hit, or static fallback). */
  readonly source: ExperimentSource;
  /** Optional upstream metadata propagated for observability dashboards. */
  readonly metadata?: {
    readonly upstreamStatus?: number;
    readonly dateUpdated?: string;
  };
}

export interface GetExperimentsOptions {
  /**
   * Override the endpoint used to fetch feature definitions. Helpful in tests
   * or bespoke staging environments.
   */
  readonly endpoint?: string;
  /** Custom fetch implementation (Vitest + serverless stubs inject this). */
  readonly fetchImplementation?: FetchImplementation;
  /** Force a refetch even when an in-memory snapshot already exists. */
  readonly forceRefresh?: boolean;
}

export interface EvaluateFlagOptions<TValue> {
  /** The GrowthBook feature key. */
  readonly flag: string;
  /** Value returned when the feature is disabled or missing. */
  readonly fallback: TValue;
  /** GrowthBook attributes for audience targeting. */
  readonly attributes?: Attributes;
  /** Inject a pre-fetched snapshot to keep SSR + hydration in lockstep. */
  readonly snapshot?: ExperimentsSnapshot;
}

export interface EvaluateResult<TValue> {
  readonly value: TValue;
  readonly featureSource: FeatureResultSource | undefined;
  readonly snapshotSource: ExperimentSource;
  readonly hash: string;
}

export interface UseExperimentFlagOptions<TValue> extends EvaluateFlagOptions<TValue> {
  readonly endpoint?: string;
  readonly fetchImplementation?: FetchImplementation;
  /**
   * Default `useEffect` fetches whenever the cached snapshot comes from the
   * static fallback. Toggle this to opt into refetching even when we already
   * have cached data (rare, but useful for preview toggles in Playwright).
   */
  readonly refetchOnMount?: boolean;
}

export interface UseExperimentFlagResult<TValue> extends EvaluateResult<TValue> {
  readonly loading: boolean;
  readonly error?: string;
}

const GLOBAL_CACHE_KEY = '__APOTHEON_EXPERIMENTS_CACHE__';

const SAFE_SNAPSHOT: ExperimentsSnapshot = {
  features: {},
  fetchedAt: new Date(0).toISOString(),
  hash: 'sha256:fallback-empty',
  source: 'fallback',
  metadata: {
    upstreamStatus: undefined,
    dateUpdated: undefined,
  },
};

type CacheContainer = {
  snapshot: ExperimentsSnapshot;
  inFlight: Promise<ExperimentsSnapshot> | null;
};

type GlobalCache = typeof globalThis & { [GLOBAL_CACHE_KEY]?: CacheContainer };

function getCacheContainer(): CacheContainer {
  const global = globalThis as GlobalCache;
  const existing = global[GLOBAL_CACHE_KEY];
  if (existing) {
    return existing;
  }
  const created: CacheContainer = { snapshot: SAFE_SNAPSHOT, inFlight: null };
  global[GLOBAL_CACHE_KEY] = created;
  return created;
}

function isFeatureDefinitions(value: unknown): value is FeatureDefinitions {
  return typeof value === 'object' && value !== null;
}

function resolveEndpoint(explicit?: string): string {
  if (explicit) return explicit;
  const globalEndpoint = (
    globalThis as typeof globalThis & { __APOTHEON_EXPERIMENTS_ENDPOINT__?: string }
  ).__APOTHEON_EXPERIMENTS_ENDPOINT__;
  if (typeof globalEndpoint === 'string' && globalEndpoint.length > 0) {
    return globalEndpoint;
  }

  let importMetaEndpoint: string | undefined;
  if (typeof import.meta !== 'undefined') {
    const env = import.meta.env as Record<string, string | undefined>;
    importMetaEndpoint = env.PUBLIC_EXPERIMENTS_ENDPOINT ?? env.PUBLIC_EXPERIMENTS_PROXY_ENDPOINT;
  }
  if (importMetaEndpoint) return importMetaEndpoint;

  const processEnv =
    typeof process !== 'undefined'
      ? (process.env as Record<string, string | undefined>)
      : undefined;
  const processEndpoint =
    processEnv?.PUBLIC_EXPERIMENTS_ENDPOINT ?? processEnv?.EXPERIMENTS_ENDPOINT;
  if (processEndpoint) return processEndpoint;

  return 'https://experiments.apotheon.ai/v1/features';
}

function normaliseSnapshot(candidate: unknown): ExperimentsSnapshot {
  if (!candidate || typeof candidate !== 'object') {
    return SAFE_SNAPSHOT;
  }
  const payload = candidate as Partial<ExperimentsSnapshot> & { features?: unknown };
  const features = isFeatureDefinitions(payload.features) ? payload.features : {};
  return {
    features,
    fetchedAt: typeof payload.fetchedAt === 'string' ? payload.fetchedAt : new Date().toISOString(),
    hash: typeof payload.hash === 'string' ? payload.hash : 'sha256:unknown',
    source: payload.source === 'origin' || payload.source === 'cache' ? payload.source : 'fallback',
    metadata: payload.metadata,
  };
}

async function fetchSnapshotFromNetwork(
  options: GetExperimentsOptions,
): Promise<ExperimentsSnapshot> {
  const endpoint = resolveEndpoint(options.endpoint);
  const fetchImpl = options.fetchImplementation ?? fetch;
  const response = await fetchImpl(endpoint, {
    headers: {
      accept: 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error(`experiments endpoint returned ${response.status}`);
  }
  const body = await response.json();
  const snapshot = normaliseSnapshot(body);
  const cache = getCacheContainer();
  cache.snapshot = snapshot;
  return snapshot;
}

export async function getExperimentsSnapshot(
  options: GetExperimentsOptions = {},
): Promise<ExperimentsSnapshot> {
  const cache = getCacheContainer();
  if (!options.forceRefresh) {
    if (cache.snapshot && cache.snapshot !== SAFE_SNAPSHOT) {
      return cache.snapshot;
    }
    if (cache.inFlight) {
      return cache.inFlight;
    }
  }

  const inFlight = fetchSnapshotFromNetwork(options).catch((error) => {
    console.warn('[experiments] Failed to refresh snapshot:', error);
    cache.snapshot = cache.snapshot ?? SAFE_SNAPSHOT;
    return cache.snapshot;
  });
  cache.inFlight = inFlight;
  try {
    const resolved = await inFlight;
    return resolved;
  } finally {
    cache.inFlight = null;
  }
}

export function evaluateFlag<TValue>(options: EvaluateFlagOptions<TValue>): EvaluateResult<TValue> {
  const cache = getCacheContainer();
  const snapshot = options.snapshot ?? cache.snapshot ?? SAFE_SNAPSHOT;
  const growthbook = new GrowthBook({
    features: snapshot.features,
    attributes: options.attributes ?? {},
  });
  const result = growthbook.evalFeature(options.flag);
  if (typeof growthbook.destroy === 'function') {
    growthbook.destroy();
  }
  const value = (result.value ?? options.fallback) as TValue;
  return {
    value,
    featureSource: result.source,
    snapshotSource: snapshot.source,
    hash: snapshot.hash,
  };
}

export function useExperimentFlag<TValue>(
  options: UseExperimentFlagOptions<TValue>,
): UseExperimentFlagResult<TValue> {
  const cache = getCacheContainer();
  const [snapshot, setSnapshot] = useState<ExperimentsSnapshot>(
    options.snapshot ?? cache.snapshot ?? SAFE_SNAPSHOT,
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | undefined>();

  const evaluation = useMemo(
    () =>
      evaluateFlag({
        flag: options.flag,
        fallback: options.fallback,
        attributes: options.attributes,
        snapshot,
      }),
    [options.flag, options.fallback, options.attributes, snapshot],
  );

  useEffect(() => {
    if (options.snapshot && !options.refetchOnMount) {
      return;
    }
    const shouldRefetch = options.refetchOnMount || snapshot.source === 'fallback';
    if (!shouldRefetch) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    getExperimentsSnapshot({
      endpoint: options.endpoint,
      fetchImplementation: options.fetchImplementation,
      forceRefresh: true,
    })
      .then((fresh) => {
        if (!cancelled) {
          setSnapshot(fresh);
          setError(undefined);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.warn('[experiments] Failed to hydrate island snapshot:', err);
          setError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    options.endpoint,
    options.fetchImplementation,
    options.refetchOnMount,
    options.snapshot,
    snapshot.source,
  ]);

  return {
    ...evaluation,
    loading,
    error,
  };
}

export const __internal = {
  getCacheContainer,
  resolveEndpoint,
  normaliseSnapshot,
  SAFE_SNAPSHOT,
};
