import { expect, test } from '@playwright/test';

test.describe('Homepage CTA banners', () => {
  test('investor CTA supports keyboard focus and activation', async ({ page }) => {
    await page.goto('/');

    const investorCta = page.locator('[data-analytics-id="homepage-investor-banner-cta"]');
    await investorCta.scrollIntoViewIfNeeded();
    await investorCta.focus();
    await expect(investorCta).toBeFocused();

    await Promise.all([page.waitForURL('**/about/investors/**'), investorCta.press('Enter')]);

    await expect(page).toHaveURL(/\/about\/investors\//);
    await page.goBack();
  });

  test('demo CTA accepts keyboard focus and enter key activation', async ({ page }) => {
    await page.goto('/');

    const demoCta = page.locator('[data-analytics-id="homepage-demo-banner-cta"]');
    await demoCta.scrollIntoViewIfNeeded();
    await demoCta.focus();
    await expect(demoCta).toBeFocused();

    await Promise.all([page.waitForURL('**/about/contact/**'), demoCta.press('Enter')]);

    await expect(page).toHaveURL(/\/about\/contact\//);
    await expect(page).toHaveURL(/flow=demo/);
    await page.goBack();
  });
});
