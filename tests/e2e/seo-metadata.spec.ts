import { expect, test } from '@playwright/test';

test.describe('seo metadata', () => {
  test('home page exposes canonical link and structured data', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /https:\/\/.*\//);
    await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute(
      'href',
      /https:\/\/.*\//,
    );
    await expect(page.locator('link[rel="alternate"][hreflang="en-US"]')).toHaveAttribute(
      'href',
      /https:\/\/.*\//,
    );
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description).toBeTruthy();
    expect(description).toMatch(
      /Deploy orchestrations across 42 cloud regions|Operational intelligence/,
    );
    const schemaCount = await page.locator('script[type="application/ld+json"]').count();
    expect(schemaCount).toBeGreaterThan(0);
  });

  test('blog article publishes article metadata', async ({ page }) => {
    await page.goto('/blog/federated-risk-mesh/');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      /\/blog\/federated-risk-mesh\//,
    );
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'article');
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      'content',
      'summary_large_image',
    );
    const schemaNodes = page.locator('script[type="application/ld+json"]');
    expect(await schemaNodes.count()).toBeGreaterThanOrEqual(2);
  });

  test('solution detail references software application schema', async ({ page }) => {
    // Automation guard: hitting Mnemosyne validates the renamed activation slug and keeps schema assertions future-proof.
    await page.goto('/solutions/mnemosyne/');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      /\/solutions\/mnemosyne\//,
    );
    const schemaPayloads = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents();
    expect(schemaPayloads.some((payload) => payload.includes('"SoftwareApplication"'))).toBe(true);
  });

  test('BWCCUM detail page exposes canonical metadata and description', async ({ page }) => {
    await page.goto('/solutions/bwccum/');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      /\/solutions\/bwccum\//,
    );
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      /centralizes policy orchestration/i,
    );
  });
});
