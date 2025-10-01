import { expect, test, type Page } from '@playwright/test';

import { stabilizePageChrome } from './utils/page';

const FIXTURE_ROUTE = '/testing/navigation-prefetch';

async function navigateToFixture(
  page: Page,
  options: { reducedMotion?: 'reduce' | 'no-preference'; stabilizeMotion?: boolean } = {},
): Promise<void> {
  const { reducedMotion, stabilizeMotion = true } = options;

  if (reducedMotion) {
    await page.emulateMedia({ reducedMotion });
  }

  await page.goto(FIXTURE_ROUTE);

  if (stabilizeMotion) {
    await stabilizePageChrome(page, { reducedMotion: false });
  }
}

test.describe('navigation prefetch intent orchestration', () => {
  test('fires speculative prefetch on pointer hover when motion is allowed', async ({ page }) => {
    await page.addInitScript(() => {
      class NoopIntersectionObserver {
        constructor() {}
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() {
          return [];
        }
      }

      Object.assign(window, {
        IntersectionObserver: NoopIntersectionObserver,
      });
    });

    const trackedRequests: string[] = [];
    page.on('requestfinished', (request) => {
      if (request.url().includes('prefetch=pointer-intent')) {
        trackedRequests.push(request.url());
      }
    });

    await navigateToFixture(page, { reducedMotion: 'no-preference' });

    const pointerAnchor = page.getByTestId('prefetch-pointer-anchor');
    const pointerPrefetch = page.waitForEvent('requestfinished', (request) =>
      request.url().includes('prefetch=pointer-intent'),
    );

    await pointerAnchor.hover();

    const request = await pointerPrefetch;
    expect(request.failure()).toBeNull();
    expect(trackedRequests).toHaveLength(1);
  });

  test('enqueues prefetch when annotated anchors intersect the viewport', async ({ page }) => {
    await navigateToFixture(page, { reducedMotion: 'reduce', stabilizeMotion: true });

    const intersectionPrefetch = page.waitForEvent('requestfinished', (request) =>
      request.url().includes('prefetch=intersection-intent'),
    );

    const intersectionAnchor = page.getByTestId('prefetch-intersection-anchor');
    await intersectionAnchor.scrollIntoViewIfNeeded();

    const request = await intersectionPrefetch;
    expect(request.failure()).toBeNull();
  });

  test('skips external, download, and reduced-motion hover candidates', async ({ page }) => {
    const observed: Record<string, number> = {
      external: 0,
      download: 0,
      reduced: 0,
    };

    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('prefetch-ignore')) {
        observed.external += 1;
      }
      if (url.includes('download-intent')) {
        observed.download += 1;
      }
      if (url.includes('reduced-pointer-intent')) {
        observed.reduced += 1;
      }
    });

    await navigateToFixture(page, { reducedMotion: 'reduce', stabilizeMotion: true });

    const externalAnchor = page.getByTestId('prefetch-external-anchor');
    const downloadAnchor = page.getByTestId('prefetch-download-anchor');
    const reducedAnchor = page.getByTestId('prefetch-reduced-pointer-anchor');

    await externalAnchor.hover();
    await downloadAnchor.hover();
    await reducedAnchor.hover();

    await page.waitForTimeout(300);

    expect(observed.external).toBe(0);
    expect(observed.download).toBe(0);
    expect(observed.reduced).toBe(0);
  });

  test('flush orchestrator ships consent-gated prefetch telemetry batches', async ({ page }) => {
    await page.addInitScript(() => {
      const recordedAt = new Date('2024-10-01T11:00:00Z').toISOString();
      const aggregates = [
        {
          route: '/docs/performance-playbook',
          prefetched: {
            visits: 2,
            buckets: {
              '0-100ms': 1,
              '100-200ms': 1,
              '200-400ms': 0,
              '400-800ms': 0,
              '800-1600ms': 0,
              '1600ms+': 0,
            },
          },
          nonPrefetched: {
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
          firstRecordedAt: recordedAt,
          lastUpdatedAt: recordedAt,
        },
      ];
      window.localStorage.setItem('apotheon.prefetch.telemetry.v1', JSON.stringify(aggregates));

      const nav = navigator as Navigator & {
        __APOTHEON_PREFETCH_BEACONS__?: Array<{ url: string; payload: string | null }>;
        __APOTHEON_ORIGINAL_BEACON__?: typeof navigator.sendBeacon;
      };
      nav.__APOTHEON_PREFETCH_BEACONS__ = [];
      (window as typeof window & { __APOTHEON_PREFETCH_BEACONS__?: typeof nav.__APOTHEON_PREFETCH_BEACONS__ }).__APOTHEON_PREFETCH_BEACONS__ =
        nav.__APOTHEON_PREFETCH_BEACONS__;
      if (typeof nav.sendBeacon === 'function') {
        nav.__APOTHEON_ORIGINAL_BEACON__ = nav.sendBeacon.bind(nav);
      }
      nav.sendBeacon = (url: string, data?: BodyInit | null) => {
        let payload: string | null = null;
        if (typeof data === 'string') {
          payload = data;
        } else if (data instanceof Blob) {
          payload = null;
        } else if (data instanceof ArrayBuffer) {
          payload = new TextDecoder().decode(data);
        } else if (data instanceof FormData) {
          payload = null;
        } else if (data) {
          try {
            payload = data.toString();
          } catch {
            payload = null;
          }
        }
        nav.__APOTHEON_PREFETCH_BEACONS__?.push({ url, payload });
        return true;
      };
    });

    await navigateToFixture(page, { reducedMotion: 'no-preference' });

    await page.evaluate(() => {
      window.__APOTHEON_CONSENT__?.update({
        'consent-storage': true,
        'umami-telemetry': false,
        'pipeline-alerts': false,
      });
    });

    await page.waitForTimeout(200);
    await expect
      .poll(() =>
        page.evaluate(() => window.__APOTHEON_PREFETCH_BEACONS__?.length ?? 0),
      )
      .toBe(0);

    await page.evaluate(() => {
      window.__APOTHEON_CONSENT__?.update({
        'consent-storage': true,
        'umami-telemetry': true,
        'pipeline-alerts': false,
      });
      const snapshot = window.__APOTHEON_CONSENT__?.get();
      window.dispatchEvent(new CustomEvent('apotheon:consent:updated', { detail: snapshot }));
    });

    await expect
      .poll(
        () =>
          page.evaluate(() => window.__APOTHEON_PREFETCH_BEACONS__?.length ?? 0),
        { message: 'Expected consent-gated prefetch flush' },
      )
      .toBe(1);

    const payload = await page.evaluate(() => window.__APOTHEON_PREFETCH_BEACONS__?.[0] ?? null);
    expect(payload?.url).toContain('collect.apotheon.ai');
    expect(payload?.payload).toBeTruthy();

    const parsed = payload?.payload ? JSON.parse(payload.payload) : null;
    expect(parsed?.event).toBe('prefetch_navigation_metrics');
    expect(parsed?.payload?.routes?.[0]?.route).toBe('/docs/performance-playbook');
  });
});
