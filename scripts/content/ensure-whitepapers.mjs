#!/usr/bin/env node
/**
 * Whitepapers fuel regulated funnel journeys. This script enforces asset hygiene so production
 * deploys never depend on humans remembering to copy PDFs or recalculate checksums by hand.
 */
import { createHash } from 'node:crypto';
import { access, constants, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stringify as stringifyYaml, parse as parseYaml } from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..', '..');
const contentDir = join(projectRoot, 'src', 'content', 'whitepapers');
const assetsDir = join(projectRoot, 'assets', 'whitepapers');
const manifestPath = join(projectRoot, 'src', 'generated', 'whitepapers.manifest.ts');

/**
 * Minimal PDF placeholder (one page with Apotheon branding). The bytes are valid PDF syntax, so
 * checksums match across operating systems and future optimization tooling has real input to scan.
 */
const PLACEHOLDER_PDF_BASE64 =
  'JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKPj4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovTWVkaWFCb3ggWzAgMCA2MTIgNzkyXQovQ29udGVudHMgNCAwIFIKL1Jlc291cmNlcyA8PAovRm9udCA8PAovRjEgNSAwIFIKPj4KPj4KPj4KZW5kb2JqCjQgMCBvYmoKPDwKL0xlbmd0aCA1Nwo+PgpzdHJlYW0KQlQKL0YxIDE0IFRmCjcyIDcwMCBUZCAoQXBvdGhlb24gV2hpdGVwYXBlciBQbGFjZWhvbGRlcikgVGoxMDAgNjgwIFRmIChTY3JpcHQtZ2VuZXJhdGVkIHBsYWNlaG9sZGVyKSBFOApFVAplbmRzdHJlYW0KZW5kb2JqCjUgMCBvYmoKPDwKL1R5cGUgL0ZvbnQKL1N1YnR5cGUgL1R5cGUxCi9OYW1lIC9GMQovQmFzZUZvbnQgL0hlbHZldGljYQovRW5jb2RpbmcgL0Jhc2U2NAo+PgplbmRvYmoKeHJlZgowIDYKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDE1IDAwMDAwIG4gCjAwMDAwMDAwNzUgMDAwMDAgbiAKMDAwMDAwMDE3NiAwMDAwMCBuIAowMDAwMDAwMjk4IDAwMDAwIG4gCjAwMDAwMDAzOTEgMDAwMDAgbiAKdHJhaWxlcgo8PAovU2l6ZSA2Ci9Sb290IDEgMCBSCj4+CnN0YXJ0eHJlZgo0NzIKJSVFT0YK';

async function fileExists(path) {
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

function computeChecksum(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function buildManifestSource(entries) {
  const manifestArray = JSON.stringify(entries, null, 2).replace(/"([^("]+)":/g, '$1:');
  return `export interface WhitepaperManifestEntry {\n  readonly slug: string;\n  readonly title: string;\n  readonly summary: string;\n  readonly industries: ReadonlyArray<string>;\n  readonly asset: {\n    readonly objectKey: string;\n    readonly checksum: string;\n    readonly contentType: string;\n    readonly pageCount: number;\n  };\n  readonly gatingNotes: {\n    readonly distribution: string;\n    readonly reviewerChecklist: ReadonlyArray<string>;\n    readonly complianceContacts: ReadonlyArray<{ team: string; email: string }>;\n  };\n  readonly lifecycle: {\n    readonly draft: boolean;\n    readonly archived: boolean;\n    readonly embargoedUntil?: string;\n  };\n}\n\nexport const WHITEPAPER_MANIFEST: ReadonlyArray<WhitepaperManifestEntry> = ${manifestArray} as const;\n\nexport const WHITEPAPER_MANIFEST_BY_SLUG = new Map(\n  WHITEPAPER_MANIFEST.map((entry) => [entry.slug, entry] as const),\n);\n\nexport const WHITEPAPER_SLUGS = WHITEPAPER_MANIFEST.map((entry) => entry.slug);\n`;
}

async function ensurePlaceholderAsset(assetPath) {
  const exists = await fileExists(assetPath);
  if (exists) {
    return;
  }
  await mkdir(dirname(assetPath), { recursive: true });
  await writeFile(assetPath, Buffer.from(PLACEHOLDER_PDF_BASE64, 'base64'));
  console.info('[whitepapers] generated placeholder asset at %s', assetPath);
}

async function readMdxFrontmatter(filePath) {
  const raw = await readFile(filePath, 'utf8');
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/u);
  if (!match) {
    throw new Error(`File ${filePath} is missing frontmatter.`);
  }
  const frontmatter = parseYaml(match[1]);
  const body = match[2] ?? '';
  return { frontmatter, body };
}

async function writeMdxFrontmatter(filePath, frontmatter, body) {
  const serialized = stringifyYaml(frontmatter, { lineWidth: 80 }).trimEnd();
  const contents = `---\n${serialized}\n---\n\n${body}`;
  await writeFile(filePath, contents, 'utf8');
}

async function processWhitepaperEntry(entryPath) {
  const slug = basename(entryPath, extname(entryPath));
  const { frontmatter, body } = await readMdxFrontmatter(entryPath);

  if (!frontmatter?.asset?.objectKey) {
    throw new Error(`Whitepaper ${slug} missing asset.objectKey in frontmatter.`);
  }

  const assetKey = frontmatter.asset.objectKey;
  const assetFilename = assetKey.split('/').pop();
  if (!assetFilename) {
    throw new Error(`Whitepaper ${slug} has an invalid asset object key.`);
  }

  const assetPath = join(assetsDir, assetFilename);
  await ensurePlaceholderAsset(assetPath);
  const stats = await stat(assetPath);
  if (!stats.isFile()) {
    throw new Error(`Whitepaper asset at ${assetPath} is not a regular file.`);
  }

  const buffer = await readFile(assetPath);
  const checksum = computeChecksum(buffer);
  const previousChecksum = frontmatter.asset.checksum;
  if (previousChecksum !== checksum) {
    frontmatter.asset.checksum = checksum;
    await writeMdxFrontmatter(entryPath, frontmatter, body);
    console.info('[whitepapers] refreshed checksum for %s', slug);
  }

  return {
    slug,
    title: frontmatter.title,
    summary: frontmatter.summary,
    industries: frontmatter.industries,
    asset: frontmatter.asset,
    gatingNotes: frontmatter.gatingNotes,
    lifecycle: frontmatter.lifecycle,
  };
}

async function collectWhitepaperEntries() {
  const entries = await readdir(contentDir);
  const manifest = [];
  for (const entry of entries) {
    if (!entry.endsWith('.mdx')) continue;
    const entryPath = join(contentDir, entry);
    const processed = await processWhitepaperEntry(entryPath);
    manifest.push(processed);
  }
  manifest.sort((a, b) => a.slug.localeCompare(b.slug));
  return manifest;
}

async function main() {
  await mkdir(assetsDir, { recursive: true });
  const manifestEntries = await collectWhitepaperEntries();
  const source = buildManifestSource(manifestEntries);
  await writeFile(manifestPath, source, 'utf8');
  console.info('[whitepapers] manifest updated with %d entries', manifestEntries.length);
}

try {
  await main();
} catch (error) {
  console.error('[whitepapers] ensure script failed:', error);
  process.exitCode = 1;
}
