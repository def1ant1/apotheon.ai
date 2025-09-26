import { getCollection } from 'astro:content';

import { getFooterContact } from './contactMetadata';
import { translateWithFallback, type Translator } from '../../i18n/translator';
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
 * Derives a set of canonical content slugs (marketing, solutions, and industries) that also exist
 * inside the primary navigation array. We scope the lookup to known hrefs so the validator avoids
 * storing thousands of unrelated collection routes as the content library scales.
 */
async function buildContentHrefLookup(): Promise<Map<string, string>> {
  const marketingEntries = (await getCollection('marketing')) as ReadonlyArray<unknown>;
  const solutionEntries = (await getCollection('solutions')) as ReadonlyArray<unknown>;
  const industryEntries = (await getCollection('industries')) as ReadonlyArray<unknown>;
  const marketingSlugs = marketingEntries.filter(isEntryWithSlug).map((entry) => entry.slug);
  const solutionSlugs = solutionEntries.filter(isPublishedSolutionEntry).map((entry) => entry.slug);
  const industrySlugs = industryEntries.filter(isPublishedIndustryEntry).map((entry) => entry.slug);

  const relevantContentSlugs = new Map<string, string>();
  const trackedInternalLinks = new Set<string>();

  for (const group of navigationMenuGroups) {
    for (const link of group.links) {
      if (!EXTERNAL_LINK_PATTERN.test(link.href)) {
        trackedInternalLinks.add(normalizeInternalHref(link.href));
      }
    }
  }

  const registerSlug = (slug: string) => {
    const slugPath = normalizeInternalHref(slug);

    if (trackedInternalLinks.has(slugPath)) {
      relevantContentSlugs.set(slugPath, slugPath);
    }
  };

  for (const slug of marketingSlugs) {
    registerSlug(slug);
  }

  for (const slug of solutionSlugs) {
    registerSlug(`solutions/${slug}`);
  }

  for (const slug of industrySlugs) {
    registerSlug(`industries/${slug}`);
  }

  return relevantContentSlugs;
}

interface EntryWithSlug {
  readonly slug: string;
}

/**
 * Draft-aware entry contract shared across solutions and industries collections. Centralizing the
 * shape lets us reuse a single type guard when additional content buckets (e.g., case studies)
 * eventually plug into the navigation validator.
 */
interface DraftableEntry extends EntryWithSlug {
  readonly data?: { draft?: boolean };
}

function isEntryWithSlug(candidate: unknown): candidate is EntryWithSlug {
  if (typeof candidate !== 'object' || candidate === null) {
    return false;
  }

  const { slug } = candidate as { slug?: unknown };

  return typeof slug === 'string' && slug.length > 0;
}

/**
 * Defensive helper that confirms the candidate exposes a slug and either omits the draft flag or
 * explicitly marks it as `false`. Returning early when the data blob is malformed prevents
 * TypeScript from widening every candidate to `any`, which keeps the downstream map/filter logic
 * type-safe.
 */
function isPublishedDraftableEntry(candidate: unknown): candidate is DraftableEntry {
  if (!isEntryWithSlug(candidate)) {
    return false;
  }

  const data = (candidate as { data?: unknown }).data;

  if (data === undefined) {
    return true;
  }

  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const { draft } = data as { draft?: unknown };

  return draft !== true;
}

function isPublishedSolutionEntry(candidate: unknown): candidate is DraftableEntry {
  return isPublishedDraftableEntry(candidate);
}

function isPublishedIndustryEntry(candidate: unknown): candidate is DraftableEntry {
  return isPublishedDraftableEntry(candidate);
}

/**
 * Centralized sanitizer that mirrors the header’s historical behavior. We clone the exported data
 * structure from the Radix navigation island, resolve all internal hrefs against the marketing
 * content collection, and drop anything that fails validation. The helper returns a brand new array
 * so downstream consumers can iterate freely without mutating the shared singleton.
 */
