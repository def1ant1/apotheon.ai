/* eslint-disable security/detect-non-literal-fs-filename */
import crypto from 'node:crypto';
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import sharp from 'sharp';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

describe('ensure-homepage-hero-media managed fallback', () => {
  const goldenRoot = resolve(process.cwd(), 'assets', 'design', 'homepage', 'hero');

  let assetRoot: string;
  let manifestPath: string;

  beforeEach(async () => {
    const tmpRoot = await mkdtemp(join(tmpdir(), 'homepage-hero-media-'));
    assetRoot = join(tmpRoot, 'assets');
    manifestPath = join(tmpRoot, 'manifest.json');
    process.env.HOMEPAGE_HERO_ASSET_ROOT = assetRoot;
    process.env.HOMEPAGE_HERO_MANIFEST_PATH = manifestPath;
    process.env.HOMEPAGE_HERO_GOLDEN_ROOT = goldenRoot;
    process.env.HOMEPAGE_HERO_DISABLE_RENDER = '1';
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.HOMEPAGE_HERO_ASSET_ROOT;
    delete process.env.HOMEPAGE_HERO_MANIFEST_PATH;
    delete process.env.HOMEPAGE_HERO_GOLDEN_ROOT;
    delete process.env.HOMEPAGE_HERO_DISABLE_RENDER;
    vi.restoreAllMocks();
  });

  it('hydrates the managed asset, preserves derivatives, and snapshots manifest output', async () => {
    const mod = await import('../ensure-homepage-hero-media');
    await mod.ensureHomepageHeroMedia();

    const basePath = join(assetRoot, 'hero-base.png');
    const avifPath = join(assetRoot, 'hero-base.avif');
    const webpPath = join(assetRoot, 'hero-base.webp');

    const metadata = await sharp(basePath).metadata();
    expect(metadata.width).toBe(1440);
    expect(metadata.height).toBe(960);

    const [avifStats, webpStats] = await Promise.all([stat(avifPath), stat(webpPath)]);
    expect(avifStats.size).toBeGreaterThan(0);
    expect(webpStats.size).toBeGreaterThan(0);

    const managedLedger = JSON.parse(
      await readFile(join(goldenRoot, 'managed-assets.json'), 'utf-8'),
    ) as {
      assets: Record<
        string,
        {
          checksum: string;
        }
      >;
    };
    const [baseBuffer, avifBuffer, webpBuffer] = await Promise.all([
      readFile(basePath),
      readFile(avifPath),
      readFile(webpPath),
    ]);
    const checksum = (buffer: Buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
    expect(checksum(baseBuffer)).toBe(managedLedger.assets['hero-base.png'].checksum);
    expect(checksum(avifBuffer)).toBe(managedLedger.assets['hero-base.avif'].checksum);
    expect(checksum(webpBuffer)).toBe(managedLedger.assets['hero-base.webp'].checksum);

    const manifest = JSON.parse(await readFile(manifestPath, 'utf-8'));
    expect(manifest.assets['homepage/hero-base']).toMatchInlineSnapshot(`
      {
        "base": "src/assets/homepage/hero-base.png",
        "checksum": "cdbb589d926071fa18b3c1cb909b0cad6305558923dda2e1e547c9c45bd2673c",
        "derivatives": {
          "avif": "src/assets/homepage/hero-base.avif",
          "webp": "src/assets/homepage/hero-base.webp",
        },
        "height": 960,
        "lcpCandidate": true,
        "preload": true,
        "width": 1440,
      }
    `);
  }, 20000);
});
