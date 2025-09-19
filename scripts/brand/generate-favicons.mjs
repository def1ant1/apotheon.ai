#!/usr/bin/env node
/**
 * Apotheon favicon + PWA icon automation.
 *
 * Goals
 * =====
 * 1. Treat the 512×512 brand master asset as the single source of truth for all favicons.
 * 2. Emit platform-specific icons (ICO, PNG, maskable variants) into `public/` with deterministic names.
 * 3. Keep the workflow idempotent so CI/CD can regenerate assets without diff churn.
 *
 * Why this script exists
 * =====================
 * Historically the repo shipped hand-edited favicons from a design template. That approach makes
 * it difficult to roll brand changes forward, is easy to forget during incident response, and
 * introduces accessibility issues (e.g., missing mask icons) across browser vendors. By folding the
 * entire pipeline into one Node script we:
 *   • remove manual rasterization steps for designers,
 *   • normalize compression settings so bundles stay small,
 *   • guarantee macOS/iOS/Safari receive proper pinned-tab treatment, and
 *   • let future PRs regen icons via `npm run brand:favicons`.
 *
 * Implementation notes
 * ====================
 * Sharp performs the heavy lifting for PNG resizing. `png-to-ico` builds a multi-resolution
 * favicon from the generated PNGs. Safari's mask icon + the SVG favicon are derived from source
 * vectors stored in `assets/brand-icons/` and normalized with our shared SVGO config so linters and
 * rendering engines agree on the markup.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { optimize } from 'svgo';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const ASSET_DIR = path.join(ROOT, 'assets', 'brand-icons');
const PUBLIC_DIR = path.join(ROOT, 'public');

const MASTER_ICON = path.join(ASSET_DIR, 'master-icon.svg');
const SOURCE_FAVICON_SVG = path.join(ASSET_DIR, 'favicon.svg');
const SOURCE_MASK_SVG = path.join(ASSET_DIR, 'mask.svg');

const OUTPUT_FILES = {
  faviconSvg: path.join(PUBLIC_DIR, 'favicon.svg'),
  maskSvg: path.join(PUBLIC_DIR, 'safari-pinned-tab.svg'),
  manifestIcons: [
    { filename: 'android-chrome-512x512.png', size: 512 },
    { filename: 'android-chrome-192x192.png', size: 192 },
    { filename: 'maskable-icon-512x512.png', size: 512 },
    { filename: 'maskable-icon-192x192.png', size: 192 },
    { filename: 'apple-touch-icon.png', size: 180 },
    { filename: 'mstile-150x150.png', size: 150 },
    { filename: 'favicon-48x48.png', size: 48, includeInIco: true },
    { filename: 'favicon-32x32.png', size: 32, includeInIco: true },
    { filename: 'favicon-16x16.png', size: 16, includeInIco: true },
  ],
  faviconIco: path.join(PUBLIC_DIR, 'favicon.ico'),
};

const require = createRequire(import.meta.url);
const pngToIco = require('png-to-ico').default;
const svgoConfig = require(path.join(ROOT, 'svgo.config.cjs'));

function log(step) {
  process.stdout.write(`⚙️  ${step}\n`);
}

async function assertFileExists(target, description) {
  try {
    await fs.access(target);
  } catch (error) {
    throw new Error(`Missing required ${description} at ${target}. Run brand designers' export pipeline first.`);
  }
}

async function cleanOutputs() {
  const filesToDelete = [
    OUTPUT_FILES.faviconSvg,
    OUTPUT_FILES.maskSvg,
    OUTPUT_FILES.faviconIco,
    ...OUTPUT_FILES.manifestIcons.map(({ filename }) => path.join(PUBLIC_DIR, filename)),
  ];

  await Promise.all(
    filesToDelete.map(async (file) => {
      await fs.rm(file, { force: true });
    }),
  );
}

async function writePngVariants() {
  const master = await sharp(MASTER_ICON, { density: 1024 });
  await Promise.all(
    OUTPUT_FILES.manifestIcons.map(async ({ filename, size }) => {
      const destination = path.join(PUBLIC_DIR, filename);
      const pipeline = master.clone().resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      });

      await pipeline.png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(destination);
    }),
  );
}

async function writeFaviconIco() {
  const icoBuffers = await Promise.all(
    OUTPUT_FILES.manifestIcons
      .filter((icon) => icon.includeInIco)
      .map(async ({ filename }) => {
        const filePath = path.join(PUBLIC_DIR, filename);
        return fs.readFile(filePath);
      }),
  );

  const ico = await pngToIco(icoBuffers);
  await fs.writeFile(OUTPUT_FILES.faviconIco, ico);
}

async function writeSvgAsset({ source, destination, description }) {
  const raw = await fs.readFile(source, 'utf8');
  const optimized = optimize(raw, {
    path: source,
    ...svgoConfig,
  });

  if (optimized.error) {
    throw new Error(`SVGO failed to optimize ${description}: ${optimized.error}`);
  }

  await fs.writeFile(destination, `${optimized.data}\n`);
}

async function main() {
  log('Verifying source assets exist');
  await Promise.all([
    assertFileExists(MASTER_ICON, 'master SVG icon blueprint'),
    assertFileExists(SOURCE_FAVICON_SVG, 'favicon SVG blueprint'),
    assertFileExists(SOURCE_MASK_SVG, 'mask SVG blueprint'),
  ]);

  log('Cleaning prior favicon outputs');
  await cleanOutputs();

  await fs.mkdir(PUBLIC_DIR, { recursive: true });

  log('Rasterizing PNG favicon variants');
  await writePngVariants();

  log('Building multi-resolution favicon.ico');
  await writeFaviconIco();

  log('Copying SVG favicon + mask assets');
  await writeSvgAsset({
    source: SOURCE_FAVICON_SVG,
    destination: OUTPUT_FILES.faviconSvg,
    description: 'favicon SVG',
  });
  await writeSvgAsset({
    source: SOURCE_MASK_SVG,
    destination: OUTPUT_FILES.maskSvg,
    description: 'mask SVG',
  });

  log('Favicon pipeline completed successfully ✅');
}

main().catch((error) => {
  console.error('Favicon generation failed:', error);
  process.exitCode = 1;
});
