import { expect, test } from '@playwright/test';

const PREVIEW_PATH =
  '/api/og-test/welcome.png?title=Visual%20Regression&subtitle=Playwright%20Snapshot';

test('renders OG preview card', async ({ page }) => {
  await page.goto(PREVIEW_PATH);
  await expect(page).toHaveScreenshot('og-preview.png', {
    animations: 'disabled',
    fullPage: true,
  });
});
