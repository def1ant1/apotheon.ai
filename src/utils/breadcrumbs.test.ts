import { describe, expect, it } from 'vitest';

import {
  BREADCRUMB_ARIA_LABEL,
  createBlogIndexTrail,
  createBlogPostTrail,
  createDocsEntryTrail,
  createDocsIndexTrail,
  createMarketingEntryTrail,
  createMarketingIndexTrail,
  createSolutionsEntryTrail,
  createNestedTrail,
  normalizeTrail,
  trailToJsonLd,
  serializeTrailToJsonLd,
  type EntryWithTitle,
} from './breadcrumbs';

const marketingEntry = (slug: string, title: string): EntryWithTitle => ({
  slug,
  data: { title },
});

const blogEntry = (slug: string, title: string): EntryWithTitle => ({
  slug,
  data: { title },
});

const docEntry = (slug: string, title: string): EntryWithTitle => ({
  slug,
  data: { title },
});

describe('breadcrumbs utilities', () => {
  it('enforces home → section → entry ordering for solutions detail pages', () => {
    const trail = createSolutionsEntryTrail(marketingEntry('nova', 'Nova AI Workbench'));

    expect(trail).toEqual([
      { href: '/', label: 'Home', isCurrentPage: false },
      { href: '/solutions/', label: 'Solutions', isCurrentPage: false },
      { href: '/solutions/nova/', label: 'Nova AI Workbench', isCurrentPage: true },
    ]);
  });

  it('supports nested marketing directories without manual arrays', () => {
    const trail = createMarketingEntryTrail(
      marketingEntry('about/team/leadership', 'Executive Leadership'),
    );

    expect(trail).toEqual([
      { href: '/', label: 'Home', isCurrentPage: false },
      { href: '/about/', label: 'About', isCurrentPage: false },
      { href: '/about/team/', label: 'Team', isCurrentPage: false },
      { href: '/about/team/leadership/', label: 'Executive Leadership', isCurrentPage: true },
    ]);
  });

  it('builds landing trails for each marketing section automatically', () => {
    expect(createMarketingIndexTrail('solutions')).toEqual([
      { href: '/', label: 'Home', isCurrentPage: false },
      { href: '/solutions/', label: 'Solutions', isCurrentPage: true },
    ]);

    expect(createMarketingIndexTrail('industries')).toEqual([
      { href: '/', label: 'Home', isCurrentPage: false },
      { href: '/industries/', label: 'Industries', isCurrentPage: true },
    ]);

    expect(createMarketingIndexTrail('research')).toEqual([
      { href: '/', label: 'Home', isCurrentPage: false },
      { href: '/research/', label: 'Research', isCurrentPage: true },
    ]);
  });

  it('builds blog index and detail trails that reuse collection metadata', () => {
    expect(createBlogIndexTrail()).toEqual([
      { href: '/', label: 'Home', isCurrentPage: false },
      { href: '/blog/', label: 'Blog', isCurrentPage: true },
    ]);

    const blogTrail = createBlogPostTrail(blogEntry('automation-roadmap', 'Automation Roadmap'));
    expect(blogTrail).toEqual([
      { href: '/', label: 'Home', isCurrentPage: false },
      { href: '/blog/', label: 'Blog', isCurrentPage: false },
      { href: '/blog/automation-roadmap', label: 'Automation Roadmap', isCurrentPage: true },
    ]);
  });

  it('serializes deterministic JSON-LD payloads with canonical origins', () => {
    const trail = createBlogPostTrail(blogEntry('ai-governance', 'AI Governance'));
    const ldObject = trailToJsonLd(trail, 'https://apotheon.ai');
    const json = serializeTrailToJsonLd(trail, 'https://apotheon.ai');

    expect(ldObject['@type']).toBe('BreadcrumbList');
    expect(ldObject.itemListElement).toHaveLength(3);
    expect(ldObject.itemListElement[2]).toEqual({
      '@type': 'ListItem',
      position: 3,
      name: 'AI Governance',
      item: 'https://apotheon.ai/blog/ai-governance',
    });
    expect(json).toBe(JSON.stringify(ldObject, null, 2));
  });

  it('exposes docs index and entry trails that mirror handbook slugs', () => {
    expect(createDocsIndexTrail()).toEqual([
      { href: '/', label: 'Home', isCurrentPage: false },
      { href: '/docs/', label: 'Docs', isCurrentPage: true },
    ]);

    const trail = createDocsEntryTrail(docEntry('dev/workflows', 'Contact submission workflow'));
    expect(trail).toEqual([
      { href: '/', label: 'Home', isCurrentPage: false },
      { href: '/docs/', label: 'Docs', isCurrentPage: false },
      { href: '/docs/dev/', label: 'Dev', isCurrentPage: false },
      { href: '/docs/dev/workflows/', label: 'Contact submission workflow', isCurrentPage: true },
    ]);
  });

  it('normalizes arbitrary trails so only the terminal crumb is marked current', () => {
    const rawTrail = [
      { href: '/', label: 'Home' },
      { href: '/blog/', label: 'Blog', isCurrentPage: true },
      { label: 'Drafts' },
    ];

    expect(normalizeTrail(rawTrail, false)).toEqual([
      { href: '/', label: 'Home', isCurrentPage: false },
      { href: '/blog/', label: 'Blog', isCurrentPage: false },
      { label: 'Drafts', isCurrentPage: true },
    ]);
  });

  it('exposes nested trail builder for future IA nodes', () => {
    const trail = createNestedTrail('about', [{ href: '/about/research/', label: 'Research' }], {
      href: '/about/research/ai-labs/',
      label: 'AI Labs',
    });

    expect(trail).toEqual([
      { href: '/', label: 'Home', isCurrentPage: false },
      { href: '/about/', label: 'About', isCurrentPage: false },
      { href: '/about/research/', label: 'Research', isCurrentPage: false },
      { href: '/about/research/ai-labs/', label: 'AI Labs', isCurrentPage: true },
    ]);
  });

  it('exports a single aria-label constant for accessibility assertions', () => {
    expect(BREADCRUMB_ARIA_LABEL).toBe('Breadcrumb');
  });
});
