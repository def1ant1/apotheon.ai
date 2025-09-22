#!/usr/bin/env tsx
/* eslint-disable security/detect-non-literal-fs-filename */
import { createHash } from 'node:crypto';
import { access, constants, mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

import {
  type ImageManifest,
  readImageManifest,
  toForwardSlash,
  upsertImageAsset,
  writeImageManifest,
} from './shared/image-manifest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HISTORY_ASSET_DIR = join(__dirname, '..', '..', 'src', 'assets', 'history');
const IMAGE_MANIFEST_PATH = join(
  __dirname,
  '..',
  '..',
  'src',
  'generated',
  'image-optimization.manifest.json',
);
const HISTORY_DERIVATIVE_DIR = join(__dirname, '..', '..', 'public', 'generated', 'history');
const SUPPORTED_EXTENSIONS = new Set(['.svg']);
const DERIVATIVE_EXTENSIONS = new Set(['.avif', '.webp']);
const TARGET_ASPECT_RATIO = 4 / 3;
const RATIO_TOLERANCE = 0.02;

interface ProvenanceManifest {
  readonly asset: string;
  readonly hash: string;
  readonly generatedAt: string;
  readonly validatedAspectRatio: number;
  readonly viewBox: {
    readonly minX: number;
    readonly minY: number;
    readonly width: number;
    readonly height: number;
  } | null;
  readonly dimensions: { readonly width: number; readonly height: number };
  readonly credit: string;
  readonly generatedBy: string;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code !== 'ENOENT') {
      throw error;
    }
    return false;
  }
}

async function ensureDirectory(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

async function removeFileIfExists(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code !== 'ENOENT') {
      console.warn('[history-media] Unable to remove stale derivative %s: %s', path, error);
    }
  }
}

/**
 * Derivative payloads are generated on demand and intentionally ignored by Git.
 * We aggressively prune anything that no longer matches the current SVG roster
 * so engineers never have to chase stale binaries during review cycles.
 */
async function cleanupDerivativeDirectory(
  directory: string,
  expectedBaseNames: ReadonlySet<string>,
): Promise<void> {
  const exists = await pathExists(directory);
  if (!exists) {
    return;
  }

  const entries = await readdir(directory);
  await Promise.all(
    entries.map(async (file) => {
      const extension = extname(file).toLowerCase();
      if (!DERIVATIVE_EXTENSIONS.has(extension)) {
        return;
      }

      const baseName = basename(file, extension);
      if (expectedBaseNames.has(baseName)) {
        return;
      }

      const absolute = join(directory, file);
      await removeFileIfExists(absolute);
    }),
  );
}

function isAspectRatioValid(width: number, height: number): boolean {
  const ratio = width / height;
  return Math.abs(ratio - TARGET_ASPECT_RATIO) <= RATIO_TOLERANCE;
}

function buildProvenancePath(sourcePath: string): string {
  const directory = dirname(sourcePath);
  const name = basename(sourcePath);
  return join(directory, `${name}.provenance.json`);
}

async function readJsonIfExists<T>(path: string): Promise<T | null> {
  const exists = await pathExists(path);
  if (!exists) {
    return null;
  }
  const contents = await readFile(path, 'utf8');
  try {
    return JSON.parse(contents) as T;
  } catch (error) {
    console.warn('[history-media] Failed to parse provenance JSON at %s: %s', path, error);
    return null;
  }
}

function extractDimension(value: string): number {
  const numeric = Number.parseFloat(value);
  if (Number.isFinite(numeric)) {
    return numeric;
  }
  throw new Error(`Unable to parse numeric dimension from "${value}"`);
}

type SvgViewBox = {
  readonly minX: number;
  readonly minY: number;
  readonly width: number;
  readonly height: number;
};

type SvgMetadata = {
  readonly contents: string;
  readonly width: number;
  readonly height: number;
  readonly ratio: number;
  readonly viewBox: SvgViewBox | null;
};

function parseViewBoxDimensions(contents: string): SvgViewBox | null {
  const viewBoxMatch = contents.match(/viewBox="([\d.\s-]+)"/i);
  if (!viewBoxMatch) {
    return null;
  }

  const [, raw] = viewBoxMatch;
  const [minX, minY, width, height] = raw
    .trim()
    .split(/\s+/)
    .map((token) => extractDimension(token));

  return {
    minX,
    minY,
    width,
    height,
  };
}

function parseExplicitDimensions(contents: string): { width: number; height: number } | null {
  const widthMatch = contents.match(/width="([\d.]+)"/i);
  const heightMatch = contents.match(/height="([\d.]+)"/i);

  if (!widthMatch || !heightMatch) {
    return null;
  }

  return {
    width: extractDimension(widthMatch[1]),
    height: extractDimension(heightMatch[1]),
  };
}

async function parseSvgMetadata(sourcePath: string): Promise<SvgMetadata> {
  const contents = await readFile(sourcePath, 'utf8');
  const viewBox = parseViewBoxDimensions(contents);
  const explicit = parseExplicitDimensions(contents);

  const width = viewBox?.width ?? explicit?.width;
  const height = viewBox?.height ?? explicit?.height;

  if (!width || !height) {
    throw new Error(
      `Asset ${basename(sourcePath)} is missing width/height information. Provide a viewBox or explicit dimensions.`,
    );
  }

  const ratio = width / height;

  if (!isAspectRatioValid(width, height)) {
    throw new Error(
      `Asset ${basename(sourcePath)} has aspect ratio ${ratio.toFixed(4)}. Expected ~${TARGET_ASPECT_RATIO.toFixed(2)} (4:3).`,
    );
  }

  return {
    contents,
    width,
    height,
    ratio,
    viewBox,
  };
}

