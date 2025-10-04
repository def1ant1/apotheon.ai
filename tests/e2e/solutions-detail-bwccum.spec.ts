import { expect, test } from '@playwright/test';

test.describe('BWC-CUM solution detail page', () => {
  test('renders control mesh narrative with automation cross-links', async ({ page }) => {
    await page.goto('/solutions/bwccum/');

    await expect(
      page.getByRole('heading', { level: 1, name: /BWC-CUM Autonomous Control Mesh/i }),
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

    const headings = (await page.locator('main h2').allTextContents()).map((heading) =>
      heading.trim(),
    );
    expect(headings).toEqual([
      'Solution overview',
      'Key features',
      'How it works',
      'Architecture at a glance',
      'Use cases',
      'Related resources',
      'Automate controls, prove compliance in real time',
    ]);

    const heroPrimaryCta = page.locator('#solutions-hero a').first();
    await expect(heroPrimaryCta).toHaveAttribute('href', '/about/contact/');
    await expect(heroPrimaryCta).toContainText(/Schedule control mesh review/i);

    const crossLinkAnchors = page.locator('#solutions-cross-links a');
    await expect(crossLinkAnchors).toHaveCount(3);
    await expect(crossLinkAnchors.nth(0)).toHaveAttribute('href', '/solutions/morpheus/');
    await expect(crossLinkAnchors.nth(1)).toHaveAttribute('href', '/solutions/hermes/');

    const diagram = page.getByRole('img', {
      name: /control mesh orchestrating policy libraries/i,
    });
    await diagram.scrollIntoViewIfNeeded();
    await expect(diagram).toBeVisible();

    const finalCtaPrimary = page.locator('#solutions-final-cta a').first();
    await expect(finalCtaPrimary).toHaveAttribute('href', '/about/contact/');
    await expect(finalCtaPrimary).toContainText(/Book a control automation workshop/i);
  });
});
