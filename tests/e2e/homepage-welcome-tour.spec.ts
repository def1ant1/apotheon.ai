import { test, expect } from '@playwright/test';

import { WELCOME_TOUR_STORAGE_KEY } from '../../src/components/islands/welcomeTour.constants';

test.describe('homepage welcome tour', () => {
  test('supports keyboard navigation and persists completion', async ({ page }) => {
    await page.addInitScript((key) => {
      try {
        window.localStorage.removeItem(key);
      } catch (error) {
        console.warn('[e2e] failed to clear welcome tour storage key', error);
      }
    }, WELCOME_TOUR_STORAGE_KEY);

    await page.goto('/');

    const dialog = page.getByTestId('welcome-tour-dialog');
    await expect(dialog).toBeVisible();

    const nextButton = page.getByTestId('welcome-tour-next');
    await expect(nextButton).toBeVisible();
    await expect(nextButton).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(page.getByText('Federated search')).toBeVisible();

    await page.keyboard.press('ArrowRight');
    await expect(page.getByText('Documentation launchpad')).toBeVisible();

    await page.keyboard.press('Enter');
    await expect(dialog).not.toBeVisible();

    const storedRecord = await page.evaluate(
      (key) => window.localStorage.getItem(key),
      WELCOME_TOUR_STORAGE_KEY,
    );
    expect(storedRecord).not.toBeNull();
    const parsed = storedRecord ? JSON.parse(storedRecord) : null;
    expect(parsed?.status).toBe('dismissed');

    await page.reload();
    await expect(page.getByTestId('welcome-tour-dialog')).toHaveCount(0);
  });
});
