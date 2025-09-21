import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  page.on('console', (message) => {
    console.log(`[whitepaper-form:e2e] console.${message.type()}: ${message.text()}`);
  });

  await page.addInitScript(() => {
    window.turnstile = {
      render(container, options) {
        const element =
          typeof container === 'string' ? document.querySelector(container) : container;
        if (element instanceof HTMLElement) {
          element.setAttribute('data-turnstile', 'rendered');
        }
        setTimeout(() => options.callback('playwright-whitepaper-token'), 10);
        return 'whitepaper-widget';
      },
      reset() {
        /* noop for tests */
      },
    };
  });
});

async function completeWhitepaperForm(
  page: import('@playwright/test').Page,
  options: { expectToken?: boolean } = {},
) {
  const { expectToken = true } = options;
  await page.goto('/about/white-papers/');
  await page.evaluate(() => {
    document
      .querySelectorAll('astro-dev-toolbar, astro-dev-overlay')
      .forEach((node) => node.remove());
  });
  await page.waitForFunction(() => typeof window.__WHITEPAPER_FORM_SET_TOKEN__ === 'function');
  if (expectToken) {
    await page.evaluate(() => {
      window.__WHITEPAPER_FORM_SET_TOKEN__?.('playwright-whitepaper-token');
    });
  }

  await page.selectOption('#whitepaperSlug', 'sovereign-ai-assurance');
  await page.fill('#name', 'Enterprise Strategist');
  await page.fill('#email', 'strategist@contoso-enterprise.com');
  await page.fill('#company', 'Contoso Enterprise');
  await page.fill('#role', 'Strategy & Transformation');
  await page.fill(
    '#justification',
    'Preparing a governance review to evaluate sovereign AI readiness and mission guardrails.',
  );

  if (expectToken) {
    await expect(page.locator('input[name="turnstileToken"]')).toHaveValue(/.+/);
  }

  const submitButton = page.getByRole('button', { name: 'Request download' });
  await submitButton.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, 100));
}

async function submitWhitepaperForm(page: import('@playwright/test').Page) {
  await page
    .locator('form[action="/api/whitepapers"]')
    .evaluate((form) => (form as HTMLFormElement).requestSubmit());
}

test('approves a valid whitepaper request', async ({ page }) => {
  await page.route('**/api/whitepapers', async (route) => {
    const request = route.request();
    expect(request.method()).toBe('POST');
    const payload = request.postDataJSON() as Record<string, unknown>;
    expect(payload.whitepaperSlug).toBe('sovereign-ai-assurance');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'granted',
        downloadUrl: 'https://example.com/sovereign-ai.pdf?token=123',
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
        requestId: 'playwright-request',
      }),
    });
  });

  await completeWhitepaperForm(page);

  await submitWhitepaperForm(page);

  await expect(
    page.getByText('Request approved. Your download link is ready below.'),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Access the whitepaper' })).toHaveAttribute(
    'href',
    /sovereign-ai\.pdf/,
  );
});

test('surfaces worker rejection messaging', async ({ page }) => {
  await page.route('**/api/whitepapers', async (route) => {
    await route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Use a corporate email address that passes verification.' }),
    });
  });

  await completeWhitepaperForm(page);
  await submitWhitepaperForm(page);
  await expect(
    page.getByText('Use a corporate email address that passes verification.'),
  ).toBeVisible();
});

test('handles expired verification tokens gracefully', async ({ page }) => {
  await page.addInitScript(() => {
    window.turnstile = {
      render(container, options) {
        const element =
          typeof container === 'string' ? document.querySelector(container) : container;
        if (element instanceof HTMLElement) {
          element.setAttribute('data-turnstile', 'rendered');
        }
        setTimeout(() => {
          options.callback('playwright-whitepaper-token');
          options['expired-callback']?.();
        }, 10);
        return 'whitepaper-expired-widget';
      },
      reset() {
        /* noop */
      },
    };
  });

  await completeWhitepaperForm(page, { expectToken: false });

  // The expired callback clears the token; ensure the UI prompts the user to retry.
  await submitWhitepaperForm(page);
  await expect(page.getByText('Complete the verification challenge to continue.')).toBeVisible();
});
