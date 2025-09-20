import { expect, test } from '@playwright/test';

test.describe('Law industry detail page', () => {
  test('renders hero context, mapped solutions, and conversion CTAs', async ({ page }) => {
    // Navigate directly to the statically generated route so we exercise the full Astro payload.
    await page.goto('/industries/law/');

    // Hero assertions confirm the structured content rendered and the breadcrumb pipeline executed.
    await expect(
      page.getByRole('heading', { name: 'Confidential AI that accelerates legal matter velocity' }),
    ).toBeVisible();
    await expect(
      page.getByText(
        'ABA-aligned governance, discovery automation, and client collaboration built for law firms and corporate counsel teams managing privileged data.',
      ),
    ).toBeVisible();

    // Ensure each mapped solution resolves to its canonical solution detail route.
    const solutionList = page.locator('#industry-solution-map [data-solution-slug]');
    await expect(solutionList).toHaveCount(3);
    await expect(
      page.locator(
        '#industry-solution-map [data-solution-slug="atlas"] a[href="/solutions/atlas/"]',
      ),
    ).toBeVisible();
    await expect(
      page.locator(
        '#industry-solution-map [data-solution-slug="automation-studio"] a[href="/solutions/automation-studio/"]',
      ),
    ).toBeVisible();
    await expect(
      page.locator(
        '#industry-solution-map [data-solution-slug="governance-lakehouse"] a[href="/solutions/governance-lakehouse/"]',
      ),
    ).toBeVisible();

    // CTA coverage: both demo and whitepaper buttons should inherit the law vertical for analytics.
    const demoCta = page.locator('[data-cta="demo"]');
    await expect(demoCta).toHaveAttribute('href', /vertical=law/);
    const whitepaperCta = page.locator('[data-cta="whitepaper"]');
    await expect(whitepaperCta).toBeVisible();
    await expect(whitepaperCta).toHaveAttribute('href', /apotheon-legal-modernization\.pdf$/);
  });
});
