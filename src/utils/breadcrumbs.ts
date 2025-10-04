/**
 * Canonical label announced to assistive tech for the breadcrumb nav.
 * Exported so both the component and tests assert on a single source of truth.
 */
export const BREADCRUMB_ARIA_LABEL = 'Breadcrumb';

/**
 * Central configuration for each IA section that surfaces breadcrumbs.
 * Co-locating labels + base paths ensures marketing/blog surfaces stay in sync
 * with primary navigation copy during IA refactors.
 */
const SECTION_CONFIG = {
  docs: {
    label: 'Docs',
    href: '/docs/',
  },
  solutions: {
    label: 'Solutions',
    href: '/solutions/',
  },
  industries: {
    label: 'Industries',
    href: '/industries/',
  },
  about: {
    label: 'About',
    href: '/about/',
  },
  research: {
    label: 'Research',
    href: '/research/',
  },
  blog: {
    label: 'Blog',
    href: '/blog/',
  },
} as const satisfies Record<string, { label: string; href: string }>;

/**
 * Keys exposed for IA helpers.
 */
export type BreadcrumbSection = keyof typeof SECTION_CONFIG;

/**
 * Normalized breadcrumb segment consumed by both navigation UI and JSON-LD.
 */
export interface BreadcrumbSegment {
  /**
   * Human-readable label shown in the breadcrumb trail.
   */
  label: string;
  /**
   * Optional href for linkable crumbs. Omitted for terminal crumbs rendered as text only.
   */
  href?: string;
  /**
   * Flag indicating the segment represents the current page. When omitted, helpers ensure the
   * trailing segment is marked as current.
   */
  isCurrentPage?: boolean;
}

export type BreadcrumbTrail = BreadcrumbSegment[];

const HOME_CRUMB: BreadcrumbSegment = { label: 'Home', href: '/' };

/**
 * Minimal entry contract shared across marketing + blog helpers. Content collection entries expose
 * additional metadata, but the breadcrumb generators only rely on a slug and human-readable title.
 */
export type EntryWithTitle = {
  slug: string;
  data: {
    title: string;
  };
};

/**
 * Title-case utility used for nested segments sourced from folder names.
 * Keeps fallbacks deterministic while we explore future CMS-driven IA.
 */
function humanizeSlug(slug: string): string {
  return (
    slug
      .split('/')
      .at(-1)
      ?.split('-')
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ') ?? slug
  );
}

function sanitizeDocSlug(slug: string): string {
  return slug.replace(/^handbook\//u, '');
}

function isAbsoluteUrl(url: string): boolean {
  try {
    return Boolean(new URL(url));
  } catch {
    return false;
  }
}

/**
 * Ensures every breadcrumb trail begins with the home crumb and ends with a current-page segment.
 */
export function normalizeTrail(trail: BreadcrumbTrail, includeHome = true): BreadcrumbTrail {
  const sanitized = trail
    .filter((segment) => Boolean(segment?.label))
    .map((segment) => ({
      ...segment,
      label: segment.label.trim(),
    }));

  const first = sanitized[0];
  const needsHome =
    includeHome &&
    !(first && first.label === HOME_CRUMB.label && (first.href === HOME_CRUMB.href || !first.href));
  const withHome = needsHome ? [HOME_CRUMB, ...sanitized] : sanitized;

  return withHome.map((segment, index, array) => ({
    ...segment,
    isCurrentPage: index === array.length - 1,
  }));
}

/**
 * Converts a normalized trail into the JSON-LD object consumed by search engines.
 */
export function trailToJsonLd(trail: BreadcrumbTrail, baseUrl?: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((segment, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: segment.label,
      ...(segment.href
        ? {
            item:
              baseUrl && !isAbsoluteUrl(segment.href)
                ? new URL(segment.href, baseUrl).href
                : segment.href,
          }
        : {}),
    })),
  } as const;
}

/**
 * Stable JSON stringification wrapper to keep script tags deterministic for caching + tests.
 */
export function serializeTrailToJsonLd(trail: BreadcrumbTrail, baseUrl?: string): string {
  return JSON.stringify(trailToJsonLd(trail, baseUrl), null, 2);
}

function buildSectionCrumb(section: BreadcrumbSection): BreadcrumbSegment {
  const config = SECTION_CONFIG[section];
  if (!config) {
    throw new Error(`Unknown breadcrumb section: ${section}`);
  }
  return { label: config.label, href: config.href };
}

/**
 * Builds the home → section trail for index/landing pages.
 */
export function createSectionIndexTrail(
  section: Exclude<BreadcrumbSection, 'blog'>,
): BreadcrumbTrail {
  return normalizeTrail([buildSectionCrumb(section)]);
}

