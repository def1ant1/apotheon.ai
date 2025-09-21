import { test, expect } from '@playwright/test';

test.describe('blog analytics instrumentation', () => {
  test('blog index dispatches interaction beacons', async ({ page }) => {
    const captured: unknown[] = [];

    await page.route('**/api/blog/analytics', async (route, request) => {
      const body = request.postData();
      if (body) {
        captured.push(JSON.parse(body));
      }
      await route.fulfill({ status: 202, body: JSON.stringify({ status: 'ok' }) });
    });

    await page.goto('/blog');
    await page.selectOption('select[name="tag"]', { index: 1 });

    await expect(async () => {
      expect(captured.length).toBeGreaterThan(0);
    }).toPass();
  });

  test('blog post emits view + conversion events', async ({ page }) => {
    const events: Array<{ status?: string; events?: unknown }> = [];

    await page.route('**/api/blog/analytics', async (route, request) => {
      const body = request.postData();
      if (body) {
        events.push(JSON.parse(body));
      }
      await route.fulfill({ status: 202, body: JSON.stringify({ status: 'ok' }) });
    });

    await page.goto('/blog/welcome/');
    await page.waitForTimeout(500);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    const flattened = events.flatMap((entry: any) => entry.events ?? []);
    expect(flattened.some((event: any) => event.type === 'article_view')).toBeTruthy();
    expect(flattened.some((event: any) => event.type === 'conversion')).toBeTruthy();
  });
});
