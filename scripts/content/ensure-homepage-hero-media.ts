#!/usr/bin/env tsx
/* eslint-disable security/detect-non-literal-fs-filename */
/**
 * Enterprise-grade content pipelines should never depend on humans manually copying assets
 * into place. This script guarantees that the homepage hero media exists before we invoke
 * Astro's image pipeline or Playwright by deterministically rendering the artwork with the
 * Python generator. If the render step is unavailable, we validate and hydrate a golden asset
 * that lives under version control before falling back to a placeholder for last-resort safety.
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, constants, mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp, { type Metadata as SharpMetadata } from 'sharp';

import {
  type ImageManifest,
  readImageManifest,
  toForwardSlash,
  upsertImageAsset,
  writeImageManifest,
} from './shared/image-manifest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const HERO_ASSET_DIR = resolve(
  process.env.HOMEPAGE_HERO_ASSET_ROOT ?? join(REPO_ROOT, 'src', 'assets', 'homepage'),
);
const HERO_ASSET_FILE = join(HERO_ASSET_DIR, 'hero-base.png');
const HERO_RENDERER = join(__dirname, '..', 'design', 'render-homepage-hero.py');
const HERO_MANAGED_DIR = resolve(
  process.env.HOMEPAGE_HERO_GOLDEN_ROOT ?? join(REPO_ROOT, 'assets', 'design', 'homepage', 'hero'),
);
const HERO_MANAGED_LEDGER = join(HERO_MANAGED_DIR, 'managed-assets.json');
const IMAGE_MANIFEST_PATH = resolve(
  process.env.HOMEPAGE_HERO_MANIFEST_PATH ??
    join(REPO_ROOT, 'src', 'generated', 'image-optimization.manifest.json'),
);
const HERO_MANAGED_FILES = {
  base: 'hero-base.png',
  avif: 'hero-base.avif',
  webp: 'hero-base.webp',
} as const;

const CLI_REFRESH_LEDGER_FLAG = '--refresh-managed-ledger';

/**
 * 1x1 PNG pixel encoded as base64. This keeps the placeholder visually unobtrusive while still
 * exercising the exact same asset pipeline that production imagery uses. Teams can drop a real
 * PNG (or any supported raster format) in the same location and the generator will gracefully
 * skip regeneration on subsequent runs.
 */
const PLACEHOLDER_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQImWNgYGD4DwABAwEAffYk3wAAAABJRU5ErkJggg==';

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code !== 'ENOENT') {
      // Surface non-ENOENT errors (permissions, etc.) for CI visibility.
      throw error;
    }
    return false;
  }
}

