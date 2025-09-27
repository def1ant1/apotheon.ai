/* eslint-disable security/detect-non-literal-fs-filename */
import { createHash } from 'node:crypto';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';

import { WHITEPAPER_MANIFEST } from '../../../src/generated/whitepapers.manifest';
import { PLACEHOLDER_CHECKSUM, PLACEHOLDER_SIZE } from '../ensure-whitepapers';
import { generateWhitepapers } from '../generate-whitepapers';

describe('whitepaper automation pipeline', () => {
  it('renders PDFs and validates manifest metadata exceeds the placeholder baseline', async () => {
    const tmpRoot = await mkdtemp(join(tmpdir(), 'whitepaper-pdf-'));
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
      );
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
});
