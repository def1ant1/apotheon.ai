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
});
