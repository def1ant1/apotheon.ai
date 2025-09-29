import { expect, test } from '@playwright/test';

import { setTheme, stabilizePageChrome, waitForIslandHydration } from './utils/page';

test.beforeEach(async ({ page }) => {
  page.on('console', (message) => {
    console.log(`[investor-journey:e2e] console.${message.type()}: ${message.text()}`);
  });

  await page.addInitScript(() => {
    window.turnstile = {
      render(container, options) {
        const element =
          typeof container === 'string' ? document.querySelector(container) : container;
        if (element instanceof HTMLElement) {
          element.setAttribute('data-turnstile', 'rendered');
        }
        setTimeout(() => options.callback('playwright-turnstile-token'), 10);
        return 'test-widget';
      },
      reset() {
        /* noop for tests */
      },
    };
  });
});

test('homepage investor CTA completes the investor contact journey', async ({ page }) => {
  await page.route('**/api/contact', async (route) => {
    const request = route.request();
    expect(request.method()).toBe('POST');
    const body = request.postDataJSON() as Record<string, unknown>;
    expect(body.intent).toBe('investor');
    await route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'accepted', submissionId: 'investor-intake' }),
    });
  });

  await page.goto('/');
  await stabilizePageChrome(page);
  await setTheme(page, 'light');

  const investorCta = page.locator('[data-analytics-id="homepage-investor-banner-cta"]');
  await investorCta.scrollIntoViewIfNeeded();
  await investorCta.click();

  await expect(page).toHaveURL(/\/about\/investors\//);
  await expect(page.getByRole('heading', { level: 1, name: 'Investor Relations' })).toBeVisible();

  await stabilizePageChrome(page);
  await setTheme(page, 'light');

  const heroCta = page.getByRole('link', { name: 'Speak with investor relations' }).first();
  await heroCta.click();

  await expect(page).toHaveURL(/\/about\/contact\//);
  await expect(page).toHaveURL(/team=investor-relations/);

  await stabilizePageChrome(page);
  await setTheme(page, 'light');
  await waitForIslandHydration(page, 'form[aria-labelledby][data-js-ready]');
  await page.waitForFunction(() => typeof window.__CONTACT_FORM_SET_TOKEN__ === 'function');
  await page.evaluate(() => {
    window.__CONTACT_FORM_SET_TOKEN__?.('playwright-turnstile-token');
  });

  await expect(page.locator('#intent')).toHaveValue('investor');

  await page.fill('#name', 'Institutional Partner');
  await page.fill('#email', 'investor@contoso-enterprise.com');
  await page.fill('#company', 'Contoso Enterprise Capital');
  await page.fill(
    '#message',
    'We would like to schedule an investor diligence session covering revenue retention, compliance roadmap, and automation metrics.',
  );

  await expect(page.locator('input[name="turnstileToken"]')).toHaveValue(/.+/);

  await page.getByRole('button', { name: 'Send message' }).click();

  await expect(
    page.getByText('Request received. Our RevOps team will follow up shortly.'),
  ).toBeVisible();
});
