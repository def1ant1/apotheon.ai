#!/usr/bin/env node
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const ASTRO_DIR = path.join(DIST_DIR, '_astro');
const VITE_DIR = path.join(DIST_DIR, '.vite');

/**
 * The fixture seeds a deterministic `dist/` layout so tests can reason about
 * the compression pipeline even when a full `astro build` is unavailable (e.g.
 * CI environments that skip SSR adapters). The payload mirrors the output
 * shape Astro produces for an island component: a chunk in `_astro/` and a
 * corresponding entry in `.vite/manifest.json`.
 */
async function seedFixture() {
  await rm(DIST_DIR, { recursive: true, force: true });
  await Promise.all([
    mkdir(ASTRO_DIR, { recursive: true }),
    mkdir(VITE_DIR, { recursive: true }),
  ]);

  const chunkFileName = 'compression-fixture.12345.js';
  const chunkOutputPath = path.join(ASTRO_DIR, chunkFileName);
  const chunkSource = `export const marker = 'compression-fixture';\n`;

  await writeFile(chunkOutputPath, chunkSource, 'utf8');

  const viteManifest = {
    'src/components/islands/CompressionFixture.tsx': {
      file: `_astro/${chunkFileName}`,
      isEntry: true,
      src: 'src/components/islands/CompressionFixture.tsx',
    },
  };

  await writeFile(
    path.join(VITE_DIR, 'manifest.json'),
    `${JSON.stringify(viteManifest, null, 2)}\n`,
    'utf8',
  );

  const htmlScaffold = `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8" />\n    <title>Compression Fixture</title>\n  </head>\n  <body>\n    <script type="module" src="/_astro/${chunkFileName}"></script>\n  </body>\n</html>\n`;

  await writeFile(path.join(DIST_DIR, 'index.html'), htmlScaffold, 'utf8');
}

seedFixture().catch((error) => {
  console.error('[compression-fixture] Failed to seed dist/:', error);
  process.exitCode = 1;
});
