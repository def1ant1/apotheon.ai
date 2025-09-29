import { expect, test } from '@playwright/test';

import { forceReducedMotion, setTheme, stabilizePageChrome } from '../utils/page';

const TIMELINE_ROUTE = '/about/history/';
/* Timeline cards animate into view as our marquee/ticker pattern for historical milestones. */
const TIMELINE_CARD_SELECTOR = "[data-animate='timeline-card']";

test.describe('prefers-reduced-motion compliance', () => {
  test('halts marquee card transitions when the user requests reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto(TIMELINE_ROUTE);
    await stabilizePageChrome(page, { reducedMotion: false });
    await setTheme(page, 'light');

    const marqueeCard = page.locator(TIMELINE_CARD_SELECTOR).first();
    await expect(marqueeCard).toBeVisible();
    const defaultTransition = await marqueeCard.evaluate(
      (element) => getComputedStyle(element).transitionDuration,
    );
    expect(Number.parseFloat(defaultTransition)).toBeGreaterThan(0.5);

    await forceReducedMotion(page);
    await page.reload();
    await stabilizePageChrome(page);
    await setTheme(page, 'light');
    const reducedTransition = await marqueeCard.evaluate(
      (element) => getComputedStyle(element).transitionDuration,
    );
    expect(Number.parseFloat(reducedTransition)).toBeLessThan(0.05);

    const reducedScrollBehavior = await page.evaluate(
      () => getComputedStyle(document.documentElement).scrollBehavior,
    );
    expect(reducedScrollBehavior).toBe('auto');
  });
});
