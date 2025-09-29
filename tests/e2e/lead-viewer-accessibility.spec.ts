import { expect, test } from '@playwright/test';

import { setTheme, stabilizePageChrome } from './utils/page';

const VALID_AUTH = `Basic ${Buffer.from('analyst:secret').toString('base64')}`;

const fixture = {
  contact: {
    entries: [
      {
        id: 'contact-1',
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        company: 'Analytical Engines',
        intent: 'sales',
        message: 'Interested in enterprise rollout.',
        domain: 'example.com',
        domainClassification: 'allowed',
        domainFlags: '{}',
        domainRationale: 'Domain verified via MX records.',
        ipAddress: '203.0.113.5',
        userAgent: 'playwright-test',
        createdAt: '2024-10-08T00:00:00Z',
        sourceUrl: 'https://apotheon.ai/about/contact/',
        utm: '{"utm_source":"campaign"}',
      },
    ],
    pagination: { page: 1, perPage: 25, total: 1, totalPages: 1 },
  },
  whitepapers: {
    entries: [
      {
        id: 'whitepaper-1',
        whitepaperSlug: 'zero-trust',
        whitepaperTitle: 'Zero Trust Architecture',
        name: 'Joan Clarke',
        email: 'joan@example.com',
        company: 'Enigma Labs',
        role: 'Security Architect',
        justification: 'Validating rollout process.',
        domain: 'example.com',
        domainClassification: 'allowed',
        domainFlags: '{}',
        domainRationale: 'Domain verified via MX records.',
        ipAddress: '203.0.113.5',
        userAgent: 'playwright-test',
        marketingOptIn: true,
        signedUrlExpiresAt: '2024-10-09T00:00:00Z',
        assetObjectKey: 'whitepapers/zero-trust.pdf',
        sourceUrl: 'https://apotheon.ai/whitepapers/',
        utm: '{"utm_medium":"email"}',
        createdAt: '2024-10-08T00:00:00Z',
      },
    ],
    pagination: { page: 1, perPage: 25, total: 1, totalPages: 1 },
  },
  audit: {
    actor: 'analyst',
    ip: '203.0.113.5',
    userAgent: 'playwright-test',
    requestId: 'fixture-request',
  },
};

test.describe('lead viewer admin surface', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/lead-viewer**', async (route, request) => {
      const authorization = request.headers()['authorization'];
      if (authorization !== VALID_AUTH) {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Unauthorized' }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(fixture),
      });
    });
  });

  test('supports keyboard auth flow and renders accessible tables', async ({ page }) => {
    await page.goto('/lead-viewer/');
    await stabilizePageChrome(page);
    await setTheme(page, 'light');

    const username = page.getByLabel('Username');
    await username.fill('analyst');
    const password = page.getByLabel('Password');
    await password.fill('secret');

    const loginButton = page.getByRole('button', { name: 'Authenticate' });
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes('/api/lead-viewer') && response.request().method() === 'GET',
      ),
      loginButton.click(),
    ]);

    await expect(page.getByRole('heading', { name: 'Contact submissions' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Whitepaper requests' })).toBeVisible();

    const contactTable = page.getByRole('table').first();
    await expect(contactTable.getByRole('cell', { name: 'Ada Lovelace' })).toBeVisible();
    await expect(contactTable.getByRole('link', { name: 'ada@example.com' })).toBeVisible();

    const exportButtons = page.getByRole('button', { name: /Export CSV/i });
    await expect(exportButtons).toHaveCount(2);

    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Clear session' })).toBeFocused();
  });
});
