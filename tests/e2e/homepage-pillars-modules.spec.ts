import { expect, test } from '@playwright/test';

test.describe('Homepage pillars and modules', () => {
  test('support sequential keyboard traversal', async ({ page }) => {
    await page.goto('/');

    const pillarCards = page.locator('#aios-pillars [data-card="pillar"]');
    const moduleCards = page.locator('#product-modules [data-card="module"]');

    const pillarCount = await pillarCards.count();
    const moduleCount = await moduleCards.count();

    expect(pillarCount).toBeGreaterThan(0);
    expect(moduleCount).toBeGreaterThan(0);

    await pillarCards.first().focus();
    await expect(pillarCards.first()).toBeFocused();

    for (let index = 1; index < pillarCount; index += 1) {
      await page.keyboard.press('Tab');
      await expect(pillarCards.nth(index)).toBeFocused();
    }

    await page.keyboard.press('Tab');
    await expect(moduleCards.first()).toBeFocused();

    for (let index = 1; index < moduleCount; index += 1) {
      await page.keyboard.press('Tab');
      await expect(moduleCards.nth(index)).toBeFocused();
    }
  });
});
