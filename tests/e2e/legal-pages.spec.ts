import { expect, test } from '@playwright/test';

import { dismissConsentModal, neutralizeAstroDevToolbar } from './utils/page';

const legalPages = [
  {
    path: '/legal/privacy/',
    title: 'Privacy Policy',
    dsarMailto: 'privacy@apotheon.ai',
    expectKlaroLink: false,
  },
  {
    path: '/legal/terms/',
    title: 'Terms of Service',
    dsarMailto: 'privacy@apotheon.ai',
    expectKlaroLink: false,
  },
  {
    path: '/legal/cookie-policy/',
    title: 'Cookie Policy',
    dsarMailto: 'privacy@apotheon.ai',
    expectKlaroLink: true,
  },
] as const;

test.describe('Legal policy surfaces', () => {
  for (const pageDefinition of legalPages) {
    test(`${pageDefinition.title} exposes DSAR hooks and Klaro references`, async ({ page }) => {
      await page.goto(pageDefinition.path);
      await neutralizeAstroDevToolbar(page);
      await dismissConsentModal(page);

      await expect(
        page.getByRole('heading', { level: 1, name: pageDefinition.title }),
      ).toBeVisible();
      await expect(page.locator('#dsar-workflow')).toBeVisible();
      await expect(page.locator('#dsar-workflow')).toContainText('thirty (30)');

      const dsarLink = page.locator(`a[href^="mailto:${pageDefinition.dsarMailto}"]`).first();
      await expect(dsarLink).toBeVisible();
      const hrefValue = await dsarLink.getAttribute('href');
      expect(hrefValue).toBeTruthy();
      expect(hrefValue?.startsWith(`mailto:${pageDefinition.dsarMailto}`)).toBe(true);

      await expect(page.locator('main')).toContainText('Klaro');

      if (pageDefinition.expectKlaroLink) {
        const klaroLink = page.getByRole('link', { name: /Klaro service definitions/i });
        await expect(klaroLink).toHaveAttribute('href', /klaro\.config\.ts/);
      }
    });
  }
});
