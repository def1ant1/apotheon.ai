import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

import { Miniflare, createFetchMock } from 'miniflare';
import { describe, expect, it } from 'vitest';

const BUNDLE_SCRIPT_PATH = join(process.cwd(), 'scripts', 'tests', 'bundle-analytics-worker.mjs');

async function bundleWorker(): Promise<string> {
  const result = spawnSync('node', [BUNDLE_SCRIPT_PATH], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(result.stderr || 'Failed to bundle analytics worker');
  }
  return result.stdout;
}

describe('analytics proxy worker contract', () => {
  it('forwards payloads to the backend and records audits', async () => {
    const script = await bundleWorker();

    const fetchMock = createFetchMock();
    fetchMock
      .get('https://analytics.example.com')
      .intercept({ path: '/api/collect', method: 'POST' })
      .reply(204, '', { headers: { 'x-backend': 'ok' } });

    const mf = new Miniflare({
      script,
      modules: true,
      modulesRoot: process.cwd(),
      compatibilityDate: '2024-10-08',
      kvNamespaces: ['ANALYTICS_RATE_LIMIT'],
      d1Databases: { ANALYTICS_AUDIT_DB: ':memory:' },
      bindings: {
        ANALYTICS_BACKEND_URL: 'https://analytics.example.com',
        ANALYTICS_PROXY_SECRET: 'super-secret',
        ANALYTICS_ALLOWED_ORIGINS: 'https://example.com',
      },
      fetchMock,
    });

    const payload = {
      event: 'blog_read',
      sessionId: 'session-abc12345',
      payload: { slug: 'welcome' },
      occurredAt: new Date('2024-10-01T10:00:00Z').toISOString(),
      meta: { href: 'https://example.com/blog/welcome' },
    };

    const response = await mf.dispatchFetch('https://collect.apotheon.ai/beacon', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://example.com',
        'cf-connecting-ip': '198.51.100.42',
        'cf-ipcountry': 'DE',
        'cf-ray': 'test-ray',
      },
      body: JSON.stringify(payload),
    });

    expect(response.status).toBe(204);

    await mf.dispose();
  });

  it('persists prefetch telemetry batches for downstream dashboards', async () => {
    const script = await bundleWorker();

    const fetchMock = createFetchMock();
    fetchMock
      .get('https://analytics.example.com')
      .intercept({ path: '/api/collect', method: 'POST' })
      .reply(204, '', { headers: { 'x-backend': 'ok' } });

    const mf = new Miniflare({
      script,
      modules: true,
      modulesRoot: process.cwd(),
      compatibilityDate: '2024-10-08',
      kvNamespaces: ['ANALYTICS_RATE_LIMIT'],
      d1Databases: { ANALYTICS_AUDIT_DB: ':memory:' },
      bindings: {
        ANALYTICS_BACKEND_URL: 'https://analytics.example.com',
        ANALYTICS_PROXY_SECRET: 'super-secret',
        ANALYTICS_ALLOWED_ORIGINS: 'https://example.com',
      },
      fetchMock,
    });

    const recordedAt = new Date('2024-10-01T10:05:00Z').toISOString();
    const payload = {
      event: 'prefetch_navigation_metrics',
      sessionId: 'session-prefetch-001',
      payload: {
        version: 1,
        recordedAt,
        routes: [
          {
            route: '/docs/orchestration',
            prefetched: {
              visits: 3,
              buckets: {
                '0-100ms': 1,
                '100-200ms': 2,
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
                '100-200ms': 1,
                '200-400ms': 1,
                '400-800ms': 0,
                '800-1600ms': 0,
                '1600ms+': 0,
              },
            },
          },
        ],
      },
      occurredAt: recordedAt,
      meta: { href: 'https://example.com/docs/orchestration' },
    } as const;

    const response = await mf.dispatchFetch('https://collect.apotheon.ai/beacon', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://example.com',
        'cf-connecting-ip': '198.51.100.42',
        'cf-ipcountry': 'DE',
        'cf-ray': 'prefetch-test-ray',
      },
      body: JSON.stringify(payload),
    });

    expect(response.status).toBe(204);

    const db = await mf.getD1Database('ANALYTICS_AUDIT_DB');
    const result = await db
      .prepare(
        `SELECT route, prefetched_visits, non_prefetched_visits, prefetched_bucket_100_200ms
         FROM prefetch_navigation_metrics`,
      )
      .all();

    expect(result.results?.length).toBe(1);
    const record = result.results?.[0] as
      | { route: string; prefetched_visits: number; non_prefetched_visits: number; prefetched_bucket_100_200ms: number }
      | undefined;
    expect(record?.route).toBe('/docs/orchestration');
    expect(record?.prefetched_visits).toBe(3);
    expect(record?.non_prefetched_visits).toBe(2);
    expect(record?.prefetched_bucket_100_200ms).toBe(2);

    await mf.dispose();
  });
});
