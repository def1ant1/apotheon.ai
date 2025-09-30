import { expect, test, type Page } from '@playwright/test';

import { stabilizePageChrome, setTheme } from './utils/page';

async function prepare(page: Page, motion: 'reduce' | 'no-preference') {
  await page.emulateMedia({ reducedMotion: motion });
  await page.goto('/');
  await stabilizePageChrome(page);
  await setTheme(page, 'light');
}

test.describe('site header skip link motion contract', () => {
  test('smooth scroll and managed focus under normal motion', async ({ page }) => {
    await prepare(page, 'no-preference');

    const skipLink = page.getByRole('link', { name: /skip to content/i });

    const scrollBehavior = await page.evaluate(
      () => getComputedStyle(document.documentElement).scrollBehavior,
    );
    expect(scrollBehavior).toBe('smooth');

    await page.evaluate(() => window.scrollTo(0, 400));

    await skipLink.focus();
    await skipLink.press('Enter');

    const main = page.locator('#main');
    await expect(main).toBeFocused();

    const { scrollY, topOffset } = await page.evaluate(() => {
      const mainEl = document.getElementById('main');
      return {
        scrollY: window.scrollY,
        topOffset: mainEl ? mainEl.getBoundingClientRect().top : Number.POSITIVE_INFINITY,
      };
    });
    expect(scrollY).toBeLessThan(160);
    expect(topOffset).toBeLessThan(80);

    const hash = await page.evaluate(() => window.location.hash);
    expect(hash).toBe('#main');
  });

  test('instant scroll and managed focus when reduced motion is requested', async ({ page }) => {
    await prepare(page, 'reduce');

    const skipLink = page.getByRole('link', { name: /skip to content/i });

    const scrollBehavior = await page.evaluate(
      () => getComputedStyle(document.documentElement).scrollBehavior,
    );
    expect(scrollBehavior).toBe('auto');

    await page.evaluate(() => window.scrollTo(0, 400));

    await skipLink.focus();
    await skipLink.press('Enter');

    const main = page.locator('#main');
    await expect(main).toBeFocused();

    const { scrollY, topOffset } = await page.evaluate(() => {
      const mainEl = document.getElementById('main');
      return {
        scrollY: window.scrollY,
        topOffset: mainEl ? mainEl.getBoundingClientRect().top : Number.POSITIVE_INFINITY,
      };
    });
    expect(scrollY).toBeLessThan(160);
    expect(topOffset).toBeLessThan(80);

    const hash = await page.evaluate(() => window.location.hash);
    expect(hash).toBe('#main');
  });
});
