import { test, expect, type Page, type Route } from '@playwright/test';

import { neutralizeAstroDevToolbar, waitForIslandHydration } from './utils/page';

async function stubExperimentVariant(page: Page, variant: 'control' | 'accelerated') {
  await page.route('**/v1/features', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        features: {
          'homepage.hero.badge': {
            defaultValue: 'control',
            rules: variant === 'accelerated' ? [{ condition: {}, force: 'accelerated' }] : [],
          },
        },
        fetchedAt: new Date().toISOString(),
        hash: `sha256:${variant}`,
        source: 'origin',
      }),
    });
  });
}

test.describe('Homepage experiment badge', () => {
  test('renders control messaging when the flag is disabled', async ({ page }) => {
    await stubExperimentVariant(page, 'control');
    await page.goto('/');
    await neutralizeAstroDevToolbar(page);
    await waitForIslandHydration(page, '[data-testid="experiment-badge"]');

    const badge = page.getByTestId('experiment-badge');
    await expect(badge).toHaveAttribute('data-variant', 'control');
    await expect(badge).toContainText('Editorial cadence steady');
  });

  test('switches to the accelerated copy when the flag is enabled', async ({ page }) => {
    await stubExperimentVariant(page, 'accelerated');
    await page.goto('/');
    await neutralizeAstroDevToolbar(page);
    await waitForIslandHydration(page, '[data-testid="experiment-badge"]');

    const badge = page.getByTestId('experiment-badge');
    await expect(badge).toHaveAttribute('data-variant', 'accelerated');
    await expect(badge).toContainText('experiments aligned');
  });
});
