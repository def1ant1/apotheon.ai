import { describe, expect, it, vi } from 'vitest';

import worker, { __internal, type ExperimentsProxyEnv } from '../experiments-proxy';

function createKv(): KVNamespace {
  const store = new Map<string, { value: string; metadata?: unknown }>();
  return {
    async get(key: string) {
      return store.get(key)?.value ?? null;
    },
    async getWithMetadata<T>(key: string): Promise<{ value: string | null; metadata: T | null }> {
      const entry = store.get(key);
      if (!entry) {
        return { value: null, metadata: null };
      }
      return { value: entry.value, metadata: (entry.metadata as T) ?? null };
    },
    async put(key: string, value: string, options?: { metadata?: unknown }) {
      store.set(key, { value, metadata: options?.metadata });
    },
    async delete(key: string) {
      store.delete(key);
    },
    async list() {
      return { keys: Array.from(store.keys()).map((name) => ({ name })) } as unknown as
        | AsyncIterable<any>
        | { keys: { name: string }[] };
    },
  } as KVNamespace;
}

type SnapshotBody = { source: string; features: Record<string, unknown> };

function assertSnapshotBody(value: unknown): asserts value is SnapshotBody {
  if (!value || typeof value !== 'object' || value === null) {
    throw new Error('Unexpected snapshot payload.');
  }
  if (!('source' in value) || !('features' in value)) {
    throw new Error('Snapshot payload missing expected fields.');
  }
}

describe('experiments proxy worker', () => {
  it('returns a fresh snapshot when GrowthBook responds successfully', async () => {
    const kv = createKv();
    const env = {
      EXPERIMENTS_CACHE: kv,
      GROWTHBOOK_FEATURES_ENDPOINT: 'https://growthbook.example.com',
      GROWTHBOOK_CLIENT_KEY: 'sdk-demo',
      EXPERIMENTS_REFRESH_TOKEN: 'secret',
    } as unknown as ExperimentsProxyEnv;

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: 200,
        features: { 'homepage.hero.badge': { defaultValue: 'control' } },
        dateUpdated: '2024-10-10T00:00:00.000Z',
      }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const request = new Request('https://experiments.example.com/v1/features');
    if (!worker.fetch) {
      throw new Error('Worker fetch handler missing.');
    }
    const response = await worker.fetch(request as never, env);

    expect(response.status).toBe(200);
    const body = await response.json();
    assertSnapshotBody(body);
    expect(body.source).toBe('origin');
    expect(body.features['homepage.hero.badge']).toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });

  it('serves cached payloads when GrowthBook is offline', async () => {
    const kv = createKv();
    const payload = {
      features: { 'homepage.hero.badge': { defaultValue: 'control' } },
      fetchedAt: '2024-10-09T00:00:00.000Z',
      metadata: {},
    };
    const stored = await __internal.storeCache(
      {
        EXPERIMENTS_CACHE: kv,
        GROWTHBOOK_FEATURES_ENDPOINT: 'https://growthbook.example.com',
        GROWTHBOOK_CLIENT_KEY: 'sdk-demo',
      } as unknown as ExperimentsProxyEnv,
      payload,
    );

    expect(stored.hash).toMatch(/^sha256:/u);

    const env = {
      EXPERIMENTS_CACHE: kv,
      GROWTHBOOK_FEATURES_ENDPOINT: 'https://growthbook.example.com',
      GROWTHBOOK_CLIENT_KEY: 'sdk-demo',
    } as unknown as ExperimentsProxyEnv;

    const fetchMock = vi.fn().mockRejectedValue(new Error('upstream down'));
    const snapshot = await __internal.loadSnapshot(env, fetchMock, true);
    expect(snapshot.source).toBe('cache');
    expect(snapshot.features['homepage.hero.badge']).toBeDefined();
  });

  it('enforces the refresh token for POST /v1/refresh', async () => {
    const kv = createKv();
    const env = {
      EXPERIMENTS_CACHE: kv,
      GROWTHBOOK_FEATURES_ENDPOINT: 'https://growthbook.example.com',
      GROWTHBOOK_CLIENT_KEY: 'sdk-demo',
      EXPERIMENTS_REFRESH_TOKEN: 'secret',
    } as unknown as ExperimentsProxyEnv;

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ features: {}, status: 200 }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const unauthenticated = new Request('https://experiments.example.com/v1/refresh', {
      method: 'POST',
    });
    if (!worker.fetch) {
      throw new Error('Worker fetch handler missing.');
    }
    const unauthenticatedResponse = await worker.fetch(unauthenticated as never, env);
    expect(unauthenticatedResponse.status).toBe(401);

    const authenticated = new Request('https://experiments.example.com/v1/refresh', {
      method: 'POST',
      headers: { Authorization: 'Bearer secret' },
    });
    const response = await worker.fetch(authenticated as never, env);
    expect(response.status).toBe(200);

    vi.unstubAllGlobals();
  });
});
