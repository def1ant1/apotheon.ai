import { expect, test } from '@playwright/test';

test.describe('solution detail page', () => {
  test('renders structured sections with analytics-friendly anchors', async ({ page }) => {
    await page.goto('/solutions/clio/');

    await expect(
      page.getByRole('heading', { level: 1, name: /Clio Revenue Intelligence Platform/i }),
    ).toBeVisible();

    const sections = [
      '#solutions-hero',
      '#solutions-key-features',
      '#solutions-how-it-works',
      '#solutions-diagram',
      '#solutions-use-cases',
      '#solutions-cross-links',
      '#solutions-final-cta',
    ];

    for (const selector of sections) {
      await expect(page.locator(selector)).toBeVisible();
    }

    const h2Sequence = (await page.locator('main h2').allTextContents()).map((heading) =>
      heading.trim(),
    );
    expect(h2Sequence).toEqual([
      'Solution overview',
      'Key features',
      'How it works',
      'Architecture at a glance',
      'Use cases',
      'Related resources',
      'Ready to operationalize board-grade forecasting?',
    ]);

    const heroPrimaryCta = page.locator('#solutions-hero a').first();
    await expect(heroPrimaryCta).toHaveAttribute('href', '/about/contact/');

    const crossLinkAnchors = page.locator('#solutions-cross-links a');
    await expect(crossLinkAnchors).toHaveCount(3);
    await expect(crossLinkAnchors.nth(0)).toHaveAttribute('href', /\//);

    const diagram = page.getByRole('img', {
      name: /Clio pipeline bringing CRM signals into the forecast engine/i,
    });
    await diagram.scrollIntoViewIfNeeded();
    await expect(diagram).toBeVisible();
    const caption = page.getByText(
      /Clio unifies CRM pipeline data, the forecasting engine, and executive narratives/i,
    );
    await expect(caption).toBeVisible();

    const finalCtaPrimary = page.locator('#solutions-final-cta a').first();
    await expect(finalCtaPrimary).toHaveAttribute('href', '/about/contact/');
  });
});
