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
});
