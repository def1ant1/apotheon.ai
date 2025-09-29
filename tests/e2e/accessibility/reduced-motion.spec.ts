import { expect, test } from '@playwright/test';

import { dismissConsentModal, neutralizeAstroDevToolbar } from '../utils/page';

const TIMELINE_ROUTE = '/about/history/';
/* Timeline cards animate into view as our marquee/ticker pattern for historical milestones. */
const TIMELINE_CARD_SELECTOR = "[data-animate='timeline-card']";

test.describe('prefers-reduced-motion compliance', () => {
  test('halts marquee card transitions when the user requests reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto(TIMELINE_ROUTE);
    await neutralizeAstroDevToolbar(page);
    await dismissConsentModal(page);

    const marqueeCard = page.locator(TIMELINE_CARD_SELECTOR).first();
    await expect(marqueeCard).toBeVisible();
    const defaultTransition = await marqueeCard.evaluate(
      (element) => getComputedStyle(element).transitionDuration,
    );
    expect(Number.parseFloat(defaultTransition)).toBeGreaterThan(0.5);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await neutralizeAstroDevToolbar(page);
    await dismissConsentModal(page);
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
