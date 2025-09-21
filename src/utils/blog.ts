import type { CollectionEntry, InferEntrySchema } from 'astro:content';

export type BlogCollectionEntry = CollectionEntry<'blog'>;
export type BlogEntryData = InferEntrySchema<'blog'>;
export type BlogAuthorMetadata = BlogEntryData['author'];
export type BlogOpenGraphMetadata = BlogEntryData['openGraph'];

/**
 * Supported publish date sorting directions.
 */
export type PublishDateSort = 'asc' | 'desc';

/**
 * Extracts a normalized list of tags across the provided entries. Tags are
 * lower-cased to keep comparisons consistent without mutating the source data.
 */
export function collectUniqueTags(posts: BlogCollectionEntry[]): string[] {
  const accumulator = new Set<string>();
  for (const post of posts) {
    for (const tag of post.data.tags) {
      accumulator.add(tag.toLowerCase());
    }
  }
  return Array.from(accumulator).sort((a, b) => a.localeCompare(b));
}

/**
 * Returns a sorted copy of the posts array without mutating the input order.
 * Sorting defaults to descending because the blog index prioritizes recency.
 */
export function sortBlogPostsByPublishDate<T extends BlogCollectionEntry>(
  posts: T[],
  direction: PublishDateSort = 'desc',
): T[] {
  const multiplier = direction === 'asc' ? 1 : -1;
  return [...posts].sort((a, b) => {
    const comparison = a.data.publishDate.valueOf() - b.data.publishDate.valueOf();
    return comparison * multiplier;
  });
}

/**
 * Returns posts that include the provided tag (case-insensitive). An undefined
 * or "all" tag yields a cloned array so callers can continue chaining without
 * side effects.
 */
export function filterBlogPostsByTag<T extends BlogCollectionEntry>(
  posts: T[],
  tag: string | null | undefined,
): T[] {
  if (!tag || tag.toLowerCase() === 'all') {
    return [...posts];
  }

  const normalized = tag.trim().toLowerCase();
  return posts.filter((post) => post.data.tags.some((value) => value.toLowerCase() === normalized));
}

/**
 * Related post scoring favors overlapping tags first, then recency. The helper
 * intentionally filters drafts and the current entry to keep UI components
 * presentational.
 */
export function scoreRelatedPosts(
  current: BlogCollectionEntry,
  candidates: BlogCollectionEntry[],
  limit = 3,
): BlogCollectionEntry[] {
  const tagSet = new Set(current.data.tags.map((tag) => tag.toLowerCase()));
  const scored = candidates
    .filter((entry) => entry.slug !== current.slug && entry.data.draft !== true)
    .map((entry) => {
      const overlap = entry.data.tags.reduce((score, tag) => {
        return score + (tagSet.has(tag.toLowerCase()) ? 1 : 0);
      }, 0);

      return {
        entry,
        score: overlap,
      };
    });

  const strongMatches = scored
    .filter((item) => item.score > 0)
    .sort((a, b) => {
      if (b.score === a.score) {
        return b.entry.data.publishDate.valueOf() - a.entry.data.publishDate.valueOf();
      }
      return b.score - a.score;
    })
    .slice(0, limit)
    .map((item) => item.entry);

  if (strongMatches.length >= limit) {
    return strongMatches;
  }

  const fallback = scored
    .filter(
      (item) => item.score === 0 && !strongMatches.some((match) => match.slug === item.entry.slug),
    )
    .sort((a, b) => b.entry.data.publishDate.valueOf() - a.entry.data.publishDate.valueOf())
    .slice(0, Math.max(0, limit - strongMatches.length))
    .map((item) => item.entry);

  return [...strongMatches, ...fallback];
}

function isAbsoluteUrl(url: string): boolean {
  try {
    return Boolean(new URL(url));
  } catch {
    return false;
  }
}

/**
 * Resolves the OpenGraph image reference for an entry while preparing for the
 * upcoming Worker automation. When the PUBLIC_OG_IMAGE_WORKER endpoint is
 * provided the function returns the Worker URL so integration tests can assert
 * the placeholder wiring; otherwise it falls back to the curated asset.
 */
export function resolveOgImage(
  entry: BlogCollectionEntry,
  siteOrigin: string,
): { url: string; alt: string } {
  const candidate = entry.data.openGraph?.image ?? entry.data.heroImage;
  const altText = entry.data.openGraph?.alt ?? entry.data.heroImageAlt;
  const baseUrl = siteOrigin ?? '';

  let resolvedUrl = isAbsoluteUrl(candidate) ? candidate : new URL(candidate, baseUrl).href;

  const workerEndpoint = import.meta.env.PUBLIC_OG_IMAGE_WORKER;
  if (workerEndpoint) {
    const workerUrl = new URL(`/og/blog/${entry.slug}`, workerEndpoint);
    workerUrl.searchParams.set('source', resolvedUrl);
    workerUrl.searchParams.set('title', entry.data.title);
    // TODO(Epic-14): Replace this placeholder with a fetch that triggers image generation and persists the response URL.
    resolvedUrl = workerUrl.toString();
  }

  return { url: resolvedUrl, alt: altText };
}

// Schema helpers now live in src/utils/seo.ts. Blog utilities intentionally
// remain focused on content-specific behavior (tag sorting, OG image
// resolution, etc.).