async function ensureDirectory(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

async function getModifiedTimeMs(path: string): Promise<number | null> {
  try {
    const stats = await stat(path);
    return stats.mtimeMs;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function deleteIfExists(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code !== 'ENOENT') {
      console.warn('[homepage-hero] Unable to remove stale derivative %s: %s', path, error);
    }
  }
}

async function writePlaceholder(path: string): Promise<void> {
  const buffer = Buffer.from(PLACEHOLDER_BASE64, 'base64');
  await writeFile(path, buffer);
}

function computeChecksum(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

/**
 * When the procedural renderer is offline we hydrate a pre-rendered hero from our managed
 * source of truth. Integrity is enforced by verifying SHA-256 checksums before decoding the
 * serialized binaries into the working asset directory.
 */
type ManagedAssetEncoding = 'base64' | 'hex';

interface ManagedLedgerAsset {
  checksum: string;
  content: string;
  encoding: ManagedAssetEncoding;
  /** Optional descriptive metadata for humans investigating the asset lineage. */
  source?: string;
}

interface ManagedLedger {
  assets: Record<string, ManagedLedgerAsset>;
  metadata?: Record<string, unknown>;
}

function decodeManagedAsset(asset: ManagedLedgerAsset, name: string): Buffer {
  const { content, encoding } = asset;
  if (encoding === 'base64') {
    return Buffer.from(content, 'base64');
  }
  if (encoding === 'hex') {
    return Buffer.from(content, 'hex');
  }
  const unsupportedEncoding = asset.encoding as string;
  throw new Error(
    `[homepage-hero] Unsupported encoding "${unsupportedEncoding}" for managed asset ${name}. Update managed-assets.json.`,
  );
}

async function hydrateHeroFromManagedSource(): Promise<'managed' | 'missing'> {
  const ledgerExists = await fileExists(HERO_MANAGED_LEDGER);
  if (!ledgerExists) {
    console.warn(
      '[homepage-hero] Managed fallback ledger missing at %s; proceeding without hydration.',
      HERO_MANAGED_LEDGER,
    );
    return 'missing';
  }

  let ledger: ManagedLedger;
  try {
    const raw = await readFile(HERO_MANAGED_LEDGER, 'utf-8');
    ledger = JSON.parse(raw) as ManagedLedger;
  } catch (error) {
    throw new Error(
      `[homepage-hero] Unable to parse managed asset ledger at ${HERO_MANAGED_LEDGER}: ${String(
        error,
      )}`,
    );
  }

  if (!ledger.assets) {
    throw new Error(
      `[homepage-hero] Managed asset ledger at ${HERO_MANAGED_LEDGER} is missing the assets field.`,
    );
  }

  await ensureDirectory(HERO_ASSET_DIR);

  for (const key of Object.values(HERO_MANAGED_FILES)) {
    const entry = ledger.assets[key];
    if (!entry) {
      throw new Error(
        `[homepage-hero] Managed asset ledger missing entry for ${key}. Update managed-assets.json.`,
      );
    }

    const buffer = decodeManagedAsset(entry, key);
    const checksum = computeChecksum(buffer);
    if (checksum !== entry.checksum) {
      throw new Error(
        `[homepage-hero] Managed asset ${key} failed checksum verification. Expected ${entry.checksum} but calculated ${checksum}.`,
      );
    }

    const targetPath =
      key === HERO_MANAGED_FILES.base ? HERO_ASSET_FILE : join(HERO_ASSET_DIR, key);
    await writeFile(targetPath, buffer);
  }

  console.info(
    '[homepage-hero] Hydrated hero artwork from managed ledger (%s).',
    HERO_MANAGED_LEDGER,
  );
  return 'managed';
}

export async function refreshManagedHeroLedger(): Promise<void> {
  const assetsToCapture: Array<{ key: string; path: string }> = [
    { key: HERO_MANAGED_FILES.base, path: HERO_ASSET_FILE },
    { key: HERO_MANAGED_FILES.avif, path: join(HERO_ASSET_DIR, HERO_MANAGED_FILES.avif) },
    { key: HERO_MANAGED_FILES.webp, path: join(HERO_ASSET_DIR, HERO_MANAGED_FILES.webp) },
  ];

  await ensureDirectory(HERO_MANAGED_DIR);

  const ledger: ManagedLedger = {
    assets: {},
    metadata: {
      refreshedAt: new Date().toISOString(),
      refreshedBy: 'ensure-homepage-hero-media --refresh-managed-ledger',
    },
  };

  if (!(await fileExists(HERO_ASSET_FILE))) {
    throw new Error(
      '[homepage-hero] Cannot refresh managed ledger because the base PNG is missing. Run the renderer first.',
    );
  }

  const baseBuffer = await readFile(HERO_ASSET_FILE);
  try {
    const metadata = await sharp(baseBuffer).metadata();
    ledger.metadata = {
      ...ledger.metadata,
      width: metadata.width ?? null,
      height: metadata.height ?? null,
    };
  } catch (error) {
    console.warn(
      '[homepage-hero] Unable to capture metadata for managed ledger refresh: %s',
      error,
    );
  }

  for (const { key, path } of assetsToCapture) {
    if (!(await fileExists(path))) {
      throw new Error(
        `[homepage-hero] Cannot refresh managed ledger because ${path} is missing. Run the renderer first.`,
      );
    }

    const buffer = await readFile(path);
    ledger.assets[key] = {
      checksum: computeChecksum(buffer),
      content: buffer.toString('base64'),
      encoding: 'base64',
    };
  }

  await writeFile(HERO_MANAGED_LEDGER, `${JSON.stringify(ledger, null, 2)}\n`, 'utf-8');
  console.info('[homepage-hero] Managed ledger refreshed at %s.', HERO_MANAGED_LEDGER);
}

async function shouldRegenerateHeroAsset(heroExists: boolean): Promise<boolean> {
  if (process.env.HOMEPAGE_HERO_FORCE_RENDER === '1') {
    console.info('[homepage-hero] Force rendering enabled via HOMEPAGE_HERO_FORCE_RENDER=1.');
    return true;
  }

  if (!heroExists) {
    return true;
  }

  try {
    const buffer = await readFile(HERO_ASSET_FILE);
    const metadata = await sharp(buffer).metadata();
    if (!hasUsableDimensions(metadata)) {
      console.info(
        '[homepage-hero] Existing hero asset dimensions are %sx%s; regenerating.',
        metadata.width ?? 0,
        metadata.height ?? 0,
      );
      return true;
    }
  } catch (error) {
    console.warn('[homepage-hero] Failed to inspect hero asset; regenerating. %s', error);
    return true;
  }

  const rendererExists = await fileExists(HERO_RENDERER);
  if (!rendererExists) {
    return false;
  }

  const [heroModified, rendererModified] = await Promise.all([
    getModifiedTimeMs(HERO_ASSET_FILE),
    getModifiedTimeMs(HERO_RENDERER),
  ]);

  if (heroModified === null) {
    return true;
  }

  if (rendererModified === null) {
    return false;
  }

  if (rendererModified > heroModified) {
    console.info(
      '[homepage-hero] Renderer newer than asset on disk (%s > %s); regenerating.',
      new Date(rendererModified).toISOString(),
      new Date(heroModified).toISOString(),
    );
    return true;
  }

  return false;
}

async function spawnProcess(binary: string, args: string[]): Promise<number> {
  return await new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: 'inherit' });
    child.on('error', (error) => {
      reject(error);
    });
    child.on('close', (code) => {
      resolve(code ?? 1);
    });
  });
}

