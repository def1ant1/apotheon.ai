import { SEO_MANIFEST } from '../../config/seo/manifest.mjs';

import type { BreadcrumbTrail } from './breadcrumbs';

/**
 * Common contract for JSON-LD payloads injected via SchemaScript.
 * Keeping this type close to the helper utilities ensures consumers across
 * Astro, Vitest, and Playwright all agree on the payload shape.
 */
export type StructuredSchema = Record<string, unknown>;

/**
 * Describes an image candidate surfaced in OpenGraph or Twitter metadata.
 */
export interface SeoImage {
  url: string;
  alt?: string;
  width?: number;
  height?: number;
}

/**
 * Optional alternate locale definition for hreflang tags.
 */
export interface LocaleAlternate {
  locale: string;
  href?: string;
  path?: string;
}

/**
 * Caller-provided inputs used to derive document-level metadata.
 */
export interface PageSeoInput {
  /**
   * Human-readable page title. The helper appends the site name automatically
   * to keep <title> construction consistent.
   */
  title: string;
  /**
   * Meta description summarising the page. Required so we can fail fast when
   * product teams forget to author copy.
   */
  description: string;
  /**
   * Optional canonical path when the caller wants to override Astro.url.
   */
  path?: string;
  /**
   * Fully-qualified canonical URL. Useful for cross-domain surfaces where the
   * path-based helper would misfire.
   */
  canonicalUrl?: string;
  /**
   * Allow pages to opt out of the trailing slash convention (e.g. error pages
   * or file downloads).
   */
  trailingSlash?: boolean;
  /**
   * Override the site name appended to the <title>. Falls back to the manifest
   * site name so we only change copy in one spot.
   */
  siteName?: string;
  /**
   * Primary locale for the page. Impacts OG locale + hreflang defaults.
   */
  locale?: string;
  /**
   * Additional hreflang alternates surfaced alongside the canonical entry.
   */
  alternates?: LocaleAlternate[];
  /**
   * Signals that the page should not be indexed. Robots meta is injected when
   * this flag is true.
   */
  noindex?: boolean;
  openGraph?: {
    type?: string;
    siteName?: string;
    title?: string;
    description?: string;
    locale?: string;
    images?: SeoImage[];
    image?: SeoImage;
    publishedTime?: string | Date;
    modifiedTime?: string | Date;
    section?: string;
    tags?: string[];
  };
  twitter?: {
    card?: 'summary' | 'summary_large_image';
    site?: string;
    creator?: string;
    image?: string;
  };
}

export interface MetaTagDescriptor {
  name?: string;
  property?: string;
  content: string;
}

export interface LinkTagDescriptor {
  rel: string;
  href: string;
  hreflang?: string;
}

export interface HreflangAlternate {
  locale: string;
  href: string;
  isDefault?: boolean;
}

export interface ResolvedOpenGraphMetadata {
  type: string;
  url: string;
  title: string;
  description: string;
  siteName: string;
  locale: string;
  images: SeoImage[];
  publishedTime?: string;
  modifiedTime?: string;
  section?: string;
  tags?: string[];
}

export interface ResolvedTwitterMetadata {
  card: 'summary' | 'summary_large_image';
  title: string;
  description: string;
  image?: string;
  site?: string;
  creator?: string;
}

export interface PageSeoMetadata {
  title: string;
  description: string;
  canonicalUrl: string;
  siteName: string;
  locale: string;
  hreflangs: HreflangAlternate[];
  openGraph: ResolvedOpenGraphMetadata;
  twitter: ResolvedTwitterMetadata;
  metaTags: MetaTagDescriptor[];
  linkTags: LinkTagDescriptor[];
  noindex: boolean;
}

const DEFAULT_SITE_NAME = 'Apotheon.ai';
const DEFAULT_TWITTER_CARD: ResolvedTwitterMetadata['card'] = 'summary_large_image';
const DEFAULT_LOCALE = 'en-US';

function normaliseSiteUrl(candidate?: string | URL | null): URL {
  if (!candidate) {
    return new URL(SEO_MANIFEST.site);
  }

  if (candidate instanceof URL) {
    return candidate;
  }

  return new URL(candidate);
}

