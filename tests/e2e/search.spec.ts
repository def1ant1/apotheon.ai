import { expect, test } from '@playwright/test';

test.describe('site search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-testid="pagefind-search"]')).toHaveAttribute(
      'data-hydrated',
      'true',
    );
  });

  test('returns results for a known query', async ({ page }) => {
    const input = page.getByRole('searchbox', { name: /Search Apotheon.ai/i });
    await input.fill('automation');

    await page.waitForFunction(() => {
      const results = document.querySelectorAll('[data-testid="pagefind-search-results"] li');
      return results.length > 0;
    });

    await expect(page.locator('[data-testid="pagefind-search-results"] li').first()).toBeVisible();
  });

  test('shows curated suggestions when the query has no matches', async ({ page }) => {
    const input = page.getByRole('searchbox', { name: /Search Apotheon.ai/i });
    await input.fill('zzzz-not-a-result');

    const suggestionSection = page.locator('[data-testid="pagefind-search-suggestions"]');
    await expect(suggestionSection).toBeVisible();
    await expect(suggestionSection.locator('a')).toHaveCount(4);
  });
});
