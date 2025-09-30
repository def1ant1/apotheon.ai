/* eslint-disable security/detect-non-literal-fs-filename */
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import matter from 'gray-matter';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it, vi } from 'vitest';

import { PLACEHOLDER_CHECKSUM, PLACEHOLDER_SIZE, ensureWhitepapers } from '../ensure-whitepapers';
import { generateWhitepapers } from '../generate-whitepapers';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..');
const ASSETS_DIR = join(PROJECT_ROOT, 'assets', 'whitepapers');
const LEDGER_PATH = join(ASSETS_DIR, 'managed-assets.json');
const CONTENT_DIR = join(PROJECT_ROOT, 'src', 'content', 'whitepapers');

describe.sequential('whitepaper automation pipeline', () => {
  it('renders PDFs and validates manifest metadata exceeds the placeholder baseline', async () => {
    const tmpRoot = await mkdtemp(join(tmpdir(), 'whitepaper-pdf-'));
    const { WHITEPAPER_MANIFEST } = await import('../../../src/generated/whitepapers.manifest');
    const outputs = await generateWhitepapers({ assetsDir: tmpRoot });
    const manifestBySlug = new Map(
      WHITEPAPER_MANIFEST.map((entry) => [entry.slug, entry] as const),
    );

    expect(outputs).toHaveLength(WHITEPAPER_MANIFEST.length);

    for (const output of outputs) {
      const manifestEntry = manifestBySlug.get(output.slug);
      if (!manifestEntry) {
        throw new Error(`No manifest entry found for generated slug ${output.slug}`);
      }

      // We guardrail against regressions that accidentally reintroduce placeholder assets.
      expect(output.bytesWritten).toBeGreaterThan(PLACEHOLDER_SIZE);

      const pdfBuffer = await readFile(join(tmpRoot, output.assetFilename));
      const pdfArray = pdfBuffer.buffer.slice(
        pdfBuffer.byteOffset,
        pdfBuffer.byteOffset + pdfBuffer.byteLength,
      ) as ArrayBuffer;
      const pdf = await PDFDocument.load(pdfArray);
      const checksum = createHash('sha256').update(pdfBuffer).digest('hex');

      expect(checksum).not.toBe(PLACEHOLDER_CHECKSUM);
      expect(checksum).toBe(manifestEntry.asset.checksum);
      expect(pdf.getPageCount()).toBe(manifestEntry.asset.pageCount);
      expect(manifestEntry.asset.pageCount).toBeGreaterThan(1);

      const assetFilename = manifestEntry.asset.objectKey.split('/').pop();
      expect(assetFilename).toBe(output.assetFilename);
      manifestBySlug.delete(output.slug);
    }

    expect(manifestBySlug.size).toBe(0);
  }, 120000);

  it('hydrates managed ledger assets when the generator is unavailable', async () => {
    const generatorModule = await import('../generate-whitepapers');
    const spy = vi
      .spyOn(generatorModule, 'generateWhitepapers')
      .mockRejectedValueOnce(new Error('simulated generator outage'));

    const managedLedgerRaw = await readFile(LEDGER_PATH, 'utf8');
    const managedLedger = JSON.parse(managedLedgerRaw) as {
      assets: Array<{ slug: string; objectKey: string; checksum: string; pageCount: number }>;
    };
    const ledgerBySlug = new Map(managedLedger.assets.map((asset) => [asset.slug, asset] as const));

    const assetFilenames = Array.from(ledgerBySlug.values()).map((asset) =>
      asset.objectKey.split('/').pop(),
    );
    for (const filename of assetFilenames) {
      if (!filename) {
        continue;
      }
      await rm(join(ASSETS_DIR, filename), { force: true });
    }

    delete process.env.WHITEPAPER_DISABLE_GENERATOR;

    try {
      await ensureWhitepapers();
    } finally {
      spy.mockRestore();
    }

    vi.resetModules();

    const manifestUrl = pathToFileURL(
      join(PROJECT_ROOT, 'src', 'generated', 'whitepapers.manifest.ts'),
    ).href;
    const manifestModule = await import(`${manifestUrl}?managed-ledger=${Date.now()}`);
    const { WHITEPAPER_MANIFEST: manifestEntries } = manifestModule as {
      WHITEPAPER_MANIFEST: Array<{
        slug: string;
        asset: { checksum: string; pageCount: number; objectKey: string };
      }>;
    };
    const manifestBySlug = new Map(manifestEntries.map((entry) => [entry.slug, entry]));

    for (const [slug, asset] of ledgerBySlug.entries()) {
      const filename = asset.objectKey.split('/').pop();
      if (!filename) {
        throw new Error(`Managed ledger entry for ${slug} has an invalid object key`);
      }

      const assetPath = join(ASSETS_DIR, filename);
      const pdfBuffer = await readFile(assetPath);
      expect(pdfBuffer.byteLength).toBeGreaterThan(PLACEHOLDER_SIZE);

      const pdf = await PDFDocument.load(pdfBuffer);
      expect(pdf.getPageCount()).toBeGreaterThan(1);

      const checksum = createHash('sha256').update(pdfBuffer).digest('hex');
      expect(checksum).not.toBe(PLACEHOLDER_CHECKSUM);
      expect(checksum).toBe(asset.checksum);

      const frontmatterPath = join(CONTENT_DIR, `${slug}.mdx`);
      const raw = await readFile(frontmatterPath, 'utf8');
      const parsed = matter(raw);
      expect(parsed.data.asset.objectKey).toBe(asset.objectKey);
      expect(parsed.data.asset.checksum).toBe(asset.checksum);
      expect(parsed.data.asset.pageCount).toBe(asset.pageCount);

      const manifestEntry = manifestBySlug.get(slug);
      if (!manifestEntry) {
        throw new Error(`No manifest entry found for managed ledger slug ${slug}`);
      }
      expect(manifestEntry.asset.checksum).toBe(asset.checksum);
      expect(manifestEntry.asset.pageCount).toBe(asset.pageCount);
      expect(manifestEntry.asset.objectKey).toBe(asset.objectKey);
    }
  }, 120000);
});
