import { describe, expect, it, vi } from 'vitest';

import {
  WHITEPAPER_MANIFEST_BY_SLUG,
  WHITEPAPER_SLUGS,
} from '../../src/generated/whitepapers.manifest';
import {
  createSignedUrl,
  deriveCustomList,
  resolveWhitepaper,
  signedUrlSchema,
  type SignableBucket,
} from '../whitepapers';

describe('whitepaper worker helpers', () => {
  it('normalizes custom list strings into lowercase arrays', () => {
    expect(deriveCustomList('Example.com, Foo.com , ,BAR.org')).toEqual([
      'example.com',
      'foo.com',
      'bar.org',
    ]);
    expect(deriveCustomList(undefined)).toEqual([]);
  });

  it('resolves published whitepapers and rejects archived entries', () => {
    const slug = WHITEPAPER_SLUGS[0];
    const entry = resolveWhitepaper(slug);
    expect(entry.slug).toBe(slug);

    const manifestEntry = WHITEPAPER_MANIFEST_BY_SLUG.get(slug);
    expect(manifestEntry).toBeDefined();
    if (!manifestEntry) return;

    const archivedSlug = `${manifestEntry.slug}-archived-fixture`;
    const archivedEntry = {
      ...manifestEntry,
      slug: archivedSlug,
      lifecycle: { ...manifestEntry.lifecycle, archived: true },
    };
    WHITEPAPER_MANIFEST_BY_SLUG.set(archivedSlug, archivedEntry);
    expect(() => resolveWhitepaper(archivedSlug)).toThrow(/not available/);
    WHITEPAPER_MANIFEST_BY_SLUG.delete(archivedSlug);

    const embargoSlug = `${manifestEntry.slug}-embargo-fixture`;
    const embargoEntry = {
      ...manifestEntry,
      slug: embargoSlug,
      lifecycle: {
        ...manifestEntry.lifecycle,
        embargoedUntil: new Date(Date.now() + 86_400_000).toISOString(),
      },
    };
    WHITEPAPER_MANIFEST_BY_SLUG.set(embargoSlug, embargoEntry);
    expect(() => resolveWhitepaper(embargoSlug)).toThrow(/not yet available/);
    WHITEPAPER_MANIFEST_BY_SLUG.delete(embargoSlug);
  });

  it('produces signed URL payloads using bucket bindings', async () => {
    const mockUrl = 'https://example.com/whitepaper.pdf?signature=abc';
    const bucket = {
      createSignedUrl: vi.fn().mockResolvedValue(mockUrl),
    } as unknown as SignableBucket;

    const result = await createSignedUrl(bucket, 'whitepapers/example.pdf', 300);
    expect(result.url).toBe(mockUrl);
    expect(() => signedUrlSchema.parse(result)).not.toThrow();
    expect(bucket.createSignedUrl).toHaveBeenCalled();
  });
});
