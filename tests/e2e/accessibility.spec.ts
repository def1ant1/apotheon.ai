import { expect, test, type Page } from '@playwright/test';

import { setTheme, stabilizePageChrome, waitForIslandHydration } from './utils/page';

const viewports: Record<string, { width: number; height: number }> = {
  desktop: { width: 1280, height: 720 },
  mobile: { width: 375, height: 812 },
};

async function prepareViewport(page: Page, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
}

async function gotoAndPrepare(page: Page, path: string) {
  await page.goto(path);
  await stabilizePageChrome(page);
  await setTheme(page, 'light');
}

test.describe('accessibility regression flows', () => {
  for (const [label, viewport] of Object.entries(viewports)) {
    test.describe(`${label} viewport`, () => {
      test.beforeEach(async ({ page }) => {
        await prepareViewport(page, viewport);
      });

      test('skip link lands focus on main content', async ({ page }) => {
        await gotoAndPrepare(page, '/');

        const skipLink = page.getByRole('link', { name: /skip to content/i });
        await skipLink.focus();
        await expect(skipLink).toBeFocused();

        await skipLink.press('Enter');
        const main = page.locator('#main');
        await expect(main).toBeFocused();
      });

      test('primary navigation is operable via keyboard', async ({ page }) => {
        await gotoAndPrepare(page, '/');

        if (label === 'mobile') {
          await waitForIslandHydration(page, '[data-mobile-nav-ready]', 'data-mobile-nav-ready');
          const menuButton = page.getByRole('button', { name: /open navigation menu/i });
          await menuButton.focus();
          await menuButton.press('Enter');

          const drawer = page.getByRole('dialog', { name: /mobile navigation/i });
          await expect(drawer).toBeVisible();

          const skipToLinks = drawer.getByRole('link', { name: /skip to navigation links/i });
          await expect(skipToLinks).toBeFocused();
          await page.keyboard.press('Tab');
          const firstLink = drawer.getByRole('link', { name: /Clio Orchestration/i });
          await expect(firstLink).toBeFocused();

          await page.keyboard.press('Escape');
          await expect(menuButton).toBeFocused();
          await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
        } else {
          await waitForIslandHydration(page, '[data-navigation-ready]', 'data-navigation-ready');
          const trigger = page.getByRole('button', { name: 'Platform' });
          await trigger.focus();
          await trigger.press('Enter');

          const navPanel = page.locator('.navigation-content').first();
          await expect(navPanel).toBeVisible();
          const firstLink = navPanel.getByRole('link', { name: /Clio Orchestration/i });
          await expect(firstLink).toBeVisible();
          await page.keyboard.press('ArrowDown');
          await expect(firstLink).toBeFocused();

          await page.keyboard.press('Escape');
          await expect(trigger).toBeFocused();
          await expect(trigger).toHaveAttribute('aria-expanded', 'false');
        }
      });

      test('form validation messaging announces issues', async ({ page }) => {
        await gotoAndPrepare(page, '/about/contact/');
        await waitForIslandHydration(page, 'form[aria-labelledby][data-js-ready]');

        const submit = page.getByRole('button', { name: /send message/i });
        await submit.focus();
        await page.keyboard.press('Enter');

        const status = page.getByRole('status');
        await expect(status).toContainText(/verification challenge/i);
      });
    });
  }
});
