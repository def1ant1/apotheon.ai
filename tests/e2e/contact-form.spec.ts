import { test, expect } from '@playwright/test';

import {
  dismissConsentModal,
  neutralizeAstroDevToolbar,
  waitForIslandHydration,
} from './utils/page';

test.beforeEach(async ({ page }) => {
  page.on('console', (message) => {
    console.log(`[contact-form:e2e] console.${message.type()}: ${message.text()}`);
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

test('accepts a valid submission', async ({ page }) => {
  await page.route('**/api/contact', async (route) => {
    const request = route.request();
    expect(request.method()).toBe('POST');
    const body = request.postDataJSON() as Record<string, unknown>;
    expect(body.email).toBe('ops@contoso-enterprise.com');
    await route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'accepted', submissionId: 'demo-submission' }),
    });
  });

  await page.goto('/about/contact/');
  await neutralizeAstroDevToolbar(page);
  await waitForIslandHydration(page, 'form[aria-labelledby][data-js-ready]');
  await dismissConsentModal(page);
  await page.waitForFunction(() => typeof window.__CONTACT_FORM_SET_TOKEN__ === 'function');
  await page.evaluate(() => {
    window.__CONTACT_FORM_SET_TOKEN__?.('playwright-turnstile-token');
  });

  await page.fill('#name', 'Enterprise Operator');
  await page.fill('#email', 'ops@contoso-enterprise.com');
  await page.fill('#company', 'Contoso Enterprise');
  await page.selectOption('#intent', 'demo');
  await page.fill(
    '#message',
    'We would like to explore an enterprise rollout across our observability footprint in Q4.',
  );

  await expect(page.locator('input[name="turnstileToken"]')).toHaveValue(/.+/);

  await page.getByRole('button', { name: 'Send message' }).click();

  await expect(
    page.getByText('Request received. Our RevOps team will follow up shortly.'),
  ).toBeVisible();
});

test('surfaces validation failures from the worker', async ({ page }) => {
  await page.route('**/api/contact', async (route) => {
    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Disposable or blocked domain detected.' }),
    });
  });

  await page.goto('/about/contact/');
  await neutralizeAstroDevToolbar(page);
  await waitForIslandHydration(page, 'form[aria-labelledby][data-js-ready]');
  await dismissConsentModal(page);
  await page.waitForFunction(() => typeof window.__CONTACT_FORM_SET_TOKEN__ === 'function');
  await page.evaluate(() => {
    window.__CONTACT_FORM_SET_TOKEN__?.('playwright-turnstile-token');
  });

  await page.fill('#name', 'Automation Script');
  await page.fill('#email', 'ops@contoso-enterprise.com');
  await page.fill('#company', 'Contoso Enterprise');
  await page.selectOption('#intent', 'demo');
  await page.fill(
    '#message',
    'This message intentionally uses a disposable domain to verify rejection paths in the UI.',
  );

  await expect(page.locator('input[name="turnstileToken"]')).toHaveValue(/.+/);

  await page.getByRole('button', { name: 'Send message' }).click();

  await expect(page.getByText('Disposable or blocked domain detected.')).toBeVisible();
});
