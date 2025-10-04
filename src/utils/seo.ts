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

type LocaleDefinition = {
  code?: string;
  label?: string;
  origin?: URL;
  pathPrefix?: string;
  hrefLang?: string;
  searchConsole?: Record<string, string>;
};

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

const LOCALE_DEFINITIONS: Record<string, LocaleDefinition> =
  SEO_MANIFEST.locales?.definitions ?? {};
const DEFAULT_LOCALE = SEO_MANIFEST.locales?.default ?? 'en-US';
const HREFLANG_CLUSTERS: string[][] = Array.from(
  SEO_MANIFEST.locales?.hreflang?.clusters ?? [],
  (cluster) => [...cluster],
);
const X_DEFAULT_LOCALE = SEO_MANIFEST.locales?.hreflang?.xDefault ?? DEFAULT_LOCALE;

const LOCALE_LOOKUP = new Map<string, string>();
const LOCALE_PATH_PREFIXES: Array<{ code: string; prefix: string }> = [];

for (const [code, definition] of Object.entries(LOCALE_DEFINITIONS)) {
  const canonicalCode = (definition.code ?? code).toString();
  const normalisedCanonical = canonicalCode.replace(/_/g, '-');
  LOCALE_LOOKUP.set(code.toLowerCase(), canonicalCode);
  LOCALE_LOOKUP.set(normalisedCanonical.toLowerCase(), canonicalCode);
  LOCALE_LOOKUP.set(canonicalCode.toLowerCase(), canonicalCode);
  const baseLanguage = canonicalCode.split(/[-_]/u)[0];
  if (baseLanguage) {
    LOCALE_LOOKUP.set(baseLanguage.toLowerCase(), canonicalCode);
  }
  if (definition.hrefLang) {
    LOCALE_LOOKUP.set(String(definition.hrefLang).toLowerCase(), canonicalCode);
  }
  if (definition.code && definition.code !== code) {
    LOCALE_LOOKUP.set(String(definition.code).toLowerCase(), canonicalCode);
  }

  LOCALE_PATH_PREFIXES.push({
    code: canonicalCode,
    prefix: normalisePathPrefix(definition.pathPrefix ?? '/'),
  });
}

if (!LOCALE_LOOKUP.has(DEFAULT_LOCALE.toLowerCase())) {
  LOCALE_LOOKUP.set(DEFAULT_LOCALE.toLowerCase(), DEFAULT_LOCALE);
}

if (LOCALE_PATH_PREFIXES.length === 0) {
  LOCALE_PATH_PREFIXES.push({ code: DEFAULT_LOCALE, prefix: normalisePathPrefix('/') });
}

LOCALE_PATH_PREFIXES.sort((a, b) => b.prefix.length - a.prefix.length);

const DEFAULT_SITE_NAME = 'Apotheon.ai';
const DEFAULT_TWITTER_CARD: ResolvedTwitterMetadata['card'] = 'summary_large_image';

function normaliseSiteUrl(candidate?: string | URL | null, fallback?: URL): URL {
  if (!candidate) {
    const base = fallback ?? SEO_MANIFEST.site;
    return base instanceof URL ? new URL(base.toString()) : new URL(String(base));
  }

  if (candidate instanceof URL) {
    return new URL(candidate.toString());
  }

  return new URL(candidate);
}

