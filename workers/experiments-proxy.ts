/// <reference types="@cloudflare/workers-types" />

/**
 * Experiments proxy Worker
 * ------------------------
 *
 * The Worker shields GrowthBook from direct browser traffic and gives us a
 * single integration point to layer caching, integrity verification, and
 * observability. CI triggers a refresh endpoint so definitions stay hot in KV
 * while the GET handler services SSR/React islands. When GrowthBook is
 * unreachable we intentionally downgrade to a baked-in safe snapshot rather than
 * surfacing stale data silently—flag regressions must fail loud so on-call teams
 * know the release guardrails reverted to control variants.
 */
import { toBase64Url } from './shared/base64';

import type { FeatureDefinitions } from '@growthbook/growthbook';

type FetchImplementation = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type ExperimentSource = 'origin' | 'cache' | 'fallback';

type CacheMetadata = {
  hash: string;
  updatedAt: string;
};

interface CacheEntry {
  value: string;
  metadata: CacheMetadata;
}

export interface ExperimentsProxyEnv {
  EXPERIMENTS_CACHE: KVNamespace;
  GROWTHBOOK_FEATURES_ENDPOINT: string;
  GROWTHBOOK_CLIENT_KEY: string;
  EXPERIMENTS_REFRESH_TOKEN?: string;
  EXPERIMENTS_CACHE_KEY?: string;
  EXPERIMENTS_CACHE_TTL_SECONDS?: string;
  GROWTHBOOK_BEARER_TOKEN?: string;
}

type GrowthBookResponse = {
  status?: number;
  features?: FeatureDefinitions;
  dateUpdated?: string;
};

interface SnapshotPayload {
  features: FeatureDefinitions;
  fetchedAt: string;
  metadata: {
    upstreamStatus?: number;
    dateUpdated?: string;
  };
}

interface SnapshotResponse extends SnapshotPayload {
  source: ExperimentSource;
  hash: string;
}

const SAFE_SNAPSHOT: SnapshotResponse = {
  features: {},
  fetchedAt: new Date(0).toISOString(),
  metadata: {},
  source: 'fallback',
  hash: 'sha256:fallback-empty',
};

const DEFAULT_CACHE_KEY = 'growthbook:definitions';
const DEFAULT_TTL_SECONDS = 900; // 15 minutes keeps CI refresh intervals light.

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

function buildFeaturesUrl(env: ExperimentsProxyEnv): URL {
  const base = env.GROWTHBOOK_FEATURES_ENDPOINT;
  if (!base) {
    throw new HttpError(500, 'Missing GrowthBook endpoint configuration.');
  }
  const root = new URL(base);
  const path = root.pathname.replace(/\/$/u, '');
  root.pathname = `${path}/api/features/${env.GROWTHBOOK_CLIENT_KEY}`;
  return root;
}

function isGrowthBookResponse(payload: unknown): payload is GrowthBookResponse {
  return typeof payload === 'object' && payload !== null;
}

async function computeHash(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return `sha256:${toBase64Url(digest)}`;
}

async function fetchFromGrowthBook(
  env: ExperimentsProxyEnv,
  fetchImpl: FetchImplementation,
): Promise<SnapshotPayload> {
  const url = buildFeaturesUrl(env);
  const headers: HeadersInit = { Accept: 'application/json' };
  if (env.GROWTHBOOK_BEARER_TOKEN) {
    headers.Authorization = `Bearer ${env.GROWTHBOOK_BEARER_TOKEN}`;
  }
  const response = await fetchImpl(url, {
    headers,
  });
  if (!response.ok) {
    throw new HttpError(response.status, 'GrowthBook responded with a non-200 status.');
  }
  const json = await response.json();
  if (!isGrowthBookResponse(json)) {
    throw new HttpError(502, 'Unexpected GrowthBook payload.');
  }
  const features = json.features ?? {};
  const snapshot: SnapshotPayload = {
    features,
    fetchedAt: new Date().toISOString(),
    metadata: {
      upstreamStatus: json.status ?? response.status,
      dateUpdated: json.dateUpdated,
    },
  };
  return snapshot;
}

async function readCache(env: ExperimentsProxyEnv): Promise<CacheEntry | null> {
  const key = env.EXPERIMENTS_CACHE_KEY ?? DEFAULT_CACHE_KEY;
  const cached = await env.EXPERIMENTS_CACHE.getWithMetadata<CacheMetadata>(key, 'text');
  if (!cached || cached.value === null) {
    return null;
  }
  if (!cached.metadata || typeof cached.metadata.hash !== 'string') {
    return null;
  }
  return {
    value: cached.value,
    metadata: cached.metadata,
  };
}

