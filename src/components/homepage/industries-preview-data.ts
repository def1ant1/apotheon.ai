import { getCollection } from 'astro:content';

/**
 * Maximum number of industry cards surfaced on the homepage preview.
 * We intentionally keep the value low to avoid overwhelming visitors and to
 * signal that deeper exploration lives on the canonical /industries index.
 */
export const INDUSTRIES_PREVIEW_LIMIT = 6;

/**
 * Default summary copy used when an industry MDX file omits a custom summary.
 * Centralizing the fallback here ensures marketing can update the message once
 * without touching Astro templates or duplicating strings across components.
 */
const DEFAULT_INDUSTRY_SUMMARY =
  'Sector playbooks covering rollout patterns, compliance checkpoints, and mission-ready automations.';

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
}

/**
 * Coerce a marketing entry into the lightweight card contract used on the
 * homepage. We resolve the href relative to the industries index and provide a
 * defensive fallback when frontmatter omits optional fields.
 */
interface MarketingIndustryEntry {
  id: string;
  slug: string;
  data: {
    title: string;
    summary?: string;
    order?: number;
    draft: boolean;
  };
}

function isMarketingIndustryEntry(entry: unknown): entry is MarketingIndustryEntry {
  if (typeof entry !== 'object' || entry === null) {
    return false;
  }

  const candidate = entry as Record<string, unknown>;
  const data = candidate.data as Record<string, unknown> | undefined;

  return (
    typeof candidate.id === 'string' &&
    typeof candidate.slug === 'string' &&
    typeof data === 'object' &&
    data !== null &&
    typeof data.title === 'string' &&
    typeof data.draft === 'boolean' &&
    (typeof data.order === 'number' || typeof data.order === 'undefined') &&
    (typeof data.summary === 'string' || typeof data.summary === 'undefined')
  );
}

function mapToIndustryPreviewCard(entry: MarketingIndustryEntry): IndustryPreviewCard {
  const slugTerminal = entry.slug.split('/').pop() ?? entry.id;

  return {
    title: entry.data.title,
    summary: entry.data.summary ?? DEFAULT_INDUSTRY_SUMMARY,
    href: `/industries/${slugTerminal}/`,
    order: entry.data.order ?? 0,
  };
}

/**
 * Resolve the latest marketing industries destined for the homepage preview.
 *
 * The helper centralizes the following behaviors:
 * - Scopes the query to the `industries/` directory so other marketing content
 *   never pollutes the card set.
 * - Filters out unpublished drafts surfaced through the shared `draft` flag so
 *   marketing can stage updates safely.
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
  const rawEntries = (await getCollection('marketing')) as unknown[];

  const normalizedEntries = rawEntries.filter(isMarketingIndustryEntry);

  const industryEntries = normalizedEntries.filter((entry) => entry.id.startsWith('industries/'));

  const publishedIndustries = industryEntries
    .filter((entry) => !entry.data.draft)
    .map(mapToIndustryPreviewCard)
    .sort((a, b) => (a.order === b.order ? a.title.localeCompare(b.title) : a.order - b.order));

  return publishedIndustries.slice(0, limit);
}
