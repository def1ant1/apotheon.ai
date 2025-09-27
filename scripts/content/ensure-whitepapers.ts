#!/usr/bin/env tsx
/* eslint-disable security/detect-non-literal-fs-filename */
/**
 * Enterprise ready content automation hinges on reproducible assets. This ensure script orchestrates
 * PDF generation, validates checksums, and keeps the manifest synchronized with MDX frontmatter so
 * deploy pipelines can trust the catalog without manual spreadsheet updates.
 */
import { createHash } from 'node:crypto';
import { access, constants, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { PDFDocument } from 'pdf-lib';
import { stringify as stringifyYaml, parse as parseYaml } from 'yaml';

import { type GeneratedWhitepaper, generateWhitepapers } from './generate-whitepapers';

export const PLACEHOLDER_PDF_BASE64 =
  'JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKPj4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovTWVkaWFCb3ggWzAgMCA2MTIgNzkyXQovQ29udGVudHMgNCAwIFIKL1Jlc291cmNlcyA8PAovRm9udCA8PAovRjEgNSAwIFIKPj4KPj4KPj4KZW5kb2JqCjQgMCBvYmoKPDwKL0xlbmd0aCA1Nwo+PgpzdHJlYW0KQlQKL0YxIDE0IFRmCjcyIDcwMCBUZCAoQXBvdGhlb24gV2hpdGVwYXBlciBQbGFjZWhvbGRlcikgVGoxMDAgNjgwIFRmIChTY3JpcHQtZ2VuZXJhdGVkIHBsYWNlaG9sZGVyKSBFApFVAplbmRzdHJlYW0KZW5kb2JqCjUgMCBvYmoKPDwKL1R5cGUgL0ZvbnQKL1N1YnR5cGUgL1R5cGUxCi9OYW1lIC9GMQovQmFzZUZvbnQgL0hlbHZldGljYQovRW5jb2RpbmcgL0Jhc2U2NAo+PgplbmRvYmoKeHJlZgowIDYKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDE1IDAwMDAwIG4gCjAwMDAwMDAwNzUgMDAwMDAgbiAKMDAwMDAwMDE3NiAwMDAwMCBuIAowMDAwMDAwMjk4IDAwMDAwIG4gCjAwMDAwMDAzOTEgMDAwMDAgbiAKdHJhaWxlcgo8PAovU2l6ZSA2Ci9Sb290IDEgMCBSCj4+CnN0YXJ0eHJlZgo0NzIKJSVFT0Y=';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..');
const CONTENT_DIR = join(PROJECT_ROOT, 'src', 'content', 'whitepapers');
const ASSETS_DIR = join(PROJECT_ROOT, 'assets', 'whitepapers');
const MANAGED_LEDGER_PATH = join(ASSETS_DIR, 'managed-assets.json');
const MANIFEST_PATH = join(PROJECT_ROOT, 'src', 'generated', 'whitepapers.manifest.ts');

export const PLACEHOLDER_BUFFER = Buffer.from(PLACEHOLDER_PDF_BASE64, 'base64');
export const PLACEHOLDER_CHECKSUM = createHash('sha256').update(PLACEHOLDER_BUFFER).digest('hex');
export const PLACEHOLDER_SIZE = PLACEHOLDER_BUFFER.byteLength;

interface FrontmatterAsset {
  objectKey: string;
  checksum: string;
  contentType: string;
  pageCount: number;
}

interface FrontmatterShape {
  title: string;
  summary: string;
  industries: string[];
  asset: FrontmatterAsset;
  gatingNotes: {
    distribution: string;
    reviewerChecklist: string[];
    complianceContacts: Array<{ team: string; email: string }>;
  };
  lifecycle: {
    draft: boolean;
    archived: boolean;
    embargoedUntil?: string | Date;
  };
  seo?: Record<string, unknown>;
}

interface ManifestEntry extends FrontmatterShape {
  slug: string;
}

interface ManagedLedgerAsset {
  slug: string;
  objectKey: string;
  checksum: string;
  byteLength: number;
  pageCount: number;
  base64: string;
  capturedAt: string;
  provenance: string[];
}

interface ManagedLedger {
  version: number;
  generatedAt: string;
  sourceOfTruth: string;
  automationNotes: string[];
  assets: ManagedLedgerAsset[];
}

interface ManagedLedgerRuntimeAsset extends ManagedLedgerAsset {
  buffer: Buffer;
}

type AssetSource = 'generator' | 'managed-ledger' | 'placeholder';

function computeChecksum(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code !== 'ENOENT'
    ) {
      throw error;
    }
    return false;
  }
}