interface GeneratedDerivatives {
  readonly avif: string;
  readonly webp: string;
}

async function generateDerivatives(
  sourcePath: string,
  metadata: SvgMetadata,
): Promise<GeneratedDerivatives> {
  const baseName = basename(sourcePath, extname(sourcePath));
  await ensureDirectory(HISTORY_DERIVATIVE_DIR);
  const avifPath = join(HISTORY_DERIVATIVE_DIR, `${baseName}.avif`);
  const webpPath = join(HISTORY_DERIVATIVE_DIR, `${baseName}.webp`);
  const svgBuffer = Buffer.from(metadata.contents, 'utf8');
  const targetWidth = Math.max(1600, Math.round(metadata.width ?? 1600));

  await sharp(svgBuffer, { density: 320 })
    .resize({ width: targetWidth })
    .toFormat('avif', { quality: 55 })
    .toFile(avifPath);

  await sharp(svgBuffer, { density: 320 })
    .resize({ width: targetWidth })
    .toFormat('webp', { quality: 90 })
    .toFile(webpPath);

  return {
    avif: toForwardSlash(join('public', 'generated', 'history', `${baseName}.avif`)),
    webp: toForwardSlash(join('public', 'generated', 'history', `${baseName}.webp`)),
  } satisfies GeneratedDerivatives;
}

async function ensureProvenanceManifest(
  sourcePath: string,
  metadata: SvgMetadata,
): Promise<boolean> {
  const buffer = Buffer.from(metadata.contents, 'utf8');
  const hash = createHash('sha256').update(buffer).digest('hex');
  const provenancePath = buildProvenancePath(sourcePath);
  const existing = await readJsonIfExists<ProvenanceManifest>(provenancePath);

  const manifest: ProvenanceManifest = {
    asset: basename(sourcePath),
    hash,
    generatedAt: existing?.generatedAt ?? new Date().toISOString(),
    validatedAspectRatio: metadata.ratio,
    viewBox: metadata.viewBox ?? null,
    dimensions: { width: metadata.width, height: metadata.height },
    credit: existing?.credit ?? 'Pending compliance verification',
    generatedBy: 'scripts/content/ensure-history-media.ts',
  };

  const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
  const existingSerialized = existing ? `${JSON.stringify(existing, null, 2)}\n` : null;

  if (existingSerialized === serialized) {
    return false;
  }

  await writeFile(provenancePath, serialized, 'utf8');
  return true;
}

async function processAsset(file: string, manifest: ImageManifest): Promise<void> {
  const sourcePath = join(HISTORY_ASSET_DIR, file);
  const metadata = await parseSvgMetadata(sourcePath);

  await ensureProvenanceManifest(sourcePath, metadata);

  const derivatives = await generateDerivatives(sourcePath, metadata);

  const key = `history/${basename(file, extname(file))}`;
  const basePath = toForwardSlash(join('src', 'assets', 'history', file));

  const entry = {
    base: basePath,
    derivatives: {
      avif: derivatives.avif,
      webp: derivatives.webp,
    },
    preload: true,
    lcpCandidate: true,
    width: metadata.width,
    height: metadata.height,
    checksum: createHash('sha256').update(Buffer.from(metadata.contents, 'utf8')).digest('hex'),
  };

  const updated = upsertImageAsset(manifest, key, entry);
  manifest.version = updated.version;
  manifest.assets = updated.assets;
}

async function main(): Promise<void> {
  await ensureDirectory(HISTORY_ASSET_DIR);
  await ensureDirectory(HISTORY_DERIVATIVE_DIR);
  const manifest = await readImageManifest(IMAGE_MANIFEST_PATH);
  const files = await readdir(HISTORY_ASSET_DIR);

  const svgAssets = files
    .filter((file) => SUPPORTED_EXTENSIONS.has(extname(file).toLowerCase()))
    .sort((a, b) => a.localeCompare(b));

  const expectedBaseNames = new Set(svgAssets.map((file) => basename(file, extname(file))));

  await cleanupDerivativeDirectory(HISTORY_ASSET_DIR, expectedBaseNames);
  await cleanupDerivativeDirectory(HISTORY_DERIVATIVE_DIR, expectedBaseNames);

  if (svgAssets.length === 0) {
    console.warn(
      '[history-media] No SVG assets located in %s. Skipping derivative generation.',
      HISTORY_ASSET_DIR,
    );
  }

  for (const file of svgAssets) {
    try {
      await processAsset(file, manifest);
    } catch (error) {
      console.error('[history-media] Failed to process %s: %s', file, error);
      throw error;
    }
  }

  await writeImageManifest(IMAGE_MANIFEST_PATH, manifest);
}

try {
  await main();
} catch (error) {
  console.error('[history-media] Unable to prepare history media assets:', error);
  process.exitCode = 1;
}
