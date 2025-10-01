import { test, expect, type Locator, type BrowserContext, type Page } from '@playwright/test';

import { setTheme, stabilizePageChrome, waitForIslandHydration } from './utils/page';

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
  await stabilizePageChrome(page);
  await setTheme(page, 'light');
  await waitForIslandHydration(page, 'form[aria-labelledby][data-js-ready]');
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
  await stabilizePageChrome(page);
  await setTheme(page, 'light');
  await waitForIslandHydration(page, 'form[aria-labelledby][data-js-ready]');
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

test('announces validation guidance with screen reader emulation', async ({ page }) => {
  await page.goto('/about/contact/');
  await stabilizePageChrome(page);
  await setTheme(page, 'light');
  await waitForIslandHydration(page, 'form[aria-labelledby][data-js-ready]');

  await page.waitForFunction(() => typeof window.__CONTACT_FORM_SET_TOKEN__ === 'function');
  await page.evaluate(() => {
    // Short token keeps the turnstile surface in an error state while still exercising client-side validation.
    window.__CONTACT_FORM_SET_TOKEN__?.('short');
  });

  // Enable the assistive tech affordances so we validate the same pathways used by VoiceOver users.
  const pageWithVisionControls = page as Page & {
    emulateVisionDeficiency?: unknown;
  };
  const visionToggle =
    typeof pageWithVisionControls.emulateVisionDeficiency === 'function'
      ? (pageWithVisionControls.emulateVisionDeficiency as CallableFunction).bind(
          pageWithVisionControls,
        )
      : null;
  await visionToggle?.('none');

  const context = page.context();
  const contextWithScreenReader = context as BrowserContext & {
    setScreenReaderMode?: unknown;
  };
  const toggleScreenReader =
    typeof contextWithScreenReader.setScreenReaderMode === 'function'
      ? (contextWithScreenReader.setScreenReaderMode as CallableFunction).bind(
          contextWithScreenReader,
        )
      : null;
  await toggleScreenReader?.(true);

  // Ensure every field is blank so the Zod schema emits deterministic issues for each control.
  await page.fill('#name', '');
  await page.fill('#email', '');
  await page.fill('#company', '');
  await page.fill('#message', '');
  await page.evaluate(() => {
    const select = document.querySelector('#intent') as HTMLSelectElement | null;
    if (select) {
      select.value = '';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  await page.getByRole('button', { name: 'Send message' }).click();

  const statusRegion = page.locator('#contact-form-status');
  await expect(statusRegion).toHaveAttribute('data-state', 'error');
  await expect(statusRegion).toContainText('Review “Full name” to continue.');

  const expectedFieldStates: Array<{ locator: Locator; description: string }> = [
    { locator: page.locator('#name'), description: 'contact-error-name' },
    { locator: page.locator('#email'), description: 'email-help contact-error-email' },
    { locator: page.locator('#company'), description: 'contact-error-company' },
    { locator: page.locator('#intent'), description: 'contact-error-intent' },
    { locator: page.locator('#message'), description: 'contact-error-message' },
    {
      locator: page.locator('[data-turnstile-label="true"] + div'),
      description: 'contact-error-turnstile',
    },
  ];

  for (const { locator, description } of expectedFieldStates) {
    await expect(locator).toHaveAttribute('aria-invalid', 'true');
    await expect(locator).toHaveAttribute('aria-describedby', description);
  }
});
