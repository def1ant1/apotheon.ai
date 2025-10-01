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
});