/**
 * Generates a trail for blog listing routes.
 */
export function createBlogIndexTrail(): BreadcrumbTrail {
  return normalizeTrail([buildSectionCrumb('blog')]);
}

/**
 * Assembles `home → section → entry` for marketing collection entries.
 * Uses entry metadata for the leaf label to avoid manual strings.
 */
export function createMarketingEntryTrail(entry: EntryWithTitle): BreadcrumbTrail {
  const [sectionSegment, ...rest] = entry.slug.split('/');
  if (!sectionSegment || !(sectionSegment in SECTION_CONFIG)) {
    throw new Error(`Unsupported marketing breadcrumb slug: ${entry.slug}`);
  }
  const section = sectionSegment as Exclude<BreadcrumbSection, 'blog'>;
  const ancestorSegments = rest.slice(0, -1);
  const leafSegment = rest.at(-1) ?? sectionSegment;

  const ancestors = ancestorSegments.map((segment, index) => ({
    label: humanizeSlug(segment),
    href: `/${[sectionSegment, ...ancestorSegments.slice(0, index + 1)].join('/')}/`,
  }));

  const leafHref = `/${[sectionSegment, ...ancestorSegments, leafSegment].join('/')}/`;
  const trail: BreadcrumbTrail = [
    buildSectionCrumb(section),
    ...ancestors,
    {
      label: entry.data.title,
      href: leafHref,
    },
  ];

  return normalizeTrail(trail);
}

/**
 * Handbook entries share the same slug semantics as marketing/blog content, but live under the `/docs`
 * IA node. This helper normalizes the slug (removing the generated `handbook/` prefix) and surfaces
 * breadcrumbs that mirror the directory hierarchy so GitHub- and Astro-based navigation stay aligned.
 */
export function createDocsEntryTrail(entry: EntryWithTitle): BreadcrumbTrail {
  const sanitizedSlug = sanitizeDocSlug(entry.slug);
  const segments = sanitizedSlug.split('/').filter(Boolean);
  const ancestors = segments.slice(0, -1).map((segment, index) => ({
    label: humanizeSlug(segment),
    href: `/docs/${segments.slice(0, index + 1).join('/')}/`,
  }));

  const leafHref = `/docs/${segments.join('/')}/`;
  const trail: BreadcrumbTrail = [
    buildSectionCrumb('docs'),
    ...ancestors,
    { label: entry.data.title, href: leafHref },
  ];

  return normalizeTrail(trail);
}

/**
 * Landing page breadcrumb for the Developer Handbook index.
 */
export function createDocsIndexTrail(): BreadcrumbTrail {
  return normalizeTrail([buildSectionCrumb('docs')]);
}

/**
 * Solutions content now lives in its own collection where the slug is the product identifier.
 * This helper mirrors the marketing entry trail behavior while assuming the `/solutions/` prefix.
 */
export function createSolutionsEntryTrail(entry: EntryWithTitle): BreadcrumbTrail {
  const normalizedSlug = entry.slug.replace(/^\/+|\/+$/gu, '');
  const href = `/solutions/${normalizedSlug}/`;
  const trail: BreadcrumbTrail = [
    buildSectionCrumb('solutions'),
    {
      label: entry.data.title,
      href,
    },
  ];

  return normalizeTrail(trail);
}

/**
 * Marketing landing pages (solutions, industries, about) share the same index trail helper.
 * Accepting the slug segment keeps the API ergonomic when templates know the section statically.
 */
export function createMarketingIndexTrail(
  section: Exclude<BreadcrumbSection, 'blog'>,
): BreadcrumbTrail {
  return createSectionIndexTrail(section);
}

/**
 * Blog detail pages rely on collection metadata for the leaf label.
 */
export function createBlogPostTrail(entry: EntryWithTitle): BreadcrumbTrail {
  const baseCrumb = buildSectionCrumb('blog');
  const trail: BreadcrumbTrail = [
    baseCrumb,
    {
      label: entry.data.title,
      href: `/blog/${entry.slug}`,
    },
  ];
  return normalizeTrail(trail);
}

/**
 * Utility exposed for future nested IA nodes (e.g., /about/leadership/executive-team).
 * Accepts explicit ancestor metadata so CMS-driven hierarchies can opt-in without new helpers.
 */
export function createNestedTrail(
  section: BreadcrumbSection,
  ancestors: BreadcrumbSegment[],
  leaf: BreadcrumbSegment,
): BreadcrumbTrail {
  const base = [buildSectionCrumb(section), ...ancestors, leaf];
  return normalizeTrail(base);
}

export { SECTION_CONFIG };
