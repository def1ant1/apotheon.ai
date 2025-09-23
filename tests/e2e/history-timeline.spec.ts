import { expect, test } from '@playwright/test';

import { dismissConsentModal, neutralizeAstroDevToolbar } from './utils/page';

const VIEWPORTS = [
  { name: 'desktop', viewport: { width: 1280, height: 768 } },
  { name: 'mobile', viewport: { width: 414, height: 896 } },
];

for (const { name, viewport } of VIEWPORTS) {
  test.describe(`${name} history timeline`, () => {
    test.use({ viewport });

    test('renders milestone cards and quick links', async ({ page }) => {
      await page.goto('/about/history/');
      await neutralizeAstroDevToolbar(page);
      await dismissConsentModal(page);

      await expect(
        page.getByRole('heading', { name: 'Mission discipline across every growth stage' }),
      ).toBeVisible();
      const cards = page.locator('[data-animate="timeline-card"]');
      await expect(cards).toHaveCount(3);
      await expect(page.getByRole('navigation', { name: 'Timeline quick links' })).toBeVisible();
      const quickLink = page.getByRole('link', { name: /2018/ });
      await expect(quickLink).toBeVisible();
      await quickLink.click();
      await expect(page.locator('#milestone-2018-company-timeline')).toBeInViewport();
    });
  });
}

test.describe('timeline accessibility affordances', () => {
  test('skip link jumps to related resources section for keyboard users', async ({ page }) => {
    await page.goto('/about/history/');
    await neutralizeAstroDevToolbar(page);
    await dismissConsentModal(page);
    const skipLink = page.locator('a.timeline-skip-link');
    await skipLink.focus();
    await expect(skipLink).toBeFocused();
    await skipLink.press('Enter');
    await expect(page).toHaveURL(/#timeline-related-links$/);
    await expect(page.locator('#timeline-related-links')).toBeVisible();
  });

  test('timeline cards become visible without relying on animation', async ({ page }) => {
    await page.goto('/about/history/');
    await neutralizeAstroDevToolbar(page);
    await dismissConsentModal(page);
    const firstCard = page.locator('[data-animate="timeline-card"]').first();
    await expect(firstCard).toBeVisible();
    const opacity = await firstCard.evaluate((element) => getComputedStyle(element).opacity);
    expect(Number.parseFloat(opacity)).toBeGreaterThan(0.8);
  });
});
