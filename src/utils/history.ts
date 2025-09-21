import { getCollection, type CollectionEntry } from 'astro:content';

type HistoryCollectionEntry = CollectionEntry<'history'>;
type HistoryData = HistoryCollectionEntry['data'];

/**
 * Canonical route for the marketing page that renders the history timeline. Centralising the
 * constant keeps Schema.org builders and Playwright specs aligned with the actual Astro route.
 */
export const HISTORY_ROUTE = '/about/history/';

/**
 * Utility type describing the shape consumed by the Astro components. We merge the MDX render
 * function alongside the structured metadata so the page can stream body copy without triggering
 * additional `entry.render()` calls per component instance.
 */
export interface TimelineMilestone {
  readonly slug: string;
  readonly id: string;
  readonly href: string;
  readonly year: number;
  readonly headline: string;
  readonly narrative: string;
  readonly programArea: HistoryData['programArea'];
  readonly media: HistoryData['media'];
  readonly Content: Awaited<ReturnType<HistoryCollectionEntry['render']>>['Content'];
}

function createMilestoneId(year: number, slug: string): string {
  const sanitizedSlug = slug
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `milestone-${year}-${sanitizedSlug}`;
}

/**
 * Fetches and normalises history collection entries. Draft content is filtered automatically so
 * review workflows never leak into production builds or Schema.org payloads. Entries are sorted in
 * descending chronological order, matching stakeholder expectations for corporate timelines.
 */
export async function getTimelineMilestones(): Promise<ReadonlyArray<TimelineMilestone>> {
  const entries: HistoryCollectionEntry[] = await getCollection('history');

  const publishedEntries = entries.filter((entry) => entry.data.draft !== true);

  const decorated = await Promise.all(
    publishedEntries.map(async (entry) => {
      const { Content } = await entry.render();
      const id = createMilestoneId(entry.data.year, entry.slug);

      return {
        slug: entry.slug,
        id,
        href: `#${id}`,
        year: entry.data.year,
        headline: entry.data.headline,
        narrative: entry.data.narrative,
        programArea: entry.data.programArea,
        media: entry.data.media,
        Content,
      } satisfies TimelineMilestone;
    }),
  );

  return decorated.sort((a, b) => {
    if (a.year !== b.year) {
      return b.year - a.year;
    }

    return a.headline.localeCompare(b.headline, 'en', { sensitivity: 'base' });
  });
}

interface TimelineSchemaImage {
  '@type': 'ImageObject';
  url: string;
  caption?: string;
  creditText?: string;
}

interface TimelineSchemaItem {
  '@type': 'ListItem';
  position: number;
  name: string;
  item: {
    '@type': 'CreativeWork';
    name: string;
    description: string;
    url: string;
    datePublished: string;
    genre: string;
    image?: TimelineSchemaImage;
  };
}

interface TimelineSchema {
  '@context': 'https://schema.org';
  '@type': 'ItemList';
  name: string;
  description: string;
  itemListOrder: 'Descending';
  itemListElement: TimelineSchemaItem[];
}

function buildImageSchema(media: HistoryData['media'], origin: URL): TimelineSchemaImage {
  const url = new URL(`/assets/history/${media.src}`, origin);

  return {
    '@type': 'ImageObject',
    url: url.toString(),
    ...(media.caption ? { caption: media.caption } : {}),
    ...(media.credit ? { creditText: media.credit } : {}),
  };
}

/**
 * Serialises milestones into a Schema.org ItemList. This keeps the marketing page discoverable and
 * documents for editors how each field is repurposed in search/knowledge panels. Consumers pass the
 * site origin (Astro provides it via `Astro.site`) so local previews and production builds emit the
 * correct absolute URLs.
 */
export function buildTimelineSchema(
  milestones: ReadonlyArray<TimelineMilestone>,
  siteOrigin: URL,
): TimelineSchema {
  const baseUrl = new URL(HISTORY_ROUTE, siteOrigin);

  const itemListElement = milestones.map((milestone, index) => {
    const itemUrl = new URL(milestone.href, baseUrl);

    const schemaItem: TimelineSchemaItem = {
      '@type': 'ListItem',
      position: index + 1,
      name: `${milestone.year} — ${milestone.headline}`,
      item: {
        '@type': 'CreativeWork',
        name: milestone.headline,
        description: milestone.narrative,
        url: itemUrl.toString(),
        datePublished: `${milestone.year}-01-01`,
        genre: milestone.programArea,
        ...(milestone.media ? { image: buildImageSchema(milestone.media, siteOrigin) } : {}),
      },
    };

    return schemaItem;
  });

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Apotheon.ai corporate timeline',
    description:
      'Chronological history of Apotheon.ai milestones spanning research breakthroughs, platform delivery, and governance wins.',
    itemListOrder: 'Descending',
    itemListElement,
  } satisfies TimelineSchema;
}

export type { TimelineSchema };