async function storeCache(
  env: ExperimentsProxyEnv,
  payload: SnapshotPayload,
): Promise<SnapshotResponse> {
  const key = env.EXPERIMENTS_CACHE_KEY ?? DEFAULT_CACHE_KEY;
  const serialised = JSON.stringify(payload);
  const hash = await computeHash(serialised);
  const metadata: CacheMetadata = {
    hash,
    updatedAt: payload.fetchedAt,
  };
  const ttlSeconds = Number(env.EXPERIMENTS_CACHE_TTL_SECONDS ?? DEFAULT_TTL_SECONDS);
  await env.EXPERIMENTS_CACHE.put(key, serialised, {
    metadata,
    expirationTtl: Number.isFinite(ttlSeconds) ? ttlSeconds : DEFAULT_TTL_SECONDS,
  });
  return {
    ...payload,
    hash,
    source: 'origin',
  };
}

function isCacheStale(entry: CacheEntry, ttlSeconds: number): boolean {
  const updatedAt = Date.parse(entry.metadata.updatedAt);
  if (!Number.isFinite(updatedAt)) {
    return true;
  }
  const ageMs = Date.now() - updatedAt;
  return ageMs > ttlSeconds * 1000;
}

async function respondFromCache(entry: CacheEntry): Promise<SnapshotResponse> {
  const hash = await computeHash(entry.value);
  if (!timingSafeEqual(hash, entry.metadata.hash)) {
    throw new HttpError(412, 'Cached GrowthBook payload failed integrity validation.');
  }
  const payload = JSON.parse(entry.value) as SnapshotPayload;
  return {
    ...payload,
    hash,
    source: 'cache',
  };
}

async function loadSnapshot(
  env: ExperimentsProxyEnv,
  fetchImpl: FetchImplementation,
  forceRefresh: boolean,
): Promise<SnapshotResponse> {
  const ttlSeconds = Number(env.EXPERIMENTS_CACHE_TTL_SECONDS ?? DEFAULT_TTL_SECONDS);
  if (!forceRefresh) {
    const cached = await readCache(env);
    if (cached) {
      try {
        if (!isCacheStale(cached, ttlSeconds)) {
          return await respondFromCache(cached);
        }
        const refreshed = await fetchFromGrowthBook(env, fetchImpl);
        return await storeCache(env, refreshed);
      } catch (error) {
        console.warn(
          '[experiments-proxy] Cache retrieval failed, falling back to origin fetch:',
          error,
        );
      }
    }
  }

  try {
    const snapshot = await fetchFromGrowthBook(env, fetchImpl);
    return await storeCache(env, snapshot);
  } catch (error) {
    console.error('[experiments-proxy] GrowthBook fetch failed:', error);
    const cached = await readCache(env);
    if (cached) {
      try {
        return await respondFromCache(cached);
      } catch (integrityError) {
        console.error('[experiments-proxy] Cache integrity failure:', integrityError);
      }
    }
    return SAFE_SNAPSHOT;
  }
}

async function handleGet(
  request: Request,
  env: ExperimentsProxyEnv,
  fetchImpl: FetchImplementation,
): Promise<Response> {
  const url = new URL(request.url);
  const force = url.searchParams.get('force') === 'true';
  const snapshot = await loadSnapshot(env, fetchImpl, force);
  return Response.json(snapshot, {
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json',
    },
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  if (aBytes.length !== bBytes.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < aBytes.length; i += 1) {
    mismatch |= aBytes[i] ^ bBytes[i];
  }
  return mismatch === 0;
}

async function handleRefresh(
  request: Request,
  env: ExperimentsProxyEnv,
  fetchImpl: FetchImplementation,
): Promise<Response> {
  const token = env.EXPERIMENTS_REFRESH_TOKEN;
  if (!token) {
    throw new HttpError(501, 'Refresh secret not configured.');
  }
  const provided = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${token}`;
  if (!timingSafeEqual(provided, expected)) {
    throw new HttpError(401, 'Invalid refresh token.');
  }
  const snapshot = await loadSnapshot(env, fetchImpl, true);
  return Response.json(snapshot, {
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json',
    },
  });
}

function methodNotAllowed(): Response {
  return new Response('Method Not Allowed', {
    status: 405,
    headers: {
      Allow: 'GET, POST',
    },
  });
}

function handleError(error: unknown): Response {
  if (error instanceof HttpError) {
    return new Response(error.message, {
      status: error.status,
      headers: { 'cache-control': 'no-store' },
    });
  }
  console.error('[experiments-proxy] Unhandled exception:', error);
  return new Response('Internal Server Error', {
    status: 500,
    headers: { 'cache-control': 'no-store' },
  });
}

export default {
  async fetch(request: Request, env: ExperimentsProxyEnv): Promise<Response> {
    try {
      const fetchImpl = fetch.bind(globalThis);
      const url = new URL(request.url);
      if (request.method === 'GET' && url.pathname.endsWith('/v1/features')) {
        return await handleGet(request, env, fetchImpl);
      }
      if (request.method === 'POST' && url.pathname.endsWith('/v1/refresh')) {
        return await handleRefresh(request, env, fetchImpl);
      }
      return methodNotAllowed();
    } catch (error) {
      return handleError(error);
    }
  },
};

export const __internal = {
  buildFeaturesUrl,
  computeHash,
  fetchFromGrowthBook,
  loadSnapshot,
  SAFE_SNAPSHOT,
  readCache,
  storeCache,
  respondFromCache,
  timingSafeEqual,
};