function buildManifestSource(entries: ManifestEntry[]): string {
  const manifestArray = JSON.stringify(entries, null, 2).replace(/"([^("]+)":/g, '$1:');
  return `export interface WhitepaperManifestEntry {\n  readonly slug: string;\n  readonly title: string;\n  readonly summary: string;\n  readonly industries: ReadonlyArray<string>;\n  readonly asset: {\n    readonly objectKey: string;\n    readonly checksum: string;\n    readonly contentType: string;\n    readonly pageCount: number;\n  };\n  readonly gatingNotes: {\n    readonly distribution: string;\n    readonly reviewerChecklist: ReadonlyArray<string>;\n    readonly complianceContacts: ReadonlyArray<{ team: string; email: string }>;\n  };\n  readonly lifecycle: {\n    readonly draft: boolean;\n    readonly archived: boolean;\n    readonly embargoedUntil?: string;\n  };\n  readonly seo?: Record<string, unknown>;\n}\n\nexport const WHITEPAPER_MANIFEST: ReadonlyArray<WhitepaperManifestEntry> = ${manifestArray} as const;\n\nexport const WHITEPAPER_MANIFEST_BY_SLUG = new Map(\n  WHITEPAPER_MANIFEST.map((entry) => [entry.slug, entry] as const),\n);\n\nexport const WHITEPAPER_SLUGS = WHITEPAPER_MANIFEST.map((entry) => entry.slug);\n`;
}

async function readMdxFrontmatter(
  filePath: string,
): Promise<{ frontmatter: FrontmatterShape; body: string; rawFrontmatter: string }> {
  const raw = await readFile(filePath, 'utf8');
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/u);
  if (!match) {
    throw new Error(`File ${filePath} is missing frontmatter.`);
  }
  const frontmatter = parseYaml(match[1]) as FrontmatterShape;
  const body = match[2] ?? '';
  return { frontmatter, body, rawFrontmatter: match[1] };
}

async function writeMdxFrontmatter(
  filePath: string,
  frontmatter: FrontmatterShape,
  body: string,
): Promise<void> {
  const serialized = stringifyYaml(frontmatter, { lineWidth: 80 }).trimEnd();
  const normalized = serialized.replace(/(embargoedUntil:\s*)([^\n]+)/u, (_, prefix, rawValue) => {
    const value = typeof rawValue === 'string' ? rawValue : String(rawValue ?? '');
    if (value.length === 0 || value.startsWith("'")) {
      return `${prefix}${value}`;
    }
    return `${prefix}'${value}'`;
  });
  const contents = `---\n${normalized}\n---\n\n${body}`;
  await writeFile(filePath, contents, 'utf8');
}

async function ensurePlaceholderAsset(assetPath: string): Promise<void> {
  const exists = await fileExists(assetPath);
  if (exists) {
    return;
  }
  await mkdir(dirname(assetPath), { recursive: true });
  await writeFile(assetPath, PLACEHOLDER_BUFFER);
  console.warn('[whitepapers] placeholder hydrated at %s (generator unavailable)', assetPath);
}

async function loadManagedLedger(): Promise<Map<string, ManagedLedgerRuntimeAsset>> {
  const ledgerExists = await fileExists(MANAGED_LEDGER_PATH);
  if (!ledgerExists) {
    return new Map();
  }

  const raw = await readFile(MANAGED_LEDGER_PATH, 'utf8');
  let parsed: ManagedLedger;
  try {
    parsed = JSON.parse(raw) as ManagedLedger;
  } catch (error) {
    throw new Error(`Unable to parse managed whitepaper ledger: ${(error as Error).message}`);
  }

  if (!Array.isArray(parsed.assets)) {
    throw new Error('Managed whitepaper ledger is missing the assets array.');
  }

  const managed = new Map<string, ManagedLedgerRuntimeAsset>();
  for (const asset of parsed.assets) {
    if (!asset?.slug || !asset.objectKey || !asset.base64) {
      console.warn('[whitepapers] skipping malformed ledger entry: %o', asset);
      continue;
    }

    const buffer = Buffer.from(asset.base64, 'base64');
    const checksum = computeChecksum(buffer);
    if (checksum !== asset.checksum) {
      throw new Error(
        `Checksum mismatch for managed asset ${asset.slug}; ledger declared ${asset.checksum} but decoded ${checksum}.`,
      );
    }

    if (buffer.byteLength !== asset.byteLength) {
      throw new Error(
        `Byte length mismatch for managed asset ${asset.slug}; ledger declared ${asset.byteLength} but decoded ${buffer.byteLength}.`,
      );
    }

    managed.set(asset.slug, { ...asset, buffer });
  }

  return managed;
}

