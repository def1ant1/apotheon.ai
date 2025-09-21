#!/usr/bin/env node
import { access, constants, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HISTORY_ASSET_DIR = join(__dirname, '..', '..', 'src', 'assets', 'history');
const SUPPORTED_EXTENSIONS = new Set(['.svg']);
const TARGET_ASPECT_RATIO = 4 / 3;
const RATIO_TOLERANCE = 0.02;

async function pathExists(path) {
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

async function ensureDirectory(path) {
  await mkdir(path, { recursive: true });
}

function isAspectRatioValid(width, height) {
  const ratio = width / height;
  return Math.abs(ratio - TARGET_ASPECT_RATIO) <= RATIO_TOLERANCE;
}

function buildProvenancePath(sourcePath) {
  const directory = dirname(sourcePath);
  const name = basename(sourcePath);
  return join(directory, `${name}.provenance.json`);
}

async function readJsonIfExists(path) {
  const exists = await pathExists(path);
  if (!exists) {
    return null;
  }
  const contents = await readFile(path, 'utf8');
  try {
    return JSON.parse(contents);
  } catch (error) {
    console.warn('[history-media] Failed to parse provenance JSON at %s: %s', path, error);
    return null;
  }
}

function extractDimension(value) {
  const numeric = Number.parseFloat(value);
  if (Number.isFinite(numeric)) {
    return numeric;
  }
  throw new Error(`Unable to parse numeric dimension from "${value}"`);
}

function parseViewBoxDimensions(contents) {
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

function parseExplicitDimensions(contents) {
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

async function parseSvgMetadata(sourcePath) {
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

async function ensureProvenanceManifest(sourcePath, metadata) {
  const buffer = Buffer.from(metadata.contents, 'utf8');
  const hash = createHash('sha256').update(buffer).digest('hex');
  const provenancePath = buildProvenancePath(sourcePath);
  const existing = await readJsonIfExists(provenancePath);

  const manifest = {
    asset: basename(sourcePath),
    hash,
    generatedAt: existing?.generatedAt ?? new Date().toISOString(),
    validatedAspectRatio: metadata.ratio,
    viewBox: metadata.viewBox ?? null,
    dimensions: { width: metadata.width, height: metadata.height },
    credit: existing?.credit ?? 'Pending compliance verification',
    generatedBy: 'scripts/content/ensure-history-media.mjs',
  };

  const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
  const existingSerialized = existing ? `${JSON.stringify(existing, null, 2)}\n` : null;

  if (existingSerialized === serialized) {
    return false;
  }

  await writeFile(provenancePath, serialized, 'utf8');
  return true;
}

async function processAsset(file) {
  const sourcePath = join(HISTORY_ASSET_DIR, file);
  const metadata = await parseSvgMetadata(sourcePath);

  const provenanceUpdated = await ensureProvenanceManifest(sourcePath, metadata);

  console.info('[history-media] %s validated (aspect ratio %s).', file, metadata.ratio.toFixed(4));

  if (provenanceUpdated) {
    console.info('[history-media] Updated provenance manifest for %s', file);
  }
}

async function main() {
  await ensureDirectory(HISTORY_ASSET_DIR);
  const files = await readdir(HISTORY_ASSET_DIR);
  const baseAssets = files.filter((file) => SUPPORTED_EXTENSIONS.has(extname(file).toLowerCase()));

  if (baseAssets.length === 0) {
    console.warn('[history-media] No SVG assets detected under %s', HISTORY_ASSET_DIR);
    return;
  }

  for (const file of baseAssets) {
    await processAsset(file);
  }

  console.info('[history-media] Processed %d base asset(s).', baseAssets.length);
}

try {
  await main();
} catch (error) {
  console.error('[history-media] Failed to prepare timeline media:', error);
  process.exitCode = 1;
}
