import { getCollection } from 'astro:content';

import { footerContact } from './contactMetadata';
import {
  navigationMenuGroups,
  type NavigationMenuGroup,
  type NavigationMenuLink,
} from '../islands/RadixNavigationMenu';

/**
 * Regular expression used to detect absolute/external URLs so we avoid running them through
 * the marketing collection validator. Keeping the pattern colocated with the validation helper
 * ensures both the header and footer islands inherit the exact same guard rails.
 */
const EXTERNAL_LINK_PATTERN = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/iu;

/**
 * Navigation links often reference Astro routes generated from the marketing content collection.
 * This helper normalizes paths into a predictable `/foo/bar` shape so we can compare menu hrefs
 * against collection slugs without worrying about trailing slashes or duplicate separators.
 */
function normalizeInternalHref(href: string): string {
  return `/${href.replace(/^\/+/u, '').replace(/\/$/u, '')}`;
}

/**
 * Derives a set of canonical marketing slugs that also exist inside the primary navigation array.
 * We scope the lookup to known hrefs so the validator avoids storing thousands of unrelated
 * collection routes as the content library scales.
 */
async function buildMarketingHrefLookup(): Promise<Map<string, string>> {
  const marketingEntries = (await getCollection('marketing')) as ReadonlyArray<MarketingSlugEntry>;

  const relevantMarketingSlugs = new Map<string, string>();
  const trackedInternalLinks = new Set<string>();

  for (const group of navigationMenuGroups) {
    for (const link of group.links) {
      if (!EXTERNAL_LINK_PATTERN.test(link.href)) {
        trackedInternalLinks.add(normalizeInternalHref(link.href));
      }
    }
  }

  for (const entry of marketingEntries) {
    if (!isMarketingEntry(entry)) {
      continue;
    }

    const { slug } = entry;
    const slugPath = normalizeInternalHref(slug);

    if (trackedInternalLinks.has(slugPath)) {
      relevantMarketingSlugs.set(slugPath, slugPath);
    }
  }

  return relevantMarketingSlugs;
}

interface MarketingSlugEntry {
  readonly slug: string;
}

function isMarketingEntry(candidate: unknown): candidate is MarketingSlugEntry {
  if (typeof candidate !== 'object' || candidate === null) {
    return false;
  }

  const { slug } = candidate as { slug?: unknown };

  return typeof slug === 'string' && slug.length > 0;
}

/**
 * Centralized sanitizer that mirrors the header’s historical behavior. We clone the exported data
 * structure from the Radix navigation island, resolve all internal hrefs against the marketing
 * content collection, and drop anything that fails validation. The helper returns a brand new array
 * so downstream consumers can iterate freely without mutating the shared singleton.
 */
export async function getValidatedNavigationGroups(): Promise<ReadonlyArray<NavigationMenuGroup>> {
  const marketingHrefLookup = await buildMarketingHrefLookup();

  const validatedGroups: NavigationMenuGroup[] = [];

  for (const group of navigationMenuGroups) {
    const validatedLinks: NavigationMenuLink[] = [];

    for (const link of group.links) {
      if (EXTERNAL_LINK_PATTERN.test(link.href)) {
        validatedLinks.push(link);
        continue;
      }

      const canonicalHref = marketingHrefLookup.get(normalizeInternalHref(link.href));

      if (!canonicalHref) {
        console.warn(
          `navigation: skipping "${link.label}" because ${link.href} does not resolve to a marketing entry`,
        );
        continue;
      }

      validatedLinks.push({ ...link, href: canonicalHref });
    }

    if (validatedLinks.length > 0) {
      validatedGroups.push({ ...group, links: validatedLinks });
    }
  }

  return validatedGroups;
}

/**
 * Footer link metadata intentionally mirrors the Radix navigation menu API so contributors can lift
 * the same objects into multiple surfaces. Keeping the shape identical simplifies future automation
 * (e.g., JSON-LD sitemap generation) and minimizes bespoke code when we eventually ship a CMS feed.
 */
export interface FooterLink {
  readonly label: string;
  readonly href: string;
  readonly description?: string;
}

export interface FooterColumn {
  readonly title: string;
  readonly summary?: string;
  readonly links: ReadonlyArray<FooterLink>;
}

/**
 * Maps the validated navigation groups into footer-ready columns. We intentionally remap the
 * customer-facing labels (Platform → Product) so brand/marketing teams can evolve taxonomy without
 * duplicating href arrays across the repo. When new navigation buckets appear simply expand the
 * column map below and the footer will pick them up automatically.
 */
export async function getFooterColumns(): Promise<ReadonlyArray<FooterColumn>> {
  const groups = await getValidatedNavigationGroups();

  const groupByLabel = new Map(groups.map((group) => [group.label, group]));

  const columnBlueprint: ReadonlyArray<{ source: string; title: string }> = [
    { source: 'Platform', title: 'Product' },
    { source: 'Industries', title: 'Industries' },
    { source: 'Company', title: 'Company' },
  ];

  const columns: FooterColumn[] = [];

  for (const blueprint of columnBlueprint) {
    const group = groupByLabel.get(blueprint.source);

    if (!group || group.links.length === 0) {
      continue;
    }

    columns.push({
      title: blueprint.title,
      summary: group.description,
      links: group.links.map((link) => ({
        label: link.label,
        href: link.href,
        description: link.description,
      })),
    });
  }

  return columns;
}

/**
 * Legal links live alongside navigation data so compliance teams only need to update a single
 * module when rolling out new policies. Routes currently render lightweight Astro placeholders to
 * prevent 404s during the legal content build-out.
 */
export const footerLegalLinks: ReadonlyArray<FooterLink> = [
  {
    label: 'Privacy Policy',
    href: '/legal/privacy',
    description: 'Data handling commitments, retention windows, and DSAR intake.',
  },
  {
    label: 'Terms of Service',
    href: '/legal/terms',
    description: 'Contractual obligations that govern platform access.',
  },
  {
    label: 'Responsible AI',
    href: '/legal/responsible-ai',
    description: 'Guardrails that govern AI experimentation, auditability, and rollout.',
  },
];

/**
 * Contact metadata powers both the footer and future CRM automations. We break the address into
 * discrete lines so downstream consumers can render microformats or JSON-LD without parsing strings.
 */
export { footerContact };
