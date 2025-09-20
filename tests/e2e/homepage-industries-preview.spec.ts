import { expect, test } from '@playwright/test';

test.describe('Homepage industries preview', () => {
  test('tabs through industry cards in document order', async ({ page }) => {
    await page.goto('/');

    const industryCards = page.locator('#industries-preview [data-card="industry"]');

    const cardCount = await industryCards.count();
    expect(cardCount).toBeGreaterThan(0);

    await industryCards.first().focus();
    await expect(industryCards.first()).toBeFocused();

    for (let index = 1; index < cardCount; index += 1) {
      await page.keyboard.press('Tab');
      await expect(industryCards.nth(index)).toBeFocused();
    }
  });
});
