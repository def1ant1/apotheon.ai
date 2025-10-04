import { describe, expect, it } from 'vitest';

import {
  buildArticleSchema,
  buildBreadcrumbSchema,
  buildFaqSchema,
  buildHowToSchema,
  buildOrganizationSchema,
  buildSoftwareApplicationSchema,
  buildWebsiteSchema,
  createPageSeo,
  type PageSeoInput,
} from '../seo';

const SITE_ORIGIN = 'https://apotheon.ai';

describe('createPageSeo', () => {
  it('derives canonical URLs and default metadata', () => {
    const input: PageSeoInput = {
      title: 'Example Page',
      description: 'Testing the SEO utility pipeline.',
      path: '/testing/',
      openGraph: {
        images: [
          {
            url: 'https://cdn.example.com/og.png',
            alt: 'OG image',
          },
        ],
      },
    };

    const metadata = createPageSeo(input, { site: SITE_ORIGIN });
    expect(metadata.canonicalUrl).toBe(`${SITE_ORIGIN}/testing/`);
    expect(metadata.title).toBe('Example Page | Apotheon.ai');
    expect(metadata.metaTags.find((tag) => tag.name === 'description')?.content).toBe(
      'Testing the SEO utility pipeline.',
    );
    expect(metadata.linkTags.find((link) => link.rel === 'canonical')?.href).toBe(
      `${SITE_ORIGIN}/testing/`,
    );
    expect(metadata.openGraph.images[0]?.url).toBe('https://cdn.example.com/og.png');
    expect(metadata.twitter.card).toBe('summary_large_image');
    expect(metadata.locale).toBe('en-US');
    expect(metadata.openGraph.locale).toBe('en_US');
    expect(metadata.hreflangs.some((alternate) => alternate.locale === 'x-default')).toBe(true);
  });

  it('supports explicit canonical URLs and noindex directives', () => {
    const metadata = createPageSeo(
      {
        title: 'Hidden Surface',
        description: 'Should not be indexed.',
        canonicalUrl: 'https://mirror.example.com/hidden',
        noindex: true,
      },
      { site: SITE_ORIGIN },
    );

    expect(metadata.canonicalUrl).toBe('https://mirror.example.com/hidden');
    const robotsMeta = metadata.metaTags.find((tag) => tag.name === 'robots');
    expect(robotsMeta?.content).toBe('noindex, nofollow');
  });

  it('merges explicit alternate locales into hreflang metadata', () => {
    const metadata = createPageSeo(
      {
        title: 'Global landing',
        description: 'Locale coverage test.',
        path: '/global/',
        alternates: [
          {
            locale: 'fr-FR',
            path: '/fr/global/',
          },
        ],
      },
      { site: SITE_ORIGIN },
    );

    const hreflangLocales = metadata.hreflangs.map((entry) => entry.locale);
    expect(hreflangLocales).toContain('fr-FR');
    const ogAlternateLocales = metadata.metaTags
      .filter((tag) => tag.property === 'og:locale:alternate')
      .map((tag) => tag.content);
    expect(ogAlternateLocales).toContain('fr_FR');
  });
});

describe('structured data builders', () => {
  it('builds organization schema payloads', () => {
    const schema = buildOrganizationSchema({
      name: 'Apotheon.ai',
      url: SITE_ORIGIN,
      logo: `${SITE_ORIGIN}/logo.svg`,
      sameAs: ['https://www.linkedin.com/company/apotheon-ai'],
    });

    expect(schema).toMatchObject({
      '@type': 'Organization',
      name: 'Apotheon.ai',
      url: SITE_ORIGIN,
      logo: `${SITE_ORIGIN}/logo.svg`,
      inLanguage: 'en-US',
    });
  });

  it('builds software application schema', () => {
    const schema = buildSoftwareApplicationSchema({
      name: 'Nova AI Research Workbench',
      description: 'Experimentation suite for regulated AI workloads.',
      url: `${SITE_ORIGIN}/solutions/nova/`,
      offersUrl: `${SITE_ORIGIN}/about/contact/`,
      image: {
        url: `${SITE_ORIGIN}/static/diagrams/solutions/nova.svg`,
        alt: 'Nova diagram',
      },
      featureList: ['Experiment tracking', 'Guardrail automation'],
    });

    expect(schema).toMatchObject({
      '@type': 'SoftwareApplication',
      name: 'Nova AI Research Workbench',
      offers: {
        url: `${SITE_ORIGIN}/about/contact/`,
      },
      featureList: ['Experiment tracking', 'Guardrail automation'],
      inLanguage: 'en-US',
    });
  });

  it('builds article schema payloads', () => {
    const schema = buildArticleSchema({
      headline: 'Scaling AI responsibly',
      description: 'Case studies and governance playbooks.',
      url: `${SITE_ORIGIN}/blog/scaling-ai/`,
      publishedTime: '2024-01-01T00:00:00.000Z',
      modifiedTime: '2024-01-15T00:00:00.000Z',
      authorName: 'Jordan Rivera',
      authorTitle: 'Principal Architect',
      image: `${SITE_ORIGIN}/images/og/blog/scaling-ai.svg`,
      tags: ['governance'],
      readingTimeMinutes: 8,
    });

    expect(schema).toMatchObject({
      '@type': 'Article',
      headline: 'Scaling AI responsibly',
      mainEntityOfPage: {
        '@id': `${SITE_ORIGIN}/blog/scaling-ai/`,
      },
      author: {
        name: 'Jordan Rivera',
      },
      inLanguage: 'en-US',
    });
  });

  it('builds breadcrumb schema', () => {
    const schema = buildBreadcrumbSchema(
      [
        { label: 'Home', href: '/' },
        { label: 'Blog', href: '/blog/' },
        { label: 'Scaling AI responsibly', href: '/blog/scaling-ai/' },
      ],
      SITE_ORIGIN,
    );

    expect(schema).toMatchObject({
      '@type': 'BreadcrumbList',
      inLanguage: 'en-US',
    });
    expect(schema.itemListElement).toHaveLength(3);
  });

  it('builds FAQ schema payloads', () => {
    const schema = buildFaqSchema([
      {
        question: 'How fast is onboarding?',
        answer: 'Most pilots reach production in under 45 days.',
      },
    ]);

    expect(schema).toMatchObject({
      '@type': 'FAQPage',
      mainEntity: [
        {
          name: 'How fast is onboarding?',
        },
      ],
      inLanguage: 'en-US',
    });
  });

  it('builds HowTo schema payloads', () => {
    const schema = buildHowToSchema({
      name: 'Provision research sandbox access',
      description: 'Steps researchers follow before activating Nova tenants.',
      steps: [
        {
          name: 'Request access',
          text: 'Submit the sandbox form with research intent metadata.',
          url: `${SITE_ORIGIN}/about/contact/?team=research`,
        },
        {
          name: 'Validate corpora',
          text: 'Execute npm run ensure:research-intake -- --dry-run to emit manifests.',
        },
      ],
    });

    expect(schema).toMatchObject({
      '@type': 'HowTo',
      name: 'Provision research sandbox access',
      step: [
        { '@type': 'HowToStep', position: 1 },
        { '@type': 'HowToStep', position: 2 },
      ],
      inLanguage: 'en-US',
    });
  });

  it('builds website schema', () => {
    const schema = buildWebsiteSchema({
      url: SITE_ORIGIN,
      description: 'Composable Astro architecture ready for enterprise scale.',
    });

    expect(schema).toMatchObject({
      '@type': 'WebSite',
      url: SITE_ORIGIN,
      inLanguage: 'en-US',
    });
  });
});
