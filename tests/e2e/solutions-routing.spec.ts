import { expect, test } from '@playwright/test';

import { loadSolutionFrontmatterFromFs } from '../utils/contentLoaders';

/**
 * Published solution entries drive the dynamic `/solutions/<slug>/` routes. Reading the
 * MDX frontmatter here keeps the E2E suite aligned with the actual content roster without
 * requiring engineers to hand-maintain fixture arrays whenever new solutions ship.
 */
const publishedSolutions = loadSolutionFrontmatterFromFs();

/**
 * Every solution detail page renders a predictable stack of anchored sections. Centralizing
 * the identifiers ensures the smoke test asserts anchor visibility and avoids regressions
 * where markup changes silently break navigation or analytics fragments.
 */
const SECTION_ANCHORS = [
  '#solutions-hero',
  '#solutions-key-features',
  '#solutions-how-it-works',
  '#solutions-diagram',
  '#solutions-use-cases',
  '#solutions-cross-links',
  '#solutions-final-cta',
];

test.describe('solutions routing smoke coverage', () => {
  for (const solution of publishedSolutions) {
    const route = `/solutions/${solution.slug}/`;

    test.describe(`${solution.slug} route`, () => {
      test(`anchors, diagrams, and CTA targets stay aligned with frontmatter for ${solution.slug}`, async ({
        page,
      }) => {
        await test.step('navigate to the solution route', async () => {
          await page.goto(route);
        });

        await test.step('validate hero headline mirrors structured frontmatter copy', async () => {
          await expect(
            page.getByRole('heading', { level: 1, name: solution.data.hero.headline }),
          ).toBeVisible();
        });

        await test.step('ensure every anchored section renders for in-page navigation + analytics hooks', async () => {
          for (const anchor of SECTION_ANCHORS) {
            await expect(page.locator(anchor)).toBeVisible();
          }
        });

        await test.step('confirm primary CTAs preserve their expected destinations', async () => {
          const heroPrimaryCta = page.locator('#solutions-hero a').first();
          await expect(heroPrimaryCta).toHaveAttribute('href', solution.data.hero.primaryCta.href);
          await expect(heroPrimaryCta).toContainText(solution.data.hero.primaryCta.label, {
            useInnerText: true,
          });

          const finalCtaPrimary = page.locator('#solutions-final-cta a').first();
          await expect(finalCtaPrimary).toHaveAttribute(
            'href',
            solution.data.finalCta.primaryCta.href,
          );
          await expect(finalCtaPrimary).toContainText(solution.data.finalCta.primaryCta.label, {
            useInnerText: true,
          });
        });

        await test.step('exercise architecture diagram metadata to guard against alt/caption regressions', async () => {
          const diagramImage = page.locator('#solutions-diagram img[alt]').first();
          await diagramImage.scrollIntoViewIfNeeded();
          await expect(diagramImage).toBeVisible();
          await expect(diagramImage).toHaveAttribute('alt', solution.data.diagram.alt);
        });

        await test.step('cross-link stack should mirror the curated resources declared in frontmatter', async () => {
          const crossLinkAnchors = page.locator('#solutions-cross-links a');
          await expect(crossLinkAnchors).toHaveCount(solution.data.crossLinks.length);

          for (const [index, crossLink] of solution.data.crossLinks.entries()) {
            const anchor = crossLinkAnchors.nth(index);
            await expect(anchor).toHaveAttribute('href', crossLink.href);
            await expect(anchor).toContainText(crossLink.label, { useInnerText: true });
          }
        });
      });
    });
  }
});