async function hydrateManagedAsset(
  slug: string,
  assetPath: string,
  ledgerAsset: ManagedLedgerRuntimeAsset,
): Promise<{ buffer: Buffer; checksum: string; pageCount: number; source: AssetSource }> {
  const existing = (await fileExists(assetPath)) ? await readFile(assetPath) : null;
  if (existing) {
    const existingChecksum = computeChecksum(existing);
    if (existingChecksum === ledgerAsset.checksum) {
      return {
        buffer: existing,
        checksum: ledgerAsset.checksum,
        pageCount: ledgerAsset.pageCount,
        source: 'managed-ledger',
      };
    }

    console.info(
      '[whitepapers] replacing divergent asset on disk for %s (expected %s, found %s)',
      slug,
      ledgerAsset.checksum,
      existingChecksum,
    );
  }

  await mkdir(dirname(assetPath), { recursive: true });
  await writeFile(assetPath, ledgerAsset.buffer);
  console.info('[whitepapers] hydrated %s from managed ledger', slug);

  return {
    buffer: ledgerAsset.buffer,
    checksum: ledgerAsset.checksum,
    pageCount: ledgerAsset.pageCount,
    source: 'managed-ledger',
  };
}

async function resolveAsset(
  slug: string,
  assetPath: string,
  generated: GeneratedWhitepaper | undefined,
  ledgerAsset: ManagedLedgerRuntimeAsset | undefined,
): Promise<{ buffer: Buffer; checksum: string; pageCount: number; source: AssetSource }> {
  if (generated) {
    /**
     * Primary path — when Playwright is available we trust the freshly rendered PDF and only
     * validate its integrity before synchronizing metadata downstream.
     */
    const buffer = await readFile(generated.assetPath);
    const metadata = await loadPdfMetadata(buffer);
    if (metadata.checksum !== generated.checksum) {
      throw new Error(
        `Checksum drift detected for generated asset ${slug}: expected ${generated.checksum} but calculated ${metadata.checksum}.`,
      );
    }

    if (metadata.pageCount !== generated.pageCount) {
      throw new Error(
        `Page count drift detected for generated asset ${slug}: expected ${generated.pageCount} but decoded ${metadata.pageCount}.`,
      );
    }

    return {
      buffer,
      checksum: generated.checksum,
      pageCount: generated.pageCount,
      source: 'generator',
    };
  }

  if (ledgerAsset) {
    /**
     * Secondary path — generator outages hydrate the managed ledger capture. Checksums are verified
     * before writing so we never downgrade vetted binaries.
     */
    const hydrated = await hydrateManagedAsset(slug, assetPath, ledgerAsset);
    const metadata = await loadPdfMetadata(hydrated.buffer);
    if (metadata.checksum !== ledgerAsset.checksum) {
      throw new Error(
        `Managed ledger checksum mismatch for ${slug}; decoded ${metadata.checksum} but ledger records ${ledgerAsset.checksum}.`,
      );
    }

    if (metadata.pageCount !== ledgerAsset.pageCount) {
      throw new Error(
        `Managed ledger page count mismatch for ${slug}; decoded ${metadata.pageCount} but ledger records ${ledgerAsset.pageCount}.`,
      );
    }

    return { ...hydrated };
  }

  /**
   * Final safety net — when Playwright is down and the ledger lacks coverage we intentionally fall
   * back to the placeholder asset. Frontmatter/manifest metadata stay untouched so the last known
   * good checksum continues to protect signed URL workflows.
   */
  await ensurePlaceholderAsset(assetPath);
  const buffer = await readFile(assetPath);
  const metadata = await loadPdfMetadata(buffer);
  return {
    buffer,
    checksum: metadata.checksum,
    pageCount: metadata.pageCount,
    source: 'placeholder',
  };
}

async function loadPdfMetadata(buffer: Buffer): Promise<{ checksum: string; pageCount: number }> {
  /**
   * Checksums anchor downstream compliance automation—Cloudflare Workers validate request bodies
   * against this digest before handing out signed URLs. We simultaneously decode the PDF with
   * `pdf-lib` so the MDX frontmatter always reflects the real page count instead of an estimate.
   */
  const checksum = computeChecksum(buffer);
  try {
    const pdf = await PDFDocument.load(buffer);
    const pageCount = pdf.getPageCount();
    return { checksum, pageCount };
  } catch (error) {
    if (checksum === PLACEHOLDER_CHECKSUM) {
      console.warn(
        '[whitepapers] detected placeholder asset during metadata load; using synthetic page count',
      );
      return { checksum, pageCount: 1 };
    }
    throw error;
  }
}

