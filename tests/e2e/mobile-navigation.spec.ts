import { expect, test, type Page } from '@playwright/test';

import {
  dismissConsentModal,
  neutralizeAstroDevToolbar,
  waitForIslandHydration,
} from './utils/page';

test.describe('mobile navigation drawer', () => {
  test('cycles focus through links and restores the trigger', async ({ page }: { page: Page }) => {
    await page.goto('/');
    await neutralizeAstroDevToolbar(page);
    await dismissConsentModal(page);
    await waitForIslandHydration(page, '[data-mobile-nav-ready]', 'data-mobile-nav-ready');

    const trigger = page.getByRole('button', { name: /navigation menu/i });
    await expect(trigger).toBeVisible();

    await trigger.click();

    const drawer = page.getByRole('dialog', { name: 'Mobile navigation' });
    await expect(drawer).toBeVisible();

    const skipToNav = drawer.getByRole('link', { name: 'Skip to navigation links' });
    await expect(skipToNav).toBeVisible();
    await expect(skipToNav).toBeFocused();

    await page.keyboard.press('Tab');

    const firstLink = drawer.getByRole('link', { name: /Clio Orchestration/ });
    await expect(firstLink).toBeFocused();

    await page.keyboard.press('Escape');

    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator(':focus')).toHaveAttribute('aria-label', /navigation menu/i);
  });
});
