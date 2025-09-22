import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

import {
  collectUniqueTags,
  filterBlogPostsByTag,
  resolveOgImage,
  scoreRelatedPosts,
  sortBlogPostsByPublishDate,
  type BlogCollectionEntry,
  type BlogEntryData,
} from '../../src/utils/blog';
import * as ogModule from '../../src/utils/og';
import { buildSchemaScriptHtml } from '../../src/utils/seo';

type EntryOverrides = {
  slug?: string;
  data?: Partial<BlogCollectionEntry['data']>;
};

function createEntry(overrides: EntryOverrides = {}): BlogCollectionEntry {
  const baseData: BlogEntryData = {
    title: 'Welcome',
    description: 'Launch',
    publishDate: new Date('2024-07-10T00:00:00Z'),
    heroImage: '/images/blog/welcome.svg',
    heroImageAlt: 'Hero',
    tags: ['launch'],
    estimatedReadingMinutes: 5,
    author: {
      name: 'Author One',
      bio: 'Bio',
      title: 'Role',
      links: [],
    },
    draft: false,
    openGraph: {
      image: '/images/og/blog/welcome.svg',
      alt: 'OG',
      generatorRequestId: 'test',
    },
  };

  const data: BlogEntryData = {
    ...baseData,
    ...overrides.data,
    author: {
      ...baseData.author,
      ...overrides.data?.author,
      links: overrides.data?.author?.links ?? baseData.author.links,
    },
    openGraph: {
      ...baseData.openGraph,
      ...overrides.data?.openGraph,
    },
    tags: overrides.data?.tags ?? baseData.tags,
    publishDate: overrides.data?.publishDate ?? baseData.publishDate,
  };

  const slug = overrides.slug ?? 'welcome';

  return {
    id: `blog/${slug}.mdx`,
    slug,
    body: '',
    collection: 'blog',
    data,
    render: async () => ({
      Content: (() => null) as any,
      headings: [],
      remarkPluginFrontmatter: {},
    }),
  } as unknown as BlogCollectionEntry;
}