export async function getValidatedNavigationGroups(
  t?: Translator,
): Promise<ReadonlyArray<NavigationMenuGroup>> {
  const contentHrefLookup = await buildContentHrefLookup();

  const validatedGroups: NavigationMenuGroup[] = [];

  for (const group of navigationMenuGroups) {
    const validatedLinks: NavigationMenuLink[] = [];
    const localizedGroupLabel = translateWithFallback(t, group.labelKey, group.label);
    const localizedGroupDescription = translateWithFallback(
      t,
      group.descriptionKey,
      group.description,
    );

    for (const link of group.links) {
      const localizedLinkLabel = translateWithFallback(t, link.labelKey, link.label);
      const localizedLinkDescription = translateWithFallback(
        t,
        link.descriptionKey,
        link.description,
      );

      if (EXTERNAL_LINK_PATTERN.test(link.href)) {
        validatedLinks.push({
          ...link,
          label: localizedLinkLabel,
          description: localizedLinkDescription,
        });
        continue;
      }

      const canonicalHref = contentHrefLookup.get(normalizeInternalHref(link.href));

      if (!canonicalHref) {
        console.warn(
          `navigation: skipping "${link.label}" because ${link.href} does not resolve to a supported content entry`,
        );
        continue;
      }

      validatedLinks.push({
        ...link,
        href: canonicalHref,
        label: localizedLinkLabel,
        description: localizedLinkDescription,
      });
    }

    if (validatedLinks.length > 0) {
      validatedGroups.push({
        ...group,
        label: localizedGroupLabel,
        description: localizedGroupDescription,
        links: validatedLinks,
      });
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
export async function getFooterColumns(t?: Translator): Promise<ReadonlyArray<FooterColumn>> {
  const groups = await getValidatedNavigationGroups(t);

  const groupById = new Map(groups.map((group) => [group.id ?? group.label.toLowerCase(), group]));

  const columnBlueprint: ReadonlyArray<{
    readonly sourceId: string;
    readonly titleKey: string;
    readonly fallbackTitle: string;
  }> = [
    { sourceId: 'platform', titleKey: 'footer.columns.product.title', fallbackTitle: 'Product' },
    {
      sourceId: 'industries',
      titleKey: 'footer.columns.industries.title',
      fallbackTitle: 'Industries',
    },
    { sourceId: 'company', titleKey: 'footer.columns.company.title', fallbackTitle: 'Company' },
  ];

  const columns: FooterColumn[] = [];

  for (const blueprint of columnBlueprint) {
    const group = groupById.get(blueprint.sourceId);

    if (!group || group.links.length === 0) {
      continue;
    }

    columns.push({
      title: translateWithFallback(t, blueprint.titleKey, blueprint.fallbackTitle),
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
const canonicalFooterLegalLinks = [
  {
    id: 'privacy',
    label: 'Privacy Policy',
    href: '/legal/privacy',
    description: 'Data handling commitments, retention windows, and DSAR intake.',
  },
  {
    id: 'cookies',
    label: 'Cookie Policy',
    href: '/legal/cookie-policy',
    description: 'Tracking categories, Klaro consent mechanics, and DSAR coordination guidance.',
  },
  {
    id: 'terms',
    label: 'Terms of Service',
    href: '/legal/terms',
    description: 'Contractual obligations that govern platform access.',
  },
  {
    id: 'responsibleAi',
    label: 'Responsible AI',
    href: '/legal/responsible-ai',
    description: 'Guardrails that govern AI experimentation, auditability, and rollout.',
  },
] as const satisfies ReadonlyArray<{ id: string } & FooterLink>;

export function getFooterLegalLinks(t?: Translator): ReadonlyArray<FooterLink> {
  return canonicalFooterLegalLinks.map((link) => ({
    href: link.href,
    label: translateWithFallback(t, `footer.legal.links.${link.id}.label`, link.label),
    description: translateWithFallback(
      t,
      `footer.legal.links.${link.id}.description`,
      link.description ?? '',
    ),
  }));
}

/**
 * Contact metadata powers both the footer and future CRM automations. We break the address into
 * discrete lines so downstream consumers can render microformats or JSON-LD without parsing strings.
 */
export { getFooterContact };