function ensureLeadingSlash(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

function ensureTrailingSlash(path: string, enabled: boolean): string {
  if (!enabled) {
    return path;
  }

  const [cleanPath] = path.split(/[?#]/u);
  if (!cleanPath) {
    return path;
  }

  if (cleanPath.endsWith('/')) {
    return path;
  }

  if (cleanPath.includes('.')) {
    return path;
  }

  return `${path}/`;
}

function resolveCanonical({
  path,
  canonicalUrl,
  trailingSlash = true,
  site,
  fallbackPath,
}: {
  path?: string;
  canonicalUrl?: string;
  trailingSlash?: boolean;
  site?: string | URL | null;
  fallbackPath?: string;
}): string {
  const siteUrl = normaliseSiteUrl(site);

  if (canonicalUrl) {
    const absolute = new URL(canonicalUrl, siteUrl);
    return absolute.toString();
  }

  const resolvedPath = path ?? fallbackPath ?? '/';
  const normalisedPath = ensureTrailingSlash(ensureLeadingSlash(resolvedPath), trailingSlash);
  return new URL(normalisedPath, siteUrl).toString();
}

function resolveLocaleCandidate(locale?: string): string {
  if (!locale) {
    return DEFAULT_LOCALE;
  }

  return locale.includes('-') ? locale : `${locale}-${locale.toUpperCase()}`;
}

function toIsoString(value?: string | Date | null): string | undefined {
  if (!value) {
    return undefined;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return new Date(value).toISOString();
}

function buildAlternateHref(alternate: LocaleAlternate, site: URL, canonicalUrl: string): string {
  if (alternate.href) {
    return new URL(alternate.href, site).toString();
  }
  if (alternate.path) {
    const normalised = ensureTrailingSlash(ensureLeadingSlash(alternate.path), true);
    return new URL(normalised, site).toString();
  }
  return canonicalUrl;
}

function buildHreflangAlternates(
  canonicalUrl: string,
  site: URL,
  locale: string,
  alternates: LocaleAlternate[] = [],
): HreflangAlternate[] {
  const canonicalEntry: HreflangAlternate = {
    locale,
    href: canonicalUrl,
    isDefault: true,
  };

  const entries = new Map<string, HreflangAlternate>();
  entries.set(locale.toLowerCase(), canonicalEntry);

  for (const alternate of alternates) {
    if (!alternate?.locale) {
      continue;
    }
    const href = buildAlternateHref(alternate, site, canonicalUrl);
    entries.set(alternate.locale.toLowerCase(), {
      locale: alternate.locale,
      href,
      isDefault: false,
    });
  }

  if (!entries.has('x-default')) {
    entries.set('x-default', {
      locale: 'x-default',
      href: canonicalUrl,
      isDefault: true,
    });
  }

  return Array.from(entries.values());
}

function resolveOpenGraphMetadata(
  input: PageSeoInput,
  canonicalUrl: string,
  siteName: string,
  locale: string,
): ResolvedOpenGraphMetadata {
  const images: SeoImage[] = [];
  if (input.openGraph?.images?.length) {
    images.push(...input.openGraph.images);
  } else if (input.openGraph?.image) {
    images.push(input.openGraph.image);
  }

  const ogLocale = resolveLocaleCandidate(input.openGraph?.locale ?? locale);
  const ogTitle = input.openGraph?.title ?? input.title;
  const ogDescription = input.openGraph?.description ?? input.description;

  return {
    type: input.openGraph?.type ?? 'website',
    url: canonicalUrl,
    title: ogTitle,
    description: ogDescription,
    siteName: input.openGraph?.siteName ?? siteName,
    locale: ogLocale,
    images,
    publishedTime: toIsoString(input.openGraph?.publishedTime),
    modifiedTime: toIsoString(input.openGraph?.modifiedTime),
    section: input.openGraph?.section,
    tags: input.openGraph?.tags,
  };
}

function resolveTwitterMetadata(
  input: PageSeoInput,
  openGraph: ResolvedOpenGraphMetadata,
): ResolvedTwitterMetadata {
  const card =
    input.twitter?.card ??
    (openGraph.images.length > 0 ? 'summary_large_image' : DEFAULT_TWITTER_CARD);
  return {
    card,
    title: input.title,
    description: input.description,
    image: input.twitter?.image ?? openGraph.images[0]?.url,
    site: input.twitter?.site,
    creator: input.twitter?.creator,
  };
}

function buildMetaTags(metadata: PageSeoMetadata): MetaTagDescriptor[] {
  const tags: MetaTagDescriptor[] = [
    { name: 'description', content: metadata.description },
    { property: 'og:type', content: metadata.openGraph.type },
    { property: 'og:url', content: metadata.openGraph.url },
    { property: 'og:title', content: metadata.openGraph.title },
    { property: 'og:description', content: metadata.openGraph.description },
    { property: 'og:site_name', content: metadata.openGraph.siteName },
    { property: 'og:locale', content: metadata.openGraph.locale },
    { name: 'twitter:card', content: metadata.twitter.card },
    { name: 'twitter:title', content: metadata.twitter.title },
    { name: 'twitter:description', content: metadata.twitter.description },
  ];

  if (metadata.twitter.site) {
    tags.push({ name: 'twitter:site', content: metadata.twitter.site });
  }
  if (metadata.twitter.creator) {
    tags.push({ name: 'twitter:creator', content: metadata.twitter.creator });
  }
  if (metadata.twitter.image) {
    tags.push({ name: 'twitter:image', content: metadata.twitter.image });
  }

  metadata.openGraph.images.forEach((image) => {
    tags.push({ property: 'og:image', content: image.url });
    if (image.alt) {
      tags.push({ property: 'og:image:alt', content: image.alt });
    }
    if (image.width) {
      tags.push({ property: 'og:image:width', content: image.width.toString() });
    }
    if (image.height) {
      tags.push({ property: 'og:image:height', content: image.height.toString() });
    }
  });

  if (metadata.openGraph.publishedTime) {
    tags.push({ property: 'article:published_time', content: metadata.openGraph.publishedTime });
  }
  if (metadata.openGraph.modifiedTime) {
    tags.push({ property: 'article:modified_time', content: metadata.openGraph.modifiedTime });
  }
  if (metadata.openGraph.section) {
    tags.push({ property: 'article:section', content: metadata.openGraph.section });
  }
  if (metadata.openGraph.tags?.length) {
    metadata.openGraph.tags.forEach((tag) => tags.push({ property: 'article:tag', content: tag }));
  }

  if (metadata.noindex) {
    tags.push({ name: 'robots', content: 'noindex, nofollow' });
  }

  return tags;
}

function buildLinkTags(metadata: PageSeoMetadata): LinkTagDescriptor[] {
  const tags: LinkTagDescriptor[] = [{ rel: 'canonical', href: metadata.canonicalUrl }];

  metadata.hreflangs.forEach((alternate) => {
    tags.push({ rel: 'alternate', hreflang: alternate.locale, href: alternate.href });
  });

  return tags;
}

export function createPageSeo(
  input: PageSeoInput,
  {
    site,
    currentPath,
  }: {
    site?: string | URL | null;
    currentPath?: string;
  } = {},
): PageSeoMetadata {
  const siteUrl = normaliseSiteUrl(site);
  const siteName = input.siteName ?? DEFAULT_SITE_NAME;
  const locale = resolveLocaleCandidate(input.locale ?? DEFAULT_LOCALE);
  const canonicalUrl = resolveCanonical({
    path: input.path,
    canonicalUrl: input.canonicalUrl,
    trailingSlash: input.trailingSlash ?? true,
    site: siteUrl,
    fallbackPath: currentPath,
  });

  const openGraph = resolveOpenGraphMetadata(input, canonicalUrl, siteName, locale);
  const twitter = resolveTwitterMetadata(input, openGraph);
  const hreflangs = buildHreflangAlternates(canonicalUrl, siteUrl, locale, input.alternates);

  const metadata: PageSeoMetadata = {
    title: `${input.title} | ${siteName}`,
    description: input.description,
    canonicalUrl,
    siteName,
    locale,
    hreflangs,
    openGraph,
    twitter,
    metaTags: [],
    linkTags: [],
    noindex: Boolean(input.noindex),
  };

  metadata.metaTags = buildMetaTags(metadata);
  metadata.linkTags = buildLinkTags(metadata);

  return metadata;
}

/**
 * Shared utility used by SchemaScript. Serialises schema objects into inline
 * <script> elements while escaping characters that could terminate the tag.
 */
export function buildSchemaScriptHtml(
  schema: StructuredSchema | StructuredSchema[],
  type = 'application/ld+json',
): string {
  const schemas = Array.isArray(schema) ? schema : [schema];
  return schemas
    .map((schemaItem) => JSON.stringify(schemaItem).replace(/</g, '\\u003C'))
    .map((payload) => `<script type="${type}">${payload}</script>`)
    .join('');
}

export function buildOrganizationSchema({
  name = DEFAULT_SITE_NAME,
  url = SEO_MANIFEST.site.toString(),
  logo,
  sameAs = [],
}: {
  name?: string;
  url?: string;
  logo?: string;
  sameAs?: string[];
} = {}): StructuredSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name,
    url,
    ...(logo ? { logo } : {}),
    ...(sameAs.length ? { sameAs } : {}),
  };
}

export function buildWebsiteSchema({
  name = `${DEFAULT_SITE_NAME} Platform`,
  url = SEO_MANIFEST.site.toString(),
  description,
  searchUrl,
}: {
  name?: string;
  url?: string;
  description?: string;
  searchUrl?: string;
} = {}): StructuredSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name,
    url,
    ...(description ? { description } : {}),
    ...(searchUrl
      ? {
          potentialAction: {
            '@type': 'SearchAction',
            target: `${searchUrl}?q={search_term_string}`,
            'query-input': 'required name=search_term_string',
          },
        }
      : {}),
  };
}

