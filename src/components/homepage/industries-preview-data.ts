import { getCollection } from 'astro:content';

/**
 * Maximum number of industry cards surfaced on the homepage preview.
 * We intentionally keep the value low to avoid overwhelming visitors and to
 * signal that deeper exploration lives on the canonical /industries index.
 */
export const INDUSTRIES_PREVIEW_LIMIT = 6;

/**
 * Public shape consumed by the homepage industries preview component. The
 * helper returns fully normalized objects so rendering logic can remain focused
 * on layout and accessibility concerns instead of data massaging.
 */
export interface IndustryPreviewCard {
  /** Title pulled from the MDX frontmatter */
  title: string;
  /** Concise summary describing what a stakeholder will learn */
  summary: string;
  /** Canonical href pointing at the dedicated industry page */
  href: string;
  /** Numerical ordering flag that lets marketing rearrange emphasis */
  order: number;
  /** Icon slug surfaced on list cards to visually reinforce the sector */
  icon: string;
}

interface IndustryEntryLite {
  slug: string;
  data: {
    title: string;
    hero: {
      copy: string;
      icon: string;
    };
    order: number;
    draft?: boolean;
  };
}

function mapToIndustryPreviewCard(entry: IndustryEntryLite): IndustryPreviewCard {
  const slugTerminal = entry.slug;

  return {
    title: entry.data.title,
    summary: entry.data.hero.copy,
    href: `/industries/${slugTerminal}/`,
    order: entry.data.order,
    icon: entry.data.hero.icon,
  };
}

/**
 * Resolve the latest industries destined for the homepage preview.
 *
 * The helper centralizes the following behaviors:
 * - Scopes the query to the dedicated industries collection so other marketing
 *   content never pollutes the card set.
 * - Filters out unpublished drafts surfaced through the shared `draft` flag so
 *   editors can stage updates safely.
 * - Sorts by the shared `order` metadata to keep emphasis consistent with
 *   navigation, campaign landing pages, and investor collateral.
 * - Caps the result set based on `INDUSTRIES_PREVIEW_LIMIT` so the homepage
 *   remains scannable. Pagination is intentionally deferred to the dedicated
 *   /industries/ route.
 *
 * The function runs at build time, meaning outputs are cached inside the Astro
 * pipeline until the next rebuild. Marketing can drop or edit MDX files and the
 * preview automatically updates on the subsequent `npm run build` execution.
 */
export async function loadIndustriesPreviewCards(
  limit: number = INDUSTRIES_PREVIEW_LIMIT,
): Promise<IndustryPreviewCard[]> {
  const allEntries = (await getCollection('industries')) as IndustryEntryLite[];
  const industryEntries = allEntries.filter((entry) => !entry.data.draft);

  const publishedIndustries: IndustryPreviewCard[] = industryEntries
    .map((industry) => mapToIndustryPreviewCard(industry))
    .sort((a, b) => (a.order === b.order ? a.title.localeCompare(b.title) : a.order - b.order));

  return publishedIndustries.slice(0, limit);
}
