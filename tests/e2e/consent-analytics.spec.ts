import { expect, test } from '@playwright/test';

import { dismissConsentModal, neutralizeAstroDevToolbar } from './utils/page';

test.describe('Consent manager & analytics routing', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      if (typeof navigator === 'undefined') {
        return;
      }

      const scopedNavigator = navigator as Navigator & {
        __APOTHEON_ORIGINAL_BEACON__?: typeof navigator.sendBeacon;
      };

      if (typeof scopedNavigator.sendBeacon === 'function') {
        scopedNavigator.__APOTHEON_ORIGINAL_BEACON__ =
          scopedNavigator.sendBeacon.bind(scopedNavigator);
        scopedNavigator.sendBeacon = () => false;
      }
    });
  });

  test('persists consent toggles and exposes the headless API', async ({ page }) => {
    await page.goto('/');
    await neutralizeAstroDevToolbar(page);
    await dismissConsentModal(page);

    const modal = page.getByTestId('consent-modal');

    const stored = await page.evaluate(() =>
      window.localStorage.getItem('apotheon_privacy_consent'),
    );
    expect(stored).toContain('"consent-storage":true');
    expect(stored).toContain('"umami-telemetry":false');

    const headless = await page.evaluate(() => window.__APOTHEON_CONSENT__?.get());
    expect(headless?.['pipeline-alerts']).toBe(false);

    await page.getByTestId('consent-open-trigger').click();
    await expect(modal).toBeVisible();
    await page.getByTestId('consent-accept-all').click();
    await page.getByTestId('consent-save').click();

    const refreshed = await page.evaluate(() => window.__APOTHEON_CONSENT__?.get());
    expect(refreshed?.['pipeline-alerts']).toBe(true);
  });

  test('suppresses analytics without consent and resumes after geo overrides', async ({ page }) => {
    let requestCount = 0;
    let lastPayload: any = null;

    await page.route('https://collect.apotheon.ai/beacon', async (route) => {
      requestCount += 1;
      const data = route.request().postData();
      lastPayload = data ? JSON.parse(data) : null;
      await route.fulfill({ status: 204, body: '' });
    });

    await page.goto('/blog');
    await neutralizeAstroDevToolbar(page);
    await dismissConsentModal(page);
    const modal = page.getByTestId('consent-modal');

    await expect(page.locator('[data-testid="blog-index-root"]')).toHaveAttribute(
      'data-hydrated',
      'true',
    );

    const firstLink = page.locator('[role="listitem"] a').first();
    await firstLink.scrollIntoViewIfNeeded();
    await firstLink.focus();
    await firstLink.press('Enter');
    await page.waitForTimeout(300);
    expect(requestCount).toBe(0);

    await page.goBack();
    await neutralizeAstroDevToolbar(page);
    await expect(page.locator('[data-testid="blog-index-root"]')).toHaveAttribute(
      'data-hydrated',
      'true',
    );

    await page.getByTestId('consent-open-trigger').click();
    await page.getByTestId('consent-accept-all').click();
    await page.getByTestId('consent-save').click();
    await expect(modal).toBeHidden();

    requestCount = 0;
    const nextLink = page.locator('[role="listitem"] a').first();
    await nextLink.scrollIntoViewIfNeeded();
    await nextLink.focus();
    await nextLink.press('Enter');
    await expect
      .poll(() => requestCount, { message: 'Expected analytics beacon' })
      .toBeGreaterThan(0);
    expect(lastPayload?.event).toBe('blog_read');

    await page.goBack();
    await neutralizeAstroDevToolbar(page);
    await expect(page.locator('[data-testid="blog-index-root"]')).toHaveAttribute(
      'data-hydrated',
      'true',
    );

    await page.evaluate(() => {
      window.__APOTHEON_CONSENT__?.update({
        'consent-storage': true,
        'umami-telemetry': true,
        'pipeline-alerts': false,
      });
    });

    requestCount = 0;
    await page.locator('[role="listitem"] a').first().click();
    await expect
      .poll(() => requestCount, { message: 'Expected analytics beacon after geo override' })
      .toBeGreaterThan(0);
    expect(lastPayload?.event).toBe('blog_read');
    expect(lastPayload?.payload).toMatchObject({ slug: expect.any(String) });
  });
});
