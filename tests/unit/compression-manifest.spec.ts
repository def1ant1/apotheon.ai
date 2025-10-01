import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test, beforeAll, describe } from 'vitest';

import {
  COMPRESSION_MANIFEST_PATH,
  CompressionManifestSchema,
  readCompressionManifest,
} from '../../scripts/build/postbuild-compress.mjs';
import { readViteManifest, type ViteManifest } from '../fixtures/compression/vite-manifest';

type CompressionManifest = import('zod').infer<typeof CompressionManifestSchema>;

const ROOT_DIR = fileURLToPath(new URL('../../', import.meta.url));
const VITE_MANIFEST_PATH = path.join(ROOT_DIR, 'dist', '.vite', 'manifest.json');
const ISLAND_PREFIX = 'src/components/islands/';

describe('postbuild compression manifest hardening', () => {
  let compressionManifest: CompressionManifest;
  let viteManifest: ViteManifest;

  beforeAll(async () => {
    /**
     * We intentionally build the shared state once to avoid re-reading and
     * re-parsing the manifests for each assertion. The upfront await ensures
     * downstream tests have deterministic data without sprinkling `await`
     * chaining across every assertion.
     */
    compressionManifest = (await readCompressionManifest({
      manifestPath: COMPRESSION_MANIFEST_PATH,
      requirePresence: true,
    })) ?? { generatedAt: '', assets: [] };
    viteManifest = await readViteManifest(VITE_MANIFEST_PATH);
  });

  test('compression manifest exists alongside dist output', async () => {
    await expect(fs.access(COMPRESSION_MANIFEST_PATH)).resolves.toBeUndefined();
  });

  test('every Astro island chunk advertises both brotli and gzip variants', async () => {
    const islandEntries = Object.entries(viteManifest).filter(([source]) =>
      source.startsWith(ISLAND_PREFIX),
    );

    expect(islandEntries.length).toBeGreaterThan(0);

    for (const [sourcePath, entry] of islandEntries) {
      const chunkFile = path.posix.join('dist', entry.file);
      const manifestEntry = compressionManifest.assets.find((asset) => asset.source === chunkFile);

      expect(
        manifestEntry,
        `Compression manifest is missing coverage for ${chunkFile} derived from ${sourcePath}.`,
      ).toBeTruthy();

      expect(manifestEntry?.brotli?.file).toBeTruthy();
      expect(manifestEntry?.gzip?.file).toBeTruthy();

      const brotliPath = path.join(ROOT_DIR, manifestEntry!.brotli.file);
      const gzipPath = path.join(ROOT_DIR, manifestEntry!.gzip.file);

      await expect(fs.access(brotliPath)).resolves.toBeUndefined();
      await expect(fs.access(gzipPath)).resolves.toBeUndefined();
    }
  });
});