async function processEntry(
  slug: string,
  entryPath: string,
  generatorMap: Map<string, GeneratedWhitepaper>,
  ledgerMap: Map<string, ManagedLedgerRuntimeAsset>,
): Promise<ManifestEntry> {
  const { frontmatter, body, rawFrontmatter } = await readMdxFrontmatter(entryPath);
  if (!frontmatter?.asset?.objectKey) {
    throw new Error(`Whitepaper ${slug} missing asset.objectKey in frontmatter.`);
  }

  const assetKey = frontmatter.asset.objectKey;
  const assetFilename = assetKey.split('/').pop();
  if (!assetFilename) {
    throw new Error(`Whitepaper ${slug} has an invalid asset object key.`);
  }

  const assetPath = join(ASSETS_DIR, assetFilename);
  const generated = generatorMap.get(slug);
  const ledgerAsset = ledgerMap.get(slug);
  if (ledgerAsset && ledgerAsset.objectKey !== assetKey) {
    throw new Error(
      `Managed ledger entry for ${slug} references ${ledgerAsset.objectKey} but frontmatter expects ${assetKey}.`,
    );
  }
  const resolved = await resolveAsset(slug, assetPath, generated, ledgerAsset);

  if (resolved.source === 'placeholder') {
    const stats = await stat(assetPath);
    if (!stats.isFile()) {
      throw new Error(`Whitepaper asset at ${assetPath} is not a regular file.`);
    }
  }

  const updates: FrontmatterAsset = {
    objectKey: assetKey,
    checksum: resolved.checksum,
    contentType: 'application/pdf',
    pageCount: resolved.pageCount,
  };

  if (frontmatter.lifecycle?.embargoedUntil instanceof Date) {
    frontmatter.lifecycle.embargoedUntil = frontmatter.lifecycle.embargoedUntil.toISOString();
  }

  /**
   * Persist metadata updates only when values diverge. This keeps commits clean while still forcing
   * every deploy to reconcile PDFs and their declared integrity markers.
   */
  const missingEmbargoQuotes =
    typeof frontmatter.lifecycle?.embargoedUntil === 'string' &&
    !/embargoedUntil:\s*'[^']*'/u.test(rawFrontmatter);

  const shouldPersist =
    (resolved.source !== 'placeholder' &&
      (frontmatter.asset.checksum !== updates.checksum ||
        frontmatter.asset.pageCount !== updates.pageCount ||
        frontmatter.asset.contentType !== updates.contentType)) ||
    missingEmbargoQuotes;

  if (shouldPersist) {
    frontmatter.asset = updates;
    await writeMdxFrontmatter(entryPath, frontmatter, body);
    console.info('[whitepapers] refreshed frontmatter metadata for %s', slug);
  }

  return { ...frontmatter, slug };
}

export async function ensureWhitepapers(): Promise<void> {
  await mkdir(ASSETS_DIR, { recursive: true });
  const entries = (await readdir(CONTENT_DIR)).filter((entry) => entry.endsWith('.mdx'));
  entries.sort((a, b) => a.localeCompare(b));

  let generatedOutputs: GeneratedWhitepaper[] = [];
  const generatorDisabled = process.env.WHITEPAPER_DISABLE_GENERATOR === '1';
  if (!generatorDisabled) {
    try {
      generatedOutputs = await generateWhitepapers();
    } catch (error) {
      console.warn('[whitepapers] generator failed, falling back to managed assets:', error);
    }
  } else {
    console.info('[whitepapers] generator disabled via WHITEPAPER_DISABLE_GENERATOR');
  }

  const generatedMap = new Map(generatedOutputs.map((output) => [output.slug, output] as const));
  const managedLedger = await loadManagedLedger();

  const manifestEntries: ManifestEntry[] = [];
  for (const entry of entries) {
    const slug = basename(entry, extname(entry));
    const entryPath = join(CONTENT_DIR, entry);
    const frontmatter = await processEntry(slug, entryPath, generatedMap, managedLedger);
    manifestEntries.push(frontmatter);
  }

  const source = buildManifestSource(manifestEntries);
  await writeFile(MANIFEST_PATH, source, 'utf8');
  console.info('[whitepapers] manifest updated with %d entries', manifestEntries.length);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  ensureWhitepapers().catch((error) => {
    console.error('[whitepapers] ensure script failed:', error);
    process.exitCode = 1;
  });
}
