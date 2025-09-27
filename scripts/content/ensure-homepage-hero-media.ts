#!/usr/bin/env tsx
/* eslint-disable security/detect-non-literal-fs-filename */
/**
 * Enterprise-grade content pipelines should never depend on humans manually copying assets
 * into place. This script guarantees that the homepage hero media exists before we invoke
 * Astro's image pipeline or Playwright by deterministically rendering the artwork with the
 * Python generator. If the render step is unavailable, we fall back to a tiny placeholder so
 * downstream jobs still have a predictable file to read.
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, constants, mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
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
const HERO_ASSET_FILE = join(__dirname, '..', '..', 'src', 'assets', 'homepage', 'hero-base.png');
const HERO_ASSET_DIR = dirname(HERO_ASSET_FILE);
const HERO_RENDERER = join(__dirname, '..', 'design', 'render-homepage-hero.py');
const IMAGE_MANIFEST_PATH = join(
  __dirname,
  '..',
  '..',
  'src',
  'generated',
  'image-optimization.manifest.json',
);

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

async function renderHeroProcedurally(): Promise<boolean> {
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

async function ensureDerivatives(manifest: ImageManifest): Promise<void> {
  const buffer = await readFile(HERO_ASSET_FILE);
  const baseName = 'hero-base';
  const avifPath = join(HERO_ASSET_DIR, `${baseName}.avif`);
  const webpPath = join(HERO_ASSET_DIR, `${baseName}.webp`);

  const metadata = await sharp(buffer).metadata();
  const supportsDerivatives = hasUsableDimensions(metadata);

  let derivativesGenerated = false;
  if (supportsDerivatives) {
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
    checksum: createHash('sha256').update(buffer).digest('hex'),
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

async function main(): Promise<void> {
  await ensureDirectory(HERO_ASSET_DIR);
  const manifest = await readImageManifest(IMAGE_MANIFEST_PATH);
  const heroExists = await fileExists(HERO_ASSET_FILE);
  const needsRender = await shouldRegenerateHeroAsset(heroExists);

  if (needsRender) {
    const rendered = await renderHeroProcedurally();
    if (!rendered) {
      await writePlaceholder(HERO_ASSET_FILE);
      console.warn(
        '[homepage-hero] Placeholder asset written because procedural generation was unavailable.',
      );
    }
  } else {
    console.info('[homepage-hero] Existing hero asset is up to date; skipping regeneration.');
  }

  await ensureDerivatives(manifest);
  await writeImageManifest(IMAGE_MANIFEST_PATH, manifest);
}

try {
  await main();
} catch (error) {
  console.error('[homepage-hero] Failed to ensure hero media asset:', error);
  process.exitCode = 1;
}
