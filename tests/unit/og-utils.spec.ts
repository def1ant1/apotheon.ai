import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ensureOgAsset, isManifestEntryFresh } from '../../src/utils/og';
import * as manifest from '../../src/utils/og-manifest';

import type { OgManifestEntry } from '../../src/utils/og-manifest';

describe('OG helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('isManifestEntryFresh', () => {
    it('returns false when worker endpoint changes', () => {
      const entry = {
        workerEndpoint: 'https://a.example.com',
        expiresAt: new Date(Date.now() + 1000).toISOString(),
      } as OgManifestEntry;
      expect(isManifestEntryFresh(entry, 'https://b.example.com')).toBe(false);
    });

    it('returns false when expiration is stale', () => {
      const entry = {
        workerEndpoint: 'https://worker.example.com',
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      } as OgManifestEntry;
      expect(isManifestEntryFresh(entry, 'https://worker.example.com')).toBe(false);
    });

    it('returns true when signature is still valid', () => {
      const entry = {
        workerEndpoint: 'https://worker.example.com',
        expiresAt: new Date(Date.now() + 120_000).toISOString(),
      } as OgManifestEntry;
      expect(isManifestEntryFresh(entry, 'https://worker.example.com')).toBe(true);
    });
  });

  describe('ensureOgAsset', () => {
    it('returns cached manifest entries when fresh', async () => {
      const entry = {
        key: 'blog::welcome::default',
        scope: 'blog',
        slug: 'welcome',
        variant: 'default',
        url: 'https://worker.example.com/og/blog/welcome?signature=fake',
        workerEndpoint: 'https://worker.example.com',
        signature: 'fake',
        expiresAt: new Date(Date.now() + 180_000).toISOString(),
        generatedAt: new Date().toISOString(),
        width: 1200,
        height: 630,
        format: 'image/png',
      } as OgManifestEntry;
      const getSpy = vi.spyOn(manifest, 'getManifestEntry').mockResolvedValue(entry);
      const upsertSpy = vi.spyOn(manifest, 'upsertManifestEntry').mockResolvedValue();

      const result = await ensureOgAsset({
        workerEndpoint: 'https://worker.example.com',
        signingKey: 'secret',
        scope: 'blog',
        slug: 'welcome',
        title: 'Hello',
      });

      expect(result).toBe(entry);
      expect(getSpy).toHaveBeenCalled();
      expect(upsertSpy).not.toHaveBeenCalled();
    });

    it('requests the worker and persists manifest when stale', async () => {
      vi.spyOn(manifest, 'getManifestEntry').mockResolvedValue(null);
      const upsertSpy = vi.spyOn(manifest, 'upsertManifestEntry').mockResolvedValue();
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get: (key: string) => (key.toLowerCase() === 'content-type' ? 'image/png' : null),
        },
        arrayBuffer: async () => new ArrayBuffer(0),
        text: async () => '',
      });

      const now = () => new Date('2024-01-01T00:00:00Z').getTime();
      const result = await ensureOgAsset({
        workerEndpoint: 'https://worker.example.com',
        signingKey: 'secret',
        scope: 'blog',
        slug: 'welcome',
        title: 'Hello world',
        fetchImpl: fetchMock,
        now,
        ttlSeconds: 60,
      });

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('https://worker.example.com/og/blog/welcome'),
        expect.any(Object),
      );
      expect(upsertSpy).toHaveBeenCalledWith(expect.objectContaining({ slug: 'welcome' }));
      expect(result.url).toContain('https://worker.example.com/og/blog/welcome');
    });

    it('throws when the worker returns an error', async () => {
      vi.spyOn(manifest, 'getManifestEntry').mockResolvedValue(null);
      vi.spyOn(manifest, 'upsertManifestEntry').mockResolvedValue();
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        arrayBuffer: async () => new ArrayBuffer(0),
        text: async () => 'forbidden',
        headers: {
          get: () => null,
        },
      });

      await expect(
        ensureOgAsset({
          workerEndpoint: 'https://worker.example.com',
          signingKey: 'secret',
          scope: 'blog',
          slug: 'welcome',
          title: 'Hello world',
          fetchImpl: fetchMock,
        }),
      ).rejects.toThrow(/403/);
    });
  });
});
