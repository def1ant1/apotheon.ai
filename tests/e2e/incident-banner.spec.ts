import { test, expect } from '@playwright/test';

import { dismissConsentModal, neutralizeAstroDevToolbar } from './utils/page';

test.describe('incident banner', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const defaultResponse = { status: 'healthy', checks: [] };
      const globalWindow = window as typeof window & { __APOTHEON_SYNTHETIC_MOCK__?: unknown };
      globalWindow.__APOTHEON_SYNTHETIC_MOCK__ = defaultResponse;
      const originalFetch = window.fetch.bind(window);

      window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url =
          typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        if (url.startsWith('https://synthetic.apotheon.ai/status')) {
          const payload = globalWindow.__APOTHEON_SYNTHETIC_MOCK__ ?? defaultResponse;
          return new Response(JSON.stringify(payload), {
            status: 200,
            headers: {
              'content-type': 'application/json',
              'access-control-allow-origin': '*',
            },
          });
        }
        return originalFetch(input, init);
      };
    });
  });

  test('stays hidden when synthetic monitors report healthy', async ({ page }) => {
    await page.goto('/');
    await neutralizeAstroDevToolbar(page);
    await dismissConsentModal(page);

    const banner = page.locator('[data-testid="incident-banner"]');
    await banner.first().waitFor({ state: 'attached' });
    await expect(banner).toBeHidden();
    await expect(banner).toHaveAttribute('data-incident-status', 'healthy');
  });

  test('renders downtime banner when synthetic monitors fail', async ({ page }) => {
    await page.addInitScript(
      (payload) => {
        const globalWindow = window as typeof window & { __APOTHEON_SYNTHETIC_MOCK__?: unknown };
        globalWindow.__APOTHEON_SYNTHETIC_MOCK__ = payload;
      },
      {
        status: 'failed',
        runId: 'run-123',
        generatedAt: '2024-10-10T10:00:00Z',
        checks: [
          {
            check: 'contact',
            status: 'failed',
            latencyMs: 4200,
            responseStatus: 503,
            failureReason: 'Synthetic failure for regression test.',
          },
        ],
      },
    );

    await page.goto('/');
    await neutralizeAstroDevToolbar(page);
    await dismissConsentModal(page);

    const banner = page.locator('[data-testid="incident-banner"]');
    await banner.waitFor({ state: 'visible' });
    await expect(banner).toContainText('Synthetic monitors flagged 1 regression');
    await expect(banner).toContainText('contact');
    await expect(banner).toHaveAttribute('data-incident-status', 'failed');
  });
});
