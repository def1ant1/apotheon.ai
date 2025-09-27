#!/usr/bin/env tsx
/* eslint-disable security/detect-non-literal-fs-filename */
/**
 * Whitepaper automation must produce production-grade PDFs without manual design tooling.
 * This generator renders MDX content with a lightweight HTML + CSS template in Playwright
 * so marketing can ship updates with a single command. The ensure script consumes the
 * metadata (checksum + page count) to keep the manifest in sync.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { chromium } from '@playwright/test';
import matter from 'gray-matter';
import { PDFDocument } from 'pdf-lib';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkMdx from 'remark-mdx';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

import type { Node, Parent } from 'unist';

type Frontmatter = Record<string, unknown> & {
  title: string;
  summary: string;
  industries: string[];
  asset: {
    objectKey: string;
  };
  gatingNotes?: {
    distribution?: string;
    reviewerChecklist?: string[];
    complianceContacts?: Array<{ team: string; email: string }>;
  };
};

export interface GenerateWhitepapersOptions {
  /**
   * Override the output directory (useful for tests). Defaults to `assets/whitepapers`.
   */
  readonly assetsDir?: string;
}

export interface GeneratedWhitepaper {
  readonly slug: string;
  readonly assetFilename: string;
  readonly assetPath: string;
  readonly checksum: string;
  readonly pageCount: number;
  readonly bytesWritten: number;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..');
const CONTENT_DIR = join(PROJECT_ROOT, 'src', 'content', 'whitepapers');

function stripMdxExpressions() {
  return (tree: unknown) => {
    visit(tree as Node, (node, index, parent) => {
      const parentNode = parent as Parent | undefined;
      if (!parentNode?.children || typeof index !== 'number') {
        return;
      }

      if (node && typeof node === 'object' && 'type' in node) {
        const type = (node as { type: string }).type;
        if (type === 'mdxFlowExpression' || type === 'mdxjsEsm' || type === 'mdxTextExpression') {
          parentNode.children.splice(index, 1);
        }
      }
    });
  };
}

async function mdxToHtml(content: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkMdx)
    .use(remarkGfm)
    .use(stripMdxExpressions)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(content);
  return String(file);
}

