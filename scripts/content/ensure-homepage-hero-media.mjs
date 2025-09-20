#!/usr/bin/env node
/**
 * Enterprise-grade content pipelines should never depend on humans manually copying assets
 * into place. This script guarantees that the homepage hero media exists before we invoke
 * Astro's image pipeline or Playwright. The placeholder is intentionally lightweight; design
 * teams can safely replace it with production artwork without fighting tooling overrides.
 */
import { access, constants, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HERO_ASSET_FILE = join(__dirname, '..', '..', 'src', 'assets', 'homepage', 'hero-base.png');
const HERO_ASSET_DIR = dirname(HERO_ASSET_FILE);

/**
 * 1x1 PNG pixel encoded as base64. This keeps the placeholder visually unobtrusive while still
 * exercising the exact same asset pipeline that production imagery uses. Teams can drop a real
 * PNG (or any supported raster format) in the same location and the generator will gracefully
 * skip regeneration on subsequent runs.
 */
const PLACEHOLDER_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQImWNgYGD4DwABAwEAffYk3wAAAABJRU5ErkJggg==';

async function fileExists(path) {
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

async function ensureDirectory(path) {
  await mkdir(path, { recursive: true });
}

async function writePlaceholder(path) {
  const buffer = Buffer.from(PLACEHOLDER_BASE64, 'base64');
  await writeFile(path, buffer);
}

async function main() {
  const hasExistingAsset = await fileExists(HERO_ASSET_FILE);
  if (hasExistingAsset) {
    console.info('[homepage-hero] Existing hero asset detected; skipping placeholder generation.');
    return;
  }

  await ensureDirectory(HERO_ASSET_DIR);
  await writePlaceholder(HERO_ASSET_FILE);
  console.info('[homepage-hero] Generated placeholder hero asset at %s', HERO_ASSET_FILE);
  console.info(
    '[homepage-hero] Replace this file with production artwork to update the live hero without editing templates.',
  );
}

try {
  await main();
} catch (error) {
  console.error('[homepage-hero] Failed to ensure hero media asset:', error);
  process.exitCode = 1;
}
