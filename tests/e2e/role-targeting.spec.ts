import { test, expect } from '@playwright/test';

test.describe('role-targeted experiences', () => {
  test('homepage surfaces developer preset when role=dev', async ({ page }) => {
    await page.goto('/?role=dev');

    await expect(page.getByText("You're viewing the Platform & AI engineers path")).toBeVisible();

    const primaryCta = page.getByRole('link', {
      name: 'Open the developer automation workflows in the handbook',
    });
    await expect(primaryCta).toHaveAttribute('href', '/docs/dev/workflows/');

    await expect(page.getByRole('link', { name: 'Book a technical deep dive' })).toHaveAttribute(
      'href',
      '/contact/?team=solutions-engineering&role=dev',
    );
  });

  test('docs landing surfaces security preset when role=security', async ({ page }) => {
    await page.goto('/docs/?role=security');

    await expect(
      page.getByText('Role-tuned recommendations for Security & risk leaders'),
    ).toBeVisible();

    const docsCta = page.getByRole('link', { name: 'Open recommended guide →' });
    await expect(docsCta).toHaveAttribute('href', '/docs/security/incident-response/');
  });
});
