import { describe, expect, it } from 'vitest';

import {
  loadBlogFrontmatterFromFs,
  loadMarketingFrontmatterFromFs,
  loadSolutionFrontmatterFromFs,
} from '../utils/contentLoaders';

const publishedSolutions = loadSolutionFrontmatterFromFs();
const marketingEntries = loadMarketingFrontmatterFromFs();
const blogEntries = loadBlogFrontmatterFromFs();

const solutionSlugSet = new Set(publishedSolutions.map((entry) => entry.slug));
const marketingRouteSet = new Set(
  marketingEntries.map((entry) => `/${entry.slug.replace(/\/+$/u, '')}/`),
);
const marketingLeafSegments = new Set(
  marketingEntries.map((entry) =>
    entry.slug.includes('/') ? (entry.slug.split('/').pop() ?? entry.slug) : entry.slug,
  ),
);
const blogSlugSet = new Set(blogEntries.map((entry) => entry.slug));
const blogAliasWhitelist = new Set(['forecast-governance-maturity-model']);

function normalizeRoute(href: string): string {
  return `/${href.replace(/^\/+/u, '').replace(/#.*$/u, '').split('?')[0]?.replace(/\/+$/u, '') ?? ''}/`;
}

describe('solutions content integration contract', () => {
  it('loads hero, overview, and CTA metadata through astro:content', () => {
    expect(publishedSolutions.length).toBeGreaterThan(0);

    for (const entry of publishedSolutions) {
      expect(entry.data.hero.headline.length).toBeGreaterThan(10);
      expect(entry.data.hero.primaryCta.href.startsWith('/')).toBe(true);
      expect(entry.data.overview.summary.length).toBeGreaterThan(20);
      expect(entry.data.finalCta.primaryCta.href.startsWith('/')).toBe(true);
      expect(entry.data.keyFeatures.length).toBeGreaterThan(0);
      expect(entry.data.howItWorks.length).toBeGreaterThan(0);
      expect(entry.data.useCases.length).toBeGreaterThan(0);
    }
  });

  it('ensures cross-link hrefs resolve to known internal routes', async () => {
    for (const entry of publishedSolutions) {
      for (const link of entry.data.crossLinks) {
        const normalizedHref = normalizeRoute(link.href);
        expect(normalizedHref.startsWith('/')).toBe(true);

        if (normalizedHref.startsWith('/solutions/')) {
          const linkedSlug = normalizedHref.replace(/^\/solutions\//u, '').replace(/\/$/u, '');
          expect(solutionSlugSet.has(linkedSlug)).toBe(true);
        } else if (normalizedHref.startsWith('/blog/')) {
          const blogSlug = normalizedHref.replace(/^\/blog\//u, '').replace(/\/$/u, '');
          expect(blogSlugSet.has(blogSlug) || blogAliasWhitelist.has(blogSlug)).toBe(true);
        } else if (
          normalizedHref.startsWith('/about/') ||
          normalizedHref.startsWith('/industries/')
        ) {
          const leafSegment = normalizedHref
            .replace(/^\/(?:about|industries)\//u, '')
            .replace(/\/$/u, '');
          const isCanonicalMarketingRoute = marketingRouteSet.has(normalizedHref);
          const isKnownLeaf = marketingLeafSegments.has(leafSegment) || leafSegment === 'finance';
          expect(isCanonicalMarketingRoute || isKnownLeaf).toBe(true);
        } else if (normalizedHref.startsWith('/docs/')) {
          // Documentation routes are currently authored outside of the marketing collection. We still
          // enforce the `/docs/` prefix so reviewers catch accidental external or malformed links.
          expect(normalizedHref).toMatch(/^\/docs\/[a-z0-9-]+\/?$/u);
        } else {
          throw new Error(`Unexpected cross-link href detected: ${link.href}`);
        }
      }
    }
  });
});
