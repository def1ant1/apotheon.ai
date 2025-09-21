import { test, expect } from '@playwright/test';

test.describe('blog index', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/blog/');
    await expect(page.locator('[data-testid="blog-index-root"]')).toHaveAttribute(
      'data-hydrated',
      'true',
    );
  });

  test('renders published posts with Pagefind metadata', async ({ page }) => {
    const cards = page.locator('[data-pagefind-body]');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(6);
    await expect(page.locator('text=Launch, govern, and scale enterprise AI safely')).toBeVisible();
    await expect(page.locator('a[href="/rss.xml"]')).toBeVisible();
    await expect(page.locator('a[href="/atom.xml"]')).toBeVisible();
  });

  test('filters by tag and updates the list', async ({ page }) => {
    await page.selectOption('select[name="tag"]', 'governance');
    await page.waitForFunction(() => {
      const cards = Array.from(document.querySelectorAll('[data-pagefind-body]'));
      if (cards.length === 0) {
        return false;
      }
      return cards.every((node) =>
        Array.from(node.querySelectorAll('[data-pagefind-filter="tag"]')).some(
          (el) => el.textContent?.trim().toLowerCase() === 'governance',
        ),
      );
    });
  });

  test('sorts posts by publish date', async ({ page }) => {
    await page.selectOption('select[name="sort"]', 'asc');
    await expect(page.locator('[data-pagefind-body] h2').first()).toHaveText(/Federated Risk Mesh/);
    await page.selectOption('select[name="sort"]', 'desc');
    await expect(page.locator('[data-pagefind-body] h2').first()).not.toHaveText(
      /Federated Risk Mesh/,
    );
  });
});
