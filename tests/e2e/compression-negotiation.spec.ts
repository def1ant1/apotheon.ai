import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect, request as playwrightRequest } from '@playwright/test';

import {
  COMPRESSION_MANIFEST_PATH,
  CompressionManifestSchema,
  readCompressionManifest,
} from '../../scripts/build/postbuild-compress.mjs';
import { readViteManifest } from '../fixtures/compression/vite-manifest';

type CompressionManifest = import('zod').infer<typeof CompressionManifestSchema>;

const ROOT_DIR = fileURLToPath(new URL('../../', import.meta.url));
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const VITE_MANIFEST_PATH = path.join(DIST_DIR, '.vite', 'manifest.json');
const ISLAND_PREFIX = 'src/components/islands/';
const PREVIEW_PORT = 43220;
const PREVIEW_ORIGIN = `http://127.0.0.1:${PREVIEW_PORT}`;

type ChunkUnderTest = {
  requestPath: string;
  brotliPath: string;
  gzipPath: string;
  brotliBytes: number;
  gzipBytes: number;
};

async function waitForPreview(): Promise<void> {
  const deadline = Date.now() + 60_000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${PREVIEW_ORIGIN}/index.html`, { method: 'HEAD' });
      if (response.ok) {
        return;
      }
    } catch {
      // Swallow connection errors until the preview server is online.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error('Timed out waiting for astro preview to report ready state.');
}

function launchPreviewServer() {
  const executable = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const child = spawn(
    executable,
    ['run', 'preview', '--', '--host', '127.0.0.1', '--port', String(PREVIEW_PORT)],
    {
      cwd: ROOT_DIR,
      env: {
        ...process.env,
        NODE_ENV: 'production',
      },
      stdio: 'pipe',
    },
  );

  child.stdout?.on('data', (chunk) => {
    process.stdout.write(chunk);
  });

  child.stderr?.on('data', (chunk) => {
    process.stderr.write(chunk);
  });

  return child;
}

async function selectIslandChunk(): Promise<ChunkUnderTest> {
  const manifest =
    (await readCompressionManifest({
      manifestPath: COMPRESSION_MANIFEST_PATH,
      requirePresence: true,
    })) ?? ({ generatedAt: '', assets: [] } as CompressionManifest);
  const viteManifest = await readViteManifest(VITE_MANIFEST_PATH);

  const islandEntry = Object.entries(viteManifest).find(([source]) =>
    source.startsWith(ISLAND_PREFIX),
  );

  if (!islandEntry) {
    throw new Error('Unable to locate an Astro island entry inside the Vite manifest.');
  }

  const [, entry] = islandEntry;
  const chunkSource = path.posix.join('dist', entry.file);
  const manifestEntry = manifest.assets.find((asset) => asset.source === chunkSource);

  if (!manifestEntry) {
    throw new Error(`Compression manifest does not include metadata for ${chunkSource}.`);
  }

  return {
    requestPath: `/${entry.file}`,
    brotliPath: path.join(ROOT_DIR, manifestEntry.brotli.file),
    gzipPath: path.join(ROOT_DIR, manifestEntry.gzip.file),
    brotliBytes: manifestEntry.brotli.bytes,
    gzipBytes: manifestEntry.gzip.bytes,
  };
}

test.describe.serial('precompressed asset negotiation (astro preview)', () => {
  let previewProcess: ReturnType<typeof launchPreviewServer> | undefined;
  let chunk: ChunkUnderTest;

  test.beforeAll(async () => {
    previewProcess = launchPreviewServer();
    await waitForPreview();
    chunk = await selectIslandChunk();
  });

  test.afterAll(async () => {
    if (!previewProcess) {
      return;
    }

    await new Promise((resolve) => {
      previewProcess?.once('close', () => resolve(undefined));
      previewProcess?.kill('SIGINT');
    });
  });

  test('serves brotli payload when the client announces support', async () => {
    const context = await playwrightRequest.newContext({
      baseURL: PREVIEW_ORIGIN,
      extraHTTPHeaders: { 'Accept-Encoding': 'br, gzip' },
    });

    const response = await context.get(chunk.requestPath);
    const body = await response.body();
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Fixture paths stay within the repository sandbox.
    const brotliFile = await fs.readFile(chunk.brotliPath);

    expect(response.status(), 'Preview server should return a successful response').toBe(200);
    expect(response.headers()['content-encoding']).toBe('br');
    expect(Number(response.headers()['content-length'])).toBe(chunk.brotliBytes);
    expect(body.equals(brotliFile)).toBe(true);

    await context.dispose();
  });

  test('falls back to gzip when brotli is not offered', async () => {
    const context = await playwrightRequest.newContext({
      baseURL: PREVIEW_ORIGIN,
      extraHTTPHeaders: { 'Accept-Encoding': 'gzip' },
    });

    const response = await context.get(chunk.requestPath);
    const body = await response.body();
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Fixture paths stay within the repository sandbox.
    const gzipFile = await fs.readFile(chunk.gzipPath);

    expect(response.status(), 'Preview server should return a successful response').toBe(200);
    expect(response.headers()['content-encoding']).toBe('gzip');
    expect(Number(response.headers()['content-length'])).toBe(chunk.gzipBytes);
    expect(body.equals(gzipFile)).toBe(true);

    await context.dispose();
  });
});
