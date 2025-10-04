import { test, expect } from '@playwright/test';

const publishedSlugs = [
  'welcome',
  'aios-architecture',
  'continuous-learning',
  'integration-governance',
  'healthcare-spotlight',
  'federated-risk-mesh',
];

test.describe('blog posts', () => {
  for (const slug of publishedSlugs) {
    test(`${slug} exposes metadata and structured data`, async ({ page }) => {
      await page.goto(`/blog/${slug}/`);
      await expect(page.locator('main article').first()).toBeVisible();
      const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
      const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content');
      const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
      expect(ogTitle).toBeTruthy();
      expect(ogImage).toBeTruthy();
      expect(ogImage).toContain('/images/og/blog/');
      expect(canonical).toContain(`/blog/${slug}/`);
      await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
        'content',
        'summary_large_image',
      );
      const schemaScript = await page
        .locator('script[type="application/ld+json"]')
        .first()
        .innerHTML();
      expect(schemaScript).toContain('"@type":"Article"');
    });
  }

  test('RSS and Atom feeds resolve with entries', async ({ page }) => {
    const rssResponse = await page.request.get('/rss.xml');
    expect(rssResponse.ok()).toBeTruthy();
    const rssText = await rssResponse.text();
    expect(rssText).toContain('<rss');
    expect(rssText).toContain('<item>');

    const atomResponse = await page.request.get('/atom.xml');
    expect(atomResponse.ok()).toBeTruthy();
    const atomText = await atomResponse.text();
    expect(atomText).toContain('<feed');
    expect(atomText).toContain('<entry>');
  });

  test('published posts render CTA panels with routable links', async ({ page }) => {
    await page.goto('/blog/aios-architecture/');
    const cta = page.locator('[data-qa="blog-cta"]');
    await expect(cta).toBeVisible();

    const primary = cta.locator('[data-qa="blog-cta-primary"]');
    await expect(primary).toHaveAttribute('href', '/about/white-papers/#whitepaper-request');

    const primaryHref = await primary.getAttribute('href');
    expect(primaryHref).toBeTruthy();

    const resolvedUrl = new URL(primaryHref ?? '', page.url()).toString();
    const response = await page.request.get(resolvedUrl);
    expect(response.ok()).toBeTruthy();
  });
});
