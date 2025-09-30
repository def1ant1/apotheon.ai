import { describe, expect, it } from 'vitest';

import { __internal, type AnalyticsProxyEnv } from '../analytics-proxy';

describe('analytics proxy helpers', () => {
  it('parses allowed origins into a set', () => {
    const origins = __internal.parseAllowedOrigins('https://a.com, https://b.com ,');
    expect(origins.has('https://a.com')).toBe(true);
    expect(origins.has('https://b.com')).toBe(true);
    expect(origins.size).toBe(2);
  });

  it('produces deterministic signatures', async () => {
    const signatureA = await __internal.signPayload('secret', '{"event":"demo"}');
    const signatureB = await __internal.signPayload('secret', '{"event":"demo"}');
    expect(signatureA).toBe(signatureB);
  });

  it('enforces rate limits with ttl windows', async () => {
    const store = new Map<string, { value: string; expires: number }>();
    const kv = {
      async get(key: string) {
        const entry = store.get(key);
        if (!entry) return null;
        if (entry.expires <= Math.floor(Date.now() / 1000)) {
          store.delete(key);
          return null;
        }
        return JSON.parse(entry.value);
      },
      async put(key: string, value: string, options?: { expirationTtl?: number }) {
        const expires = Math.floor(Date.now() / 1000) + (options?.expirationTtl ?? 60);
        store.set(key, { value, expires });
      },
    } as unknown as KVNamespace;

    const env = {
      ANALYTICS_BACKEND_URL: 'https://analytics.example.com',
      ANALYTICS_PROXY_SECRET: 'secret',
      ANALYTICS_RATE_LIMIT: kv,
      ANALYTICS_AUDIT_DB: {
        prepare: () => ({ bind: () => ({ run: async () => ({ success: true }) }) }),
      },
      ANALYTICS_RATE_LIMIT_MAX: '1',
      ANALYTICS_RATE_LIMIT_WINDOW_SECONDS: '60',
    } as unknown as AnalyticsProxyEnv;

    const beacon = {
      event: 'lead_demo',
      sessionId: 'session-12345678',
      payload: {},
      meta: {},
    } as any;
    const request = new Request('https://collect.example.com/beacon', {
      headers: {
        'cf-connecting-ip': '203.0.113.2',
        'cf-ipcountry': 'US',
        'cf-ray': 'ray-id',
      },
    });

    const allowed = await __internal.enforceRateLimit(env, request, beacon as never);
    expect(allowed).toEqual({ allowed: true });

    const denied = await __internal.enforceRateLimit(env, request, beacon as never);
    expect(denied.allowed).toBe(false);
  });

  it('throws when geo headers are missing', () => {
    const request = new Request('https://collect.example.com/beacon');
    expect(() => __internal.assertGeoHeaders(request)).toThrow(/Missing required header/);
  });

  it('normalises prefetch telemetry payloads', () => {
    const now = new Date().toISOString();
    const payload = {
      version: 1 as const,
      recordedAt: now,
      routes: [
        {
          route: 'https://apotheon.ai/customers/12345/orders/abcdef0123456789?utm=1',
          prefetched: {
            visits: 1,
            buckets: {
              '0-100ms': 0,
              '100-200ms': 1,
              '200-400ms': 0,
              '400-800ms': 0,
              '800-1600ms': 0,
              '1600ms+': 0,
            },
          },
          nonPrefetched: {
            visits: 0,
            buckets: {
              '0-100ms': 0,
              '100-200ms': 0,
              '200-400ms': 0,
              '400-800ms': 0,
              '800-1600ms': 0,
              '1600ms+': 0,
            },
          },
        },
        {
          route: '/docs/getting-started',
          prefetched: {
            visits: 0,
            buckets: {
              '0-100ms': 0,
              '100-200ms': 0,
              '200-400ms': 0,
              '400-800ms': 0,
              '800-1600ms': 0,
              '1600ms+': 0,
            },
          },
          nonPrefetched: {
            visits: 2,
            buckets: {
              '0-100ms': 0,
              '100-200ms': 0,
              '200-400ms': 0,
              '400-800ms': 0,
              '800-1600ms': 2,
              '1600ms+': 0,
            },
          },
        },
        {
          route: '/ignored/empty',
          prefetched: {
            visits: 0,
            buckets: {
              '0-100ms': 0,
              '100-200ms': 0,
              '200-400ms': 0,
              '400-800ms': 0,
              '800-1600ms': 0,
              '1600ms+': 0,
            },
          },
          nonPrefetched: {
            visits: 0,
            buckets: {
              '0-100ms': 0,
              '100-200ms': 0,
              '200-400ms': 0,
              '400-800ms': 0,
              '800-1600ms': 0,
              '1600ms+': 0,
            },
          },
        },
      ],
    };

    const normalised = __internal.normalizePrefetchMetricsPayload(payload);
    expect(normalised.routes).toHaveLength(2);
    expect(normalised.routes[0]?.route).toBe('/customers/:int/orders/:hash');
    expect(normalised.routes[0]?.prefetched.visits).toBe(1);
    expect(normalised.routes[1]?.nonPrefetched.buckets['800-1600ms']).toBe(2);
  });
});