describe('blog utilities', () => {
  describe('sortBlogPostsByPublishDate', () => {
    it('sorts descending by default', () => {
      const entries = [
        createEntry({ slug: 'older', data: { publishDate: new Date('2024-01-01T00:00:00Z') } }),
        createEntry({ slug: 'newer', data: { publishDate: new Date('2024-02-01T00:00:00Z') } }),
      ];
      const sorted = sortBlogPostsByPublishDate(entries);
      expect(sorted.map((entry) => entry.slug)).toEqual(['newer', 'older']);
    });

    it('sorts ascending when requested', () => {
      const entries = [
        createEntry({ slug: 'older', data: { publishDate: new Date('2024-01-01T00:00:00Z') } }),
        createEntry({ slug: 'newer', data: { publishDate: new Date('2024-02-01T00:00:00Z') } }),
      ];
      const sorted = sortBlogPostsByPublishDate(entries, 'asc');
      expect(sorted.map((entry) => entry.slug)).toEqual(['older', 'newer']);
    });
  });

  describe('filterBlogPostsByTag', () => {
    it('returns entries matching the provided tag regardless of casing', () => {
      const entries = [
        createEntry({ slug: 'launch', data: { tags: ['Launch'] } }),
        createEntry({ slug: 'governance', data: { tags: ['governance'] } }),
      ];
      const filtered = filterBlogPostsByTag(entries, 'LAUNCH');
      expect(filtered.map((entry) => entry.slug)).toEqual(['launch']);
    });

    it('clones array when no tag provided', () => {
      const entries = [createEntry({ slug: 'launch' })];
      const filtered = filterBlogPostsByTag(entries, null);
      expect(filtered).not.toBe(entries);
      expect(filtered).toEqual(entries);
    });
  });

  describe('collectUniqueTags', () => {
    it('deduplicates and sorts tags', () => {
      const entries = [
        createEntry({ data: { tags: ['governance', 'Launch'] } }),
        createEntry({ data: { tags: ['launch', 'mlops'] } }),
      ];
      expect(collectUniqueTags(entries)).toEqual(['governance', 'launch', 'mlops']);
    });
  });

  describe('scoreRelatedPosts', () => {
    const baseEntry = createEntry({
      slug: 'base',
      data: {
        tags: ['governance', 'mlops'],
      } as never,
    });

    it('ranks matches by overlapping tags', () => {
      const entries = [
        baseEntry,
        createEntry({ slug: 'match-1', data: { tags: ['governance'] } }),
        createEntry({ slug: 'match-2', data: { tags: ['mlops', 'governance'] } }),
        createEntry({ slug: 'match-3', data: { tags: ['observability'] } }),
      ];
      const related = scoreRelatedPosts(baseEntry, entries, 2);
      expect(related.map((entry) => entry.slug)).toEqual(['match-2', 'match-1']);
    });

    it('falls back to recent posts when tag overlap is missing', () => {
      const entries = [
        baseEntry,
        createEntry({
          slug: 'recent',
          data: { publishDate: new Date('2024-07-10T00:00:00Z'), tags: ['other'] },
        }),
        createEntry({
          slug: 'oldest',
          data: { publishDate: new Date('2024-01-01T00:00:00Z'), tags: ['misc'] },
        }),
      ];
      const related = scoreRelatedPosts(baseEntry, entries, 2);
      expect(related.map((entry) => entry.slug)).toEqual(['recent', 'oldest']);
    });
  });

  describe('buildSchemaScriptHtml', () => {
    it('escapes closing tag characters and handles arrays', () => {
      const html = buildSchemaScriptHtml([
        { '@type': 'Article', headline: '</script>' },
        { '@type': 'BreadcrumbList', name: 'Test' },
      ]);
      expect(html).toContain('\\u003C/script');
      expect(html.match(/<script/g)).toHaveLength(2);
    });
  });

  describe('resolveOgImage', () => {
    beforeEach(() => {
      vi.unstubAllEnvs();
      vi.stubEnv('PUBLIC_OG_IMAGE_WORKER', '');
    });

    afterEach(() => {
      vi.restoreAllMocks();
      vi.unstubAllEnvs();
    });

    it('returns absolute URLs when no worker is configured', async () => {
      const entry = createEntry({ slug: 'welcome' });
      const result = await resolveOgImage(entry, 'https://example.com');
      expect(result.url).toBe('https://example.com/images/og/blog/welcome.svg');
      expect(result.alt).toBe('OG');
    });

    it('builds worker URLs when the endpoint is provided', async () => {
      vi.stubEnv('PUBLIC_OG_IMAGE_WORKER', 'https://og-worker.example.com');
      vi.stubEnv('OG_IMAGE_SIGNING_KEY', 'test-secret');
      const ensureSpy = vi.spyOn(ogModule, 'ensureOgAsset').mockResolvedValue({
        key: 'blog::welcome::default',
        scope: 'blog',
        slug: 'welcome',
        variant: 'default',
        url: 'https://og-worker.example.com/og/blog/welcome?signature=fake',
        workerEndpoint: 'https://og-worker.example.com',
        signature: 'fake',
        expiresAt: new Date(Date.now() + 1_000_000).toISOString(),
        generatedAt: new Date().toISOString(),
        width: 1200,
        height: 630,
        format: 'image/png',
        source: 'https://example.com/images/og/blog/welcome.svg',
        lcpCandidate: true,
      });
      const entry = createEntry({ slug: 'welcome', data: { title: 'Worker Test' } });
      const result = await resolveOgImage(entry, 'https://example.com');
      expect(result.url).toBe('https://og-worker.example.com/og/blog/welcome?signature=fake');
      expect(ensureSpy).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'welcome', title: 'Worker Test' }),
      );
    });
  });
});
