import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

import { Miniflare, createFetchMock } from 'miniflare';
import { describe, expect, it } from 'vitest';

const BUNDLE_SCRIPT_PATH = join(
  process.cwd(),
  'scripts',
  'tests',
  'bundle-synthetic-health-worker.mjs',
);

async function triggerScheduledRun(mf: Miniflare) {
  const cronExpression = encodeURIComponent('*/5 * * * *');
  await mf.dispatchFetch(
    `https://synthetic.apotheon.ai/cdn-cgi/mf/scheduled?time=${Date.now()}&cron=${cronExpression}`,
  );
}

function bundleSyntheticWorker(): string {
  const result = spawnSync('node', [BUNDLE_SCRIPT_PATH], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(result.stderr || 'Failed to bundle synthetic health worker');
  }
  return result.stdout;
}

describe('synthetic health worker', () => {
  it('records successful runs and persists audit metadata', async () => {
    const script = bundleSyntheticWorker();
    const fetchMock = createFetchMock();

    fetchMock
      .get('https://apotheon.ai')
      .intercept({ path: '/api/contact', method: 'POST' })
      .reply(202, { status: 'accepted', submissionId: 'contact-123' });

    fetchMock
      .get('https://apotheon.ai')
      .intercept({ path: '/api/whitepapers', method: 'POST' })
      .reply(200, {
        status: 'granted',
        downloadUrl: 'https://cdn.example.com/file.pdf',
        requestId: 'whitepaper-456',
      });

    const mf = new Miniflare({
      script,
      modules: true,
      modulesRoot: process.cwd(),
      compatibilityDate: '2024-10-08',
      d1Databases: { SYNTHETIC_HEALTH_DB: ':memory:' },
      bindings: {
        SYNTHETIC_SIGNING_SECRET: 'synthetic-test-secret-automation-signing-key-001',
        SYNTHETIC_CONTACT_ENDPOINT: 'https://apotheon.ai/api/contact',
        SYNTHETIC_WHITEPAPER_ENDPOINT: 'https://apotheon.ai/api/whitepapers',
        SYNTHETIC_WHITEPAPER_SLUG: 'apotheon-investor-brief',
      },
      fetchMock,
    });

    await triggerScheduledRun(mf);

    const statusResponse = await mf.dispatchFetch('https://synthetic.apotheon.ai/status');
    expect(statusResponse.status).toBe(200);
    const payload = (await statusResponse.json()) as {
      status: string;
      checks: Array<{ check: string; status: string; auditId?: string }>;
    };

    expect(payload.status).toBe('healthy');
    expect(payload.checks).toHaveLength(2);
    expect(payload.checks.every((check) => check.auditId && check.auditId.length > 0)).toBe(true);

    await mf.dispose();
  });

  it('emits webhook notifications when regressions occur', async () => {
    const script = bundleSyntheticWorker();
    const fetchMock = createFetchMock();
    const webhookRequests: unknown[] = [];

    fetchMock
      .get('https://apotheon.ai')
      .intercept({ path: '/api/contact', method: 'POST' })
      .reply(503, { error: 'Outage' });

    fetchMock
      .get('https://apotheon.ai')
      .intercept({ path: '/api/whitepapers', method: 'POST' })
      .reply(200, {
        status: 'granted',
        downloadUrl: 'https://cdn.example.com/file.pdf',
        requestId: 'whitepaper-456',
      });

    fetchMock
      .get('https://hooks.example.com')
      .intercept({ path: '/incident', method: 'POST' })
      .reply((options) => {
        webhookRequests.push(options);
        return { statusCode: 202 };
      });

    const mf = new Miniflare({
      script,
      modules: true,
      modulesRoot: process.cwd(),
      compatibilityDate: '2024-10-08',
      d1Databases: { SYNTHETIC_HEALTH_DB: ':memory:' },
      bindings: {
        SYNTHETIC_SIGNING_SECRET: 'synthetic-test-secret-automation-signing-key-001',
        SYNTHETIC_CONTACT_ENDPOINT: 'https://apotheon.ai/api/contact',
        SYNTHETIC_WHITEPAPER_ENDPOINT: 'https://apotheon.ai/api/whitepapers',
        SYNTHETIC_WHITEPAPER_SLUG: 'apotheon-investor-brief',
        SYNTHETIC_ALERT_WEBHOOK: 'https://hooks.example.com/incident',
      },
      fetchMock,
    });

    await triggerScheduledRun(mf);

    const statusResponse = await mf.dispatchFetch('https://synthetic.apotheon.ai/status');
    expect(statusResponse.status).toBe(200);
    const payload = (await statusResponse.json()) as {
      status: string;
      checks: Array<{ check: string; status: string }>;
    };

    expect(payload.status).toBe('failed');
    expect(payload.checks.some((check) => check.status === 'failed')).toBe(true);
    expect(webhookRequests).toHaveLength(1);

    await mf.dispose();
  });
});