async function installPillow(binary: string): Promise<boolean> {
  try {
    console.info('[homepage-hero] Attempting `pip install pillow` via %s.', binary);
    const exitCode = await spawnProcess(binary, ['-m', 'pip', 'install', '--quiet', 'pillow']);
    if (exitCode === 0) {
      console.info('[homepage-hero] Pillow installation succeeded via %s.', binary);
      return true;
    }
    console.warn(
      '[homepage-hero] Pillow installation via %s exited with code %s.',
      binary,
      exitCode,
    );
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      console.warn('[homepage-hero] Cannot install Pillow because %s is missing.', binary);
    } else {
      console.warn('[homepage-hero] Pillow installation via %s failed: %s', binary, error);
    }
  }
  return false;
}

export async function renderHeroProcedurally(): Promise<boolean> {
  if (process.env.HOMEPAGE_HERO_DISABLE_RENDER === '1') {
    console.info('[homepage-hero] Procedural renderer disabled via HOMEPAGE_HERO_DISABLE_RENDER.');
    return false;
  }

  const rendererExists = await fileExists(HERO_RENDERER);
  if (!rendererExists) {
    console.warn(
      '[homepage-hero] Renderer missing at %s; falling back to placeholder asset.',
      HERO_RENDERER,
    );
    return false;
  }

  const preferred = process.env.HOMEPAGE_HERO_PYTHON;
  const envPython = process.env.PYTHON;
  const candidates = Array.from(
    new Set(
      [
        preferred,
        envPython,
        'python3',
        'python',
        process.platform === 'win32' ? 'py' : undefined,
      ].filter((value): value is string => Boolean(value)),
    ),
  );

  let attemptedAutoInstall = false;
  for (const binary of candidates) {
    try {
      const exitCode = await spawnProcess(binary, [HERO_RENDERER, '--output', HERO_ASSET_FILE]);
      if (exitCode === 0) {
        console.info('[homepage-hero] Generated hero artwork via %s.', binary);
        return true;
      }
      console.warn('[homepage-hero] Renderer %s exited with code %s.', binary, exitCode);

      if (!attemptedAutoInstall) {
        attemptedAutoInstall = true;
        const installed = await installPillow(binary);
        if (installed) {
          const retryExit = await spawnProcess(binary, [
            HERO_RENDERER,
            '--output',
            HERO_ASSET_FILE,
          ]);
          if (retryExit === 0) {
            console.info(
              '[homepage-hero] Generated hero artwork via %s after installing Pillow.',
              binary,
            );
            return true;
          }
          console.warn(
            '[homepage-hero] Renderer %s still failed after installing Pillow (code %s).',
            binary,
            retryExit,
          );
        }
      }
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        console.warn('[homepage-hero] Skipping missing python binary "%s".', binary);
      } else {
        console.warn('[homepage-hero] Renderer %s failed: %s', binary, error);
      }
    }
  }

  console.warn('[homepage-hero] Unable to render hero procedurally. Install Pillow and retry.');
  return false;
}

function hasUsableDimensions(metadata: SharpMetadata): boolean {
  return (
    Number.isFinite(metadata.width) &&
    Number.isFinite(metadata.height) &&
    (metadata.width ?? 0) > 1 &&
    (metadata.height ?? 0) > 1
  );
}

type DerivativeStrategy = 'regenerate' | 'reuse';