export function buildBreadcrumbSchema(
  trail: BreadcrumbTrail,
  site?: string | URL,
): StructuredSchema {
  const siteUrl = site ? normaliseSiteUrl(site) : undefined;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((segment, index) => {
      const position = index + 1;
      const base = {
        '@type': 'ListItem',
        position,
        name: segment.label,
      } as Record<string, unknown>;

      if (segment.href) {
        const href = siteUrl ? new URL(segment.href, siteUrl).toString() : segment.href;
        base.item = href;
      }

      return base;
    }),
  };
}

export function buildSoftwareApplicationSchema({
  name,
  description,
  url,
  operatingSystem = 'Cloud',
  applicationSuite = `${DEFAULT_SITE_NAME} Platform`,
  offersUrl,
  image,
  featureList = [],
  releaseNotes,
}: {
  name: string;
  description: string;
  url: string;
  operatingSystem?: string;
  applicationSuite?: string;
  offersUrl?: string;
  image?: SeoImage;
  featureList?: string[];
  releaseNotes?: string;
}): StructuredSchema {
  const schema: StructuredSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name,
    applicationCategory: 'BusinessApplication',
    applicationSuite,
    operatingSystem,
    description,
    url,
    offers: {
      '@type': 'Offer',
      availability: 'https://schema.org/InStock',
      price: '0',
      priceCurrency: 'USD',
      ...(offersUrl ? { url: offersUrl } : {}),
    },
    isAccessibleForFree: false,
  };

  if (image) {
    schema.image = image.url;
  }

  if (featureList.length) {
    schema.featureList = featureList;
  }

  if (releaseNotes) {
    schema.releaseNotes = releaseNotes;
  }

  return schema;
}

