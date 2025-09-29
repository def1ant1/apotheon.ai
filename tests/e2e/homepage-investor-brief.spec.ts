import { expect, test } from '@playwright/test';

import { setTheme, stabilizePageChrome, waitForIslandHydration } from './utils/page';

test.beforeEach(async ({ page }) => {
  page.on('console', (message) => {
    console.log(`[homepage-investor-brief:e2e] console.${message.type()}: ${message.text()}`);
  });

  await page.addInitScript(() => {
    window.dataLayer = [];
    window.turnstile = {
      render(container, options) {
        const element =
          typeof container === 'string' ? document.querySelector(container) : container;
        if (element instanceof HTMLElement) {
          element.setAttribute('data-turnstile', 'rendered');
        }
        setTimeout(() => options.callback('playwright-investor-brief-token'), 10);
        return 'investor-brief-widget';
      },
      reset() {
        /* test shim */
      },
    };
  });
});

test('investor brief CTA deep links into the gated whitepaper flow', async ({ page }) => {
  await page.goto('/');
  await stabilizePageChrome(page);
  await setTheme(page, 'light');

  const heroInvestorCta = page.getByRole('link', { name: 'Download investor brief' });
  await expect(heroInvestorCta).toBeVisible();
  await heroInvestorCta.click();

  await expect(page).toHaveURL(/\/about\/white-papers\//);
  await expect(page).toHaveURL(/whitepaperSlug=apotheon-investor-brief/);
  await expect(page).toHaveURL(/#whitepaper-request$/);

  await stabilizePageChrome(page);
  await setTheme(page, 'light');
  await waitForIslandHydration(page, 'form[action="/api/whitepapers"]');
  await page.waitForFunction(() => typeof window.__WHITEPAPER_FORM_SET_TOKEN__ === 'function');

  const select = page.locator('#whitepaperSlug');
  await expect(select).toHaveValue('apotheon-investor-brief');

  const dataLayerEvents = await page.evaluate(() => {
    const globalWindow = window as typeof window & { dataLayer?: unknown[] };
    return globalWindow.dataLayer ?? [];
  });
  expect(dataLayerEvents).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        event: 'whitepaper_request_prefill_applied',
        slug: 'apotheon-investor-brief',
        source: 'querystring',
      }),
    ]),
  );
});