async function ensureDerivatives(
  manifest: ImageManifest,
  strategy: DerivativeStrategy = 'regenerate',
): Promise<void> {
  const buffer = await readFile(HERO_ASSET_FILE);
  const baseName = 'hero-base';
  const avifPath = join(HERO_ASSET_DIR, `${baseName}.avif`);
  const webpPath = join(HERO_ASSET_DIR, `${baseName}.webp`);

  const metadata = await sharp(buffer).metadata();
  const supportsDerivatives = hasUsableDimensions(metadata);

  let derivativesGenerated = false;
  if (supportsDerivatives) {
    if (strategy === 'reuse') {
      const [avifExists, webpExists] = await Promise.all([
        fileExists(avifPath),
        fileExists(webpPath),
      ]);
      if (avifExists && webpExists) {
        derivativesGenerated = true;
        console.info('[homepage-hero] Reusing managed AVIF + WebP derivatives.');
      } else {
        console.warn(
          '[homepage-hero] Managed derivatives missing; regenerating from hydrated PNG.',
        );
      }
    }

    if (!derivativesGenerated) {
      try {
        await sharp(buffer).toFormat('avif', { quality: 55 }).toFile(avifPath);
        await sharp(buffer).toFormat('webp', { quality: 90 }).toFile(webpPath);
        derivativesGenerated = true;
        console.info('[homepage-hero] AVIF + WebP derivatives ready: %s, %s', avifPath, webpPath);
      } catch (error) {
        console.warn('[homepage-hero] Failed to generate derivatives: %s', error);
        await deleteIfExists(avifPath);
        await deleteIfExists(webpPath);
      }
    }
  } else {
    console.warn(
      '[homepage-hero] Skipping derivative generation because placeholder dimensions are %sx%s.',
      metadata.width ?? 0,
      metadata.height ?? 0,
    );
    await deleteIfExists(avifPath);
    await deleteIfExists(webpPath);
  }

  const entry = {
    base: toForwardSlash(join('src', 'assets', 'homepage', `${baseName}.png`)),
    derivatives: derivativesGenerated
      ? {
          avif: toForwardSlash(join('src', 'assets', 'homepage', `${baseName}.avif`)),
          webp: toForwardSlash(join('src', 'assets', 'homepage', `${baseName}.webp`)),
        }
      : {},
    preload: true,
    lcpCandidate: true,
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
    checksum: computeChecksum(buffer),
  };

  const updatedManifest = upsertImageAsset(manifest, `homepage/${baseName}`, entry);
  manifest.version = updatedManifest.version;
  manifest.assets = updatedManifest.assets;

  if (!derivativesGenerated) {
    console.info(
      '[homepage-hero] Derivatives unavailable; manifest updated for PNG fallback only.',
    );
  }
}

/**
 * Primary orchestration entry point invoked by both CI and local workflows. The fallback
 * cascade is intentionally explicit:
 * 1. Attempt to render procedurally via Python (preferred for deterministic regeneration).
 * 2. If rendering fails, verify and hydrate the managed golden assets (ensures parity).
 * 3. As a last resort, emit a transparent placeholder so downstream jobs still have bytes.
 *
 * Checksum validation within the managed fallback allows CI to gate merges when assets drift
 * from the committed ledger, while still keeping local developer flows unblocked with the
 * placeholder path above.
 */
export async function ensureHomepageHeroMedia(): Promise<void> {
  await ensureDirectory(HERO_ASSET_DIR);
  const manifest = await readImageManifest(IMAGE_MANIFEST_PATH);
  const heroExists = await fileExists(HERO_ASSET_FILE);
  const needsRender = await shouldRegenerateHeroAsset(heroExists);
  let derivativeStrategy: DerivativeStrategy = 'regenerate';

  if (needsRender) {
    const rendered = await renderHeroProcedurally();
    if (!rendered) {
      try {
        const hydrationResult = await hydrateHeroFromManagedSource();
        if (hydrationResult === 'managed') {
          derivativeStrategy = 'reuse';
        } else {
          await writePlaceholder(HERO_ASSET_FILE);
          console.warn(
            '[homepage-hero] Placeholder asset written because managed fallback was unavailable.',
          );
        }
      } catch (error) {
        await writePlaceholder(HERO_ASSET_FILE);
        console.error('[homepage-hero] Managed fallback failed integrity checks.', error);
        throw error;
      }
    }
  } else {
    console.info('[homepage-hero] Existing hero asset is up to date; skipping regeneration.');
  }

  await ensureDerivatives(manifest, derivativeStrategy);
  await writeImageManifest(IMAGE_MANIFEST_PATH, manifest);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const shouldRefreshLedger = process.argv.includes(CLI_REFRESH_LEDGER_FLAG);
  try {
    await ensureHomepageHeroMedia();
    if (shouldRefreshLedger) {
      await refreshManagedHeroLedger();
    }
  } catch (error) {
    console.error('[homepage-hero] Failed to ensure hero media asset:', error);
    process.exitCode = 1;
  }
}