export function buildArticleSchema({
  headline,
  description,
  url,
  publishedTime,
  modifiedTime,
  authorName,
  authorTitle,
  image,
  tags = [],
  readingTimeMinutes,
  publisherName = DEFAULT_SITE_NAME,
}: {
  headline: string;
  description: string;
  url: string;
  publishedTime: string | Date;
  modifiedTime?: string | Date;
  authorName: string;
  authorTitle?: string;
  image?: string;
  tags?: string[];
  readingTimeMinutes?: number;
  publisherName?: string;
}): StructuredSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
    headline,
    description,
    datePublished: toIsoString(publishedTime),
    ...(modifiedTime ? { dateModified: toIsoString(modifiedTime) } : {}),
    author: {
      '@type': 'Person',
      name: authorName,
      ...(authorTitle ? { jobTitle: authorTitle } : {}),
    },
    publisher: {
      '@type': 'Organization',
      name: publisherName,
    },
    ...(tags.length ? { keywords: tags.join(', ') } : {}),
    ...(readingTimeMinutes ? { timeRequired: `PT${Math.round(readingTimeMinutes)}M` } : {}),
    ...(image ? { image } : {}),
    isAccessibleForFree: true,
  };
}

export function buildFaqSchema(
  faqEntries: Array<{ question: string; answer: string }>,
): StructuredSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqEntries.map((entry) => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: entry.answer,
      },
    })),
  };
}
