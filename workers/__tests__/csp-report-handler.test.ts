/* @vitest-environment node */

import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

import { Miniflare, createFetchMock } from 'miniflare';
import { describe, expect, it } from 'vitest';

const BUNDLE_SCRIPT_PATH = join(process.cwd(), 'scripts', 'tests', 'bundle-csp-report-worker.mjs');

function bundleWorker(): string {
  const result = spawnSync('node', [BUNDLE_SCRIPT_PATH], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(result.stderr || 'Failed to bundle CSP report worker');
  }
  return result.stdout;
}

describe('csp report handler worker', () => {
  it('persists normalized batches to the REPORTS namespace', async () => {
    const script = bundleWorker();

    const mf = new Miniflare({
      script,
      modules: true,
      modulesRoot: process.cwd(),
      compatibilityDate: '2024-10-08',
      kvNamespaces: ['REPORTS'],
      bindings: {
        CSP_ALLOWED_HOSTS: 'https://assets.apotheon.ai,*.trustedcdn.com',
        CSP_ENVIRONMENT: 'staging',
      },
    });

    await mf.ready;
    const bindings = await mf.getBindings<{
      REPORTS: {
        put: (key: string, value: string, options?: { expirationTtl?: number }) => Promise<void>;
        get: (key: string, type?: 'text' | 'json' | 'arrayBuffer') => Promise<unknown>;
        list: () => Promise<{ keys: Array<{ name: string; expiration?: number | null }> }>;
      };
    }>();

    const payload = {
      reports: [
        {
          user_agent: 'Mozilla/5.0',
          body: {
            documentURI: 'https://apotheon.ai/blog',
            effectiveDirective: 'img-src',
            violatedDirective: 'img-src',
            blockedURI: 'https://cdn.bad-actor.example/image.png',
            originalPolicy: "default-src 'self'",
            statusCode: 200,
          },
        },
      ],
    };

    const response = await mf.dispatchFetch('https://csp.apotheon.ai/report', {
      method: 'POST',
      headers: {
        'content-type': 'application/reports+json',
        'cf-connecting-ip': '198.51.100.10',
        'cf-ray': 'test-ray',
      },
      body: JSON.stringify(payload),
    });

    expect(response.status).toBe(204);

    const kv = bindings.REPORTS;
    const keys = await kv.list();
    expect(keys.keys).toHaveLength(1);

    const record = keys.keys[0];
    expect(record?.expiration).toBeDefined();
    if (record?.expiration) {
      expect(record.expiration).toBeGreaterThan(Math.floor(Date.now() / 1000));
    }

    const raw = (await kv.get(record?.name ?? '', 'text')) as string | null;
    const parsed = JSON.parse(raw ?? '{}') as {
      summary?: {
        environment: string;
        runbook: string;
        directiveBreakdown: Record<string, number>;
        blockedHosts: Record<string, number>;
      };
      reports?: Array<{ blockedUri: string | null }>;
    };

    expect(parsed.summary?.environment).toBe('staging');
    expect(parsed.summary?.runbook).toBe('docs/security/RUNBOOK_CSP_Triage.md');
    expect(parsed.summary?.directiveBreakdown['img-src']).toBe(1);
    expect(parsed.summary?.blockedHosts['cdn.bad-actor.example']).toBe(1);
    expect(parsed.reports?.[0]?.blockedUri).toBe('https://cdn.bad-actor.example/image.png');

    await mf.dispose();
  });

  it('dispatches alert webhooks for suspicious script-src reports', async () => {
    const script = bundleWorker();
    const webhookRequests: unknown[] = [];

    const fetchMock = createFetchMock();
    fetchMock
      .get('https://hooks.example.com')
      .intercept({ path: '/csp', method: 'POST' })
      .reply((options) => {
        webhookRequests.push(options);
        return { statusCode: 202 };
      });

    const mf = new Miniflare({
      script,
      modules: true,
      modulesRoot: process.cwd(),
      compatibilityDate: '2024-10-08',
      kvNamespaces: ['REPORTS'],
      bindings: {
        CSP_ALLOWED_HOSTS: 'https://apotheon.ai',
        CSP_ALERT_WEBHOOK: 'https://hooks.example.com/csp',
        CSP_ENVIRONMENT: 'production',
      },
      fetchMock,
    });

    await mf.ready;
    const bindings = await mf.getBindings<{
      REPORTS: {
        get: (key: string, type?: 'text' | 'json' | 'arrayBuffer') => Promise<unknown>;
        list: () => Promise<{ keys: Array<{ name: string }> }>;
      };
    }>();

    const payload = {
      reports: [
        {
          user_agent: 'Mozilla/5.0',
          body: {
            documentURI: 'https://apotheon.ai/pricing',
            effectiveDirective: 'script-src-elem',
            violatedDirective: 'script-src',
            blockedURI: 'https://evil.example/callback.js',
            originalPolicy: "default-src 'self'",
            statusCode: 200,
          },
        },
      ],
    };

    const response = await mf.dispatchFetch('https://csp.apotheon.ai/report', {
      method: 'POST',
      headers: {
        'content-type': 'application/reports+json',
        'cf-connecting-ip': '203.0.113.24',
        'cf-ray': 'test-ray-2',
      },
      body: JSON.stringify(payload),
    });

    expect(response.status).toBe(204);
    expect(webhookRequests).toHaveLength(1);

    const kv = bindings.REPORTS;
    const keys = await kv.list();
    expect(keys.keys).toHaveLength(1);

    const record = keys.keys[0];
    const raw = (await kv.get(record?.name ?? '', 'text')) as string | null;
    const parsed = JSON.parse(raw ?? '{}') as {
      summary?: { severity?: string; runbook?: string };
    };
    expect(parsed.summary?.severity).toBe('high');
    expect(parsed.summary?.runbook).toBe('docs/security/RUNBOOK_CSP_Triage.md');

    await mf.dispose();
  });
});
