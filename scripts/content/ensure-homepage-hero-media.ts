#!/usr/bin/env tsx
/* eslint-disable security/detect-non-literal-fs-filename */
/**
 * Enterprise-grade content pipelines should never depend on humans manually copying assets
 * into place. This script guarantees that the homepage hero media exists before we invoke
 * Astro's image pipeline or Playwright. The placeholder is intentionally lightweight; design
 * teams can safely replace it with production artwork without fighting tooling overrides.
 */
import { createHash } from 'node:crypto';
import { access, constants, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
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
  const hasExistingAsset = await fileExists(HERO_ASSET_FILE);
  if (!hasExistingAsset) {
    await writePlaceholder(HERO_ASSET_FILE);
    console.info('[homepage-hero] Generated placeholder hero asset at %s', HERO_ASSET_FILE);
    console.info(
      '[homepage-hero] Replace this file with production artwork to update the live hero without editing templates.',
    );
  } else {
    console.info(
      '[homepage-hero] Existing hero asset detected; ensuring derivatives are refreshed.',
    );
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
