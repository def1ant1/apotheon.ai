import { expect, test } from '@playwright/test';

test.describe('solutions landing page', () => {
  test('renders hero, catalog, and downstream CTAs', async ({ page }) => {
    await page.goto('/solutions/');

    await expect(
      page.getByRole('heading', { level: 1, name: /Launch-ready platform accelerators/i }),
    ).toBeVisible();

    const catalogSection = page.locator('#solutions-catalog');
    await expect(catalogSection).toBeVisible();

    const cards = catalogSection.locator('a');
    await expect(cards).toHaveCount(6);

    // Ensure each card exposes meaningful copy for search + navigation.
    for (let index = 0; index < 6; index += 1) {
      const card = cards.nth(index);
      await expect(card.locator('span').nth(1)).not.toHaveText('');
      await expect(card).toHaveAttribute('href', /\/solutions\//);
    }

    const followUpHeading = page.getByRole('heading', { level: 2, name: /Where to go next/i });
    await expect(followUpHeading).toBeVisible();
    const ctaSection = followUpHeading.locator('xpath=ancestor::section[1]');
    const nextLinks = ctaSection.locator('a');
    await expect(nextLinks).toHaveCount(3);
  });
});