function renderHtmlTemplate(frontmatter: Frontmatter, bodyHtml: string): string {
  const industries = Array.isArray(frontmatter.industries) ? frontmatter.industries : [];
  const gatingNotes = frontmatter.gatingNotes ?? {};
  const reviewerChecklist = Array.isArray(gatingNotes.reviewerChecklist)
    ? gatingNotes.reviewerChecklist
    : [];
  const complianceContacts = Array.isArray(gatingNotes.complianceContacts)
    ? gatingNotes.complianceContacts
    : [];

  const industriesMarkup = industries
    .map((industry) => `<span class="chip">${industry.replace(/-/g, ' ')}</span>`)
    .join('');

  const reviewerMarkup = reviewerChecklist.map((item) => `<li>${item}</li>`).join('');

  const contactsMarkup = complianceContacts
    .map((contact) => `<li><strong>${contact.team}:</strong> ${contact.email}</li>`)
    .join('');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${frontmatter.title}</title>
    <style>
      * { box-sizing: border-box; }
      body {
        font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif;
        color: #0f172a;
        margin: 0;
        padding: 48px 64px 72px;
        background: linear-gradient(180deg, #f8fafc 0%, #ffffff 18%);
        line-height: 1.55;
      }
      header {
        border-bottom: 2px solid #0f172a;
        padding-bottom: 24px;
        margin-bottom: 32px;
      }
      h1 {
        font-size: 32px;
        line-height: 1.2;
        margin: 0 0 16px;
      }
      p.summary {
        font-size: 16px;
        color: #334155;
        margin: 0 0 16px;
      }
      .chips { margin-top: 16px; }
      .chip {
        display: inline-block;
        background: #0f172a;
        color: #f8fafc;
        padding: 4px 12px;
        margin-right: 8px;
        border-radius: 999px;
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      main { font-size: 14px; }
      main h2 {
        font-size: 20px;
        margin-top: 32px;
        color: #0f172a;
      }
      main h3 { font-size: 18px; margin-top: 24px; color: #1e293b; }
      main ul, main ol { padding-left: 20px; }
      blockquote {
        border-left: 4px solid #0f172a;
        padding-left: 16px;
        color: #475569;
      }
      footer {
        margin-top: 48px;
        border-top: 1px solid #cbd5f5;
        padding-top: 24px;
        font-size: 12px;
        color: #475569;
      }
      footer h2 { font-size: 14px; margin-bottom: 12px; color: #0f172a; }
      footer ul { padding-left: 20px; margin: 12px 0; }
    </style>
  </head>
  <body>
    <header>
      <h1>${frontmatter.title}</h1>
      <p class="summary">${frontmatter.summary}</p>
      <p>${gatingNotes.distribution ?? ''}</p>
      <div class="chips">${industriesMarkup}</div>
    </header>
    <main>${bodyHtml}</main>
    <footer>
      <section>
        <h2>Reviewer checklist</h2>
        <ul>${reviewerMarkup}</ul>
      </section>
      <section>
        <h2>Compliance contacts</h2>
        <ul>${contactsMarkup}</ul>
      </section>
    </footer>
  </body>
</html>`;
}

async function discoverWhitepapers(): Promise<ReadonlyArray<{ slug: string; path: string }>> {
  const entries = await readdir(CONTENT_DIR);
  return entries
    .filter((entry) => entry.endsWith('.mdx'))
    .map((entry) => ({
      slug: basename(entry, extname(entry)),
      path: join(CONTENT_DIR, entry),
    }))
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

export async function generateWhitepapers(
  options: GenerateWhitepapersOptions = {},
): Promise<GeneratedWhitepaper[]> {
  const assetsDir = options.assetsDir ?? join(PROJECT_ROOT, 'assets', 'whitepapers');
  await mkdir(assetsDir, { recursive: true });

  const entries = await discoverWhitepapers();
  if (entries.length === 0) {
    return [];
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const generated: GeneratedWhitepaper[] = [];

  try {
    for (const entry of entries) {
      const raw = await readFile(entry.path, 'utf8');
      const { data, content } = matter(raw);
      const frontmatter = data as Frontmatter;
      if (!frontmatter?.asset?.objectKey) {
        throw new Error(`Whitepaper ${entry.slug} missing asset.objectKey in frontmatter.`);
      }

      const htmlBody = await mdxToHtml(content);
      const html = renderHtmlTemplate(frontmatter, htmlBody);

      await page.setContent(html, { waitUntil: 'networkidle' });
      await page.emulateMedia({ media: 'print' });
      const pdfBuffer = await page.pdf({
        format: 'Letter',
        printBackground: true,
        margin: { top: '0.75in', bottom: '0.75in', left: '0.8in', right: '0.8in' },
      });

      const assetFilename = frontmatter.asset.objectKey.split('/').pop();
      if (!assetFilename) {
        throw new Error(`Whitepaper ${entry.slug} has an invalid asset object key.`);
      }
      const outputPath = join(assetsDir, assetFilename);
      const rawBinary = Buffer.from(pdfBuffer);
      const pdf = await PDFDocument.load(rawBinary);
      /**
       * Normalize PDF metadata so every run produces identical bytes. Without this step Playwright
       * stamps dynamic creation/modification timestamps into the document, which would cause
       * checksums to diverge on every execution and break manifest determinism.
       */
      const stableDate = new Date('2024-01-01T00:00:00Z');
      pdf.setTitle(frontmatter.title);
      pdf.setSubject(frontmatter.summary);
      pdf.setCreator('Apotheon.ai Content Automation');
      pdf.setProducer('Apotheon.ai Content Automation');
      pdf.setCreationDate(stableDate);
      pdf.setModificationDate(stableDate);
      const normalizedBinary = Buffer.from(await pdf.save({ useObjectStreams: false }));
      await writeFile(outputPath, normalizedBinary);

      const checksum = createHash('sha256').update(normalizedBinary).digest('hex');
      /**
       * Decode the rendered PDF so the ensure script and manifest consumers can reason about the
       * final page count without brittle heuristics. This mirrors the validation performed in CI,
       * guaranteeing parity between local automation and pipeline enforcement.
       */
      const pageCount = pdf.getPageCount();

      generated.push({
        slug: entry.slug,
        assetFilename,
        assetPath: outputPath,
        checksum,
        pageCount,
        bytesWritten: normalizedBinary.byteLength,
      });
    }
  } finally {
    await page.close();
    await browser.close();
  }

  return generated;
}

async function runCli() {
  const outputs = await generateWhitepapers();
  for (const output of outputs) {
    console.info(
      '[whitepapers] generated %s (%d pages, %d bytes)',
      output.assetFilename,
      output.pageCount,
      output.bytesWritten,
    );
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  runCli().catch((error) => {
    console.error('[whitepapers] PDF generation failed:', error);
    process.exitCode = 1;
  });
}