function normalisePathPrefix(prefix?: string): string {
  if (!prefix) {
    return '/';
  }

  const trimmed = prefix.trim();
  if (!trimmed || trimmed === '/') {
    return '/';
  }

  const withLeadingSlash = ensureLeadingSlash(trimmed);
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`;
}

function getLocaleDefinition(locale: string): LocaleDefinition | undefined {
  return LOCALE_DEFINITIONS[locale] ?? undefined;
}

function resolveLocaleCode(locale?: string): string {
  if (!locale) {
    return DEFAULT_LOCALE;
  }

  const normalisedRaw = locale.replace(/_/g, '-');
  const normalised = normalisedRaw.toLowerCase();
  const resolved = LOCALE_LOOKUP.get(normalised) ?? LOCALE_LOOKUP.get(locale.toLowerCase());
  if (resolved) {
    return resolved;
  }

  if (LOCALE_DEFINITIONS[locale]) {
    return locale;
  }

  if (LOCALE_DEFINITIONS[normalisedRaw]) {
    return normalisedRaw;
  }

  if (normalisedRaw.includes('-')) {
    const [language, region] = normalisedRaw.split('-');
    if (language && region) {
      return `${language.toLowerCase()}-${region.toUpperCase()}`;
    }
  }

  if (normalisedRaw) {
    return normalisedRaw;
  }

  return DEFAULT_LOCALE;
}

function formatOpenGraphLocale(locale: string): string {
  return locale.replace(/-/g, '_');
}

function resolveLocaleCluster(locale: string): string[] {
  const resolved = resolveLocaleCode(locale);
  const target = resolved.toLowerCase();

  for (const cluster of HREFLANG_CLUSTERS) {
    const normalisedCluster = cluster.map((entry) => resolveLocaleCode(entry));
    if (normalisedCluster.some((entry) => entry.toLowerCase() === target)) {
      return normalisedCluster;
    }
  }

  return [resolved];
}

export function resolveLocaleFromPath(path?: string | null): string | undefined {
  if (!path) {
    return undefined;
  }

  const normalisedPath = ensureLeadingSlash(path);
  for (const { code, prefix } of LOCALE_PATH_PREFIXES) {
    if (prefix === '/') {
      return code;
    }

    if (normalisedPath === prefix.slice(0, -1) || normalisedPath.startsWith(prefix)) {
      return code;
    }
  }

  return undefined;
}

function stripLocalePrefix(pathname: string, localeDefinition?: LocaleDefinition): string {
  const prefix = normalisePathPrefix(localeDefinition?.pathPrefix ?? '/');
  const normalisedPath = ensureLeadingSlash(pathname);

  if (prefix === '/') {
    return normalisedPath;
  }

  if (normalisedPath === prefix.slice(0, -1)) {
    return '/';
  }

  if (normalisedPath.startsWith(prefix)) {
    const remainder = normalisedPath.slice(prefix.length - 1);
    return ensureLeadingSlash(remainder);
  }

  return normalisedPath;
}

function applyLocalePrefix(route: string, localeDefinition?: LocaleDefinition): string {
  const prefix = normalisePathPrefix(localeDefinition?.pathPrefix ?? '/');
  const cleanRoute = ensureLeadingSlash(route).replace(/\/+/g, '/');

  if (prefix === '/') {
    return cleanRoute;
  }

  const trimmedRoute = cleanRoute.startsWith('/') ? cleanRoute.slice(1) : cleanRoute;
  return `${prefix}${trimmedRoute}`;
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
  const resolved = resolveLocaleCode(locale);
  const definition = getLocaleDefinition(resolved);
  if (definition?.code) {
    return definition.code;
  }

  return resolved;
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

function resolveHrefLang(locale: string): string {
  const definition = getLocaleDefinition(locale);
  return definition?.hrefLang ?? resolveLocaleCandidate(locale);
}

function buildLocaleHref({
  alternate,
  localeDefinition,
  routeKey,
  trailingSlash,
  fallbackOrigin,
}: {
  alternate?: LocaleAlternate;
  localeDefinition?: LocaleDefinition;
  routeKey: string;
  trailingSlash: boolean;
  fallbackOrigin: URL;
}): string {
  const origin = localeDefinition?.origin
    ? new URL(localeDefinition.origin.toString())
    : new URL(fallbackOrigin.toString());

  if (alternate?.href) {
    return new URL(alternate.href, origin).toString();
  }

  if (alternate?.path) {
    const normalised = ensureTrailingSlash(ensureLeadingSlash(alternate.path), trailingSlash);
    return new URL(normalised, origin).toString();
  }

  const derivedPath = applyLocalePrefix(routeKey, localeDefinition);
  const normalisedPath = ensureTrailingSlash(derivedPath, trailingSlash);
  return new URL(normalisedPath, origin).toString();
}

function buildHreflangAlternates({
  canonicalUrl,
  localeCode,
  canonicalDefinition,
  explicitAlternates = [],
  routeKey,
  trailingSlash,
}: {
  canonicalUrl: string;
  localeCode: string;
  canonicalDefinition?: LocaleDefinition;
  explicitAlternates?: LocaleAlternate[];
  routeKey: string;
  trailingSlash: boolean;
}): HreflangAlternate[] {
  const canonicalHrefLang = resolveHrefLang(localeCode);
  const canonicalOrigin = canonicalDefinition?.origin
    ? new URL(canonicalDefinition.origin.toString())
    : normaliseSiteUrl(undefined);

  const entries = new Map<string, HreflangAlternate>();
  entries.set(canonicalHrefLang.toLowerCase(), {
    locale: canonicalHrefLang,
    href: canonicalUrl,
    isDefault: true,
  });

  const overrides = new Map<string, LocaleAlternate>();
  for (const alternate of explicitAlternates ?? []) {
    if (!alternate?.locale) continue;
    const lower = alternate.locale.toLowerCase();
    overrides.set(lower, alternate);
    const resolvedCode = resolveLocaleCode(alternate.locale);
    overrides.set(resolvedCode.toLowerCase(), alternate);
    const definition = getLocaleDefinition(resolvedCode);
    if (definition?.hrefLang) {
      overrides.set(definition.hrefLang.toLowerCase(), alternate);
    }
  }

  const cluster = resolveLocaleCluster(localeCode);
  for (const clusterLocale of cluster) {
    const clusterHrefLang = resolveHrefLang(clusterLocale);
    const key = clusterHrefLang.toLowerCase();
    if (entries.has(key)) {
      continue;
    }

    const override = overrides.get(key) ?? overrides.get(clusterLocale.toLowerCase());
    const href = buildLocaleHref({
      alternate: override,
      localeDefinition: getLocaleDefinition(clusterLocale),
      routeKey,
      trailingSlash,
      fallbackOrigin: canonicalOrigin,
    });

    entries.set(key, {
      locale: clusterHrefLang,
      href,
      isDefault: false,
    });
  }

  for (const [key, alternate] of overrides.entries()) {
    if (entries.has(key)) {
      continue;
    }

    const resolvedCode = resolveLocaleCode(alternate.locale);
    const hrefLang = resolveHrefLang(resolvedCode);
    if (entries.has(hrefLang.toLowerCase())) {
      continue;
    }

    const href = buildLocaleHref({
      alternate,
      localeDefinition: getLocaleDefinition(resolvedCode),
      routeKey,
      trailingSlash,
      fallbackOrigin: canonicalOrigin,
    });

    entries.set(hrefLang.toLowerCase(), {
      locale: hrefLang,
      href,
      isDefault: false,
    });
  }

  if (!entries.has('x-default')) {
    const xDefaultCode = resolveLocaleCode(X_DEFAULT_LOCALE);
    const href = buildLocaleHref({
      alternate: overrides.get('x-default'),
      localeDefinition: getLocaleDefinition(xDefaultCode) ?? canonicalDefinition,
      routeKey,
      trailingSlash,
      fallbackOrigin: canonicalOrigin,
    });
    entries.set('x-default', {
      locale: 'x-default',
      href,
      isDefault: true,
    });
  }

  return Array.from(entries.values());
}

function resolveOpenGraphMetadata(
  input: PageSeoInput,
  canonicalUrl: string,
  siteName: string,
  localeCode: string,
): ResolvedOpenGraphMetadata {
  const images: SeoImage[] = [];
  if (input.openGraph?.images?.length) {
    images.push(...input.openGraph.images);
  } else if (input.openGraph?.image) {
    images.push(input.openGraph.image);
  }

  const ogLocaleCode = resolveLocaleCode(input.openGraph?.locale ?? localeCode);
  const ogLocale = formatOpenGraphLocale(ogLocaleCode);
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

  metadata.hreflangs
    .filter((alternate) => alternate.locale !== 'x-default')
    .forEach((alternate) => {
      const alternateLocaleCode = resolveLocaleCode(alternate.locale);
      const formatted = formatOpenGraphLocale(alternateLocaleCode);
      if (formatted === metadata.openGraph.locale) {
        return;
      }
      tags.push({ property: 'og:locale:alternate', content: formatted });
    });

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
    locale: runtimeLocale,
  }: {
    site?: string | URL | null;
    currentPath?: string;
    locale?: string;
  } = {},
): PageSeoMetadata {
  const runtimeSite = site ? normaliseSiteUrl(site) : undefined;
  const siteName = input.siteName ?? DEFAULT_SITE_NAME;
  const pathDerivedLocale = resolveLocaleFromPath(input.path ?? currentPath ?? undefined);
  const localeCode = resolveLocaleCode(
    input.locale ?? runtimeLocale ?? pathDerivedLocale ?? DEFAULT_LOCALE,
  );
  const localeDefinition = getLocaleDefinition(localeCode);
  const locale = resolveLocaleCandidate(localeCode);
  const localeOrigin = localeDefinition?.origin
    ? new URL(localeDefinition.origin.toString())
    : undefined;
  const siteUrl = localeOrigin ?? runtimeSite ?? normaliseSiteUrl(undefined);
  const canonicalUrl = resolveCanonical({
    path: input.path,
    canonicalUrl: input.canonicalUrl,
    trailingSlash: input.trailingSlash ?? true,
    site: siteUrl,
    fallbackPath: currentPath,
  });

  const routeKey = stripLocalePrefix(new URL(canonicalUrl).pathname, localeDefinition);
  const trailingSlash = input.trailingSlash ?? true;
  const openGraph = resolveOpenGraphMetadata(input, canonicalUrl, siteName, localeCode);
  const twitter = resolveTwitterMetadata(input, openGraph);
  const hreflangs = buildHreflangAlternates({
    canonicalUrl,
    localeCode,
    canonicalDefinition: localeDefinition,
    explicitAlternates: input.alternates,
    routeKey,
    trailingSlash,
  });

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
  locale = DEFAULT_LOCALE,
}: {
  name?: string;
  url?: string;
  logo?: string;
  sameAs?: string[];
  locale?: string;
} = {}): StructuredSchema {
  const language = resolveLocaleCandidate(locale);
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name,
    url,
    ...(logo ? { logo } : {}),
    ...(sameAs.length ? { sameAs } : {}),
    ...(language ? { inLanguage: language } : {}),
  };
}

export function buildWebsiteSchema({
  name = `${DEFAULT_SITE_NAME} Platform`,
  url = SEO_MANIFEST.site.toString(),
  description,
  searchUrl,
  locale = DEFAULT_LOCALE,
}: {
  name?: string;
  url?: string;
  description?: string;
  searchUrl?: string;
  locale?: string;
} = {}): StructuredSchema {
  const language = resolveLocaleCandidate(locale);
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
    ...(language ? { inLanguage: language } : {}),
  };
}

export function buildBreadcrumbSchema(
  trail: BreadcrumbTrail,
  site?: string | URL,
  locale: string = DEFAULT_LOCALE,
): StructuredSchema {
  const siteUrl = site ? normaliseSiteUrl(site) : undefined;
  const language = resolveLocaleCandidate(locale);
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    ...(language ? { inLanguage: language } : {}),
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
  locale = DEFAULT_LOCALE,
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
  locale?: string;
}): StructuredSchema {
  const language = resolveLocaleCandidate(locale);
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
    ...(language ? { inLanguage: language } : {}),
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
  locale = DEFAULT_LOCALE,
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
  locale?: string;
}): StructuredSchema {
  const language = resolveLocaleCandidate(locale);
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
    ...(language ? { inLanguage: language } : {}),
  };
}

export function buildFaqSchema(
  faqEntries: Array<{ question: string; answer: string }>,
  locale: string = DEFAULT_LOCALE,
): StructuredSchema {
  const language = resolveLocaleCandidate(locale);
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    ...(language ? { inLanguage: language } : {}),
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

export function buildHowToSchema({
  name,
  description,
  steps,
  locale = DEFAULT_LOCALE,
}: {
  name: string;
  description?: string;
  steps: Array<{ name: string; text: string; url?: string }>;
  locale?: string;
}): StructuredSchema {
  const language = resolveLocaleCandidate(locale);
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name,
    ...(description ? { description } : {}),
    ...(language ? { inLanguage: language } : {}),
    step: steps.map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: step.name,
      text: step.text,
      ...(step.url ? { url: step.url } : {}),
    })),
  };
}
