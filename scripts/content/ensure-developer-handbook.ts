#!/usr/bin/env tsx
/* eslint-disable security/detect-non-literal-fs-filename */
/**
 * Developer Handbook automation keeps repo-native markdown synchronized with Astro's content
 * collection system. Rather than duplicating instructions across bespoke pages, we derive typed
 * frontmatter from the source files in /docs, rewrite internal links to the new /docs routes, and
 * publish the generated entries directly under src/content/docs. A companion JSON manifest is
 * written to src/content/docs-manifest for analytics + provenance tooling. The script runs in CI
 * via the existing `predev`/`prebuild` lifecycle hooks so the developer experience stays
 * hands-off.
 */
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { stringify as stringifyYaml } from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..', '..');
const SOURCE_DOCS_DIR = join(PROJECT_ROOT, 'docs');
const TARGET_DOCS_DIR = join(PROJECT_ROOT, 'src', 'content', 'docs');
const TARGET_MANIFEST_DIR = join(PROJECT_ROOT, 'src', 'content', 'docs-manifest');
const TARGET_MANIFEST_PATH = join(TARGET_MANIFEST_DIR, 'manifest.json');
const LEGACY_MANIFEST_PATH = join(TARGET_DOCS_DIR, 'handbook', 'manifest.json');
const LEGACY_GENERATED_DIR = join(TARGET_DOCS_DIR, 'handbook');
const GITHUB_BASE = 'https://github.com/apotheon-ai/apotheon.ai/blob/main/';

const CATEGORY_LABEL_OVERRIDES: Record<string, string> = {
  ai: 'AI',
  'ai-instructions': 'AI Playbooks',
  architecture: 'Architecture',
  brand: 'Brand',
  content: 'Content Strategy',
  dev: 'Development',
  infra: 'Infrastructure',
  launch: 'Launch Readiness',
  security: 'Security',
  workplan: 'Workplan',
};

interface GeneratedDocMeta {
  /**
   * Title surfaced in navigation and metadata.
   */
  title: string;
  /**
   * Short synopsis derived from the first body paragraph.
   */
  description: string | null;
  /**
   * Category slug anchored to the original directory structure (e.g., `dev`).
   */
  category: string;
  /**
   * Human-friendly category label (e.g., `Development`).
   */
  categoryLabel: string;
  /**
   * Slug powering the new /docs/* routes (e.g., `dev/workflows`).
   */
  slug: string;
  /**
   * Source markdown location within the repository for traceability + GitHub linking.
   */
  sourcePath: string;
  /**
   * ISO timestamp capturing the last modified time of the source file.
   */
  sourceLastModified: string;
}

interface GeneratedDoc {
  destinationPath: string;
  body: string;
  metadata: GeneratedDocMeta;
}

const RELATIVE_LINK_PATTERN = /(\[[^\]]+\])\((?!https?:|mailto:|#)([^)]+)\)/gim;

async function ensureDirectory(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

async function collectMarkdownFiles(root: string): Promise<string[]> {
  const stack: string[] = [root];
  const files: string[] = [];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(entryPath);
        continue;
      }
      if (!entry.name.toLowerCase().endsWith('.md')) {
        continue;
      }
      files.push(entryPath);
    }
  }
  return files;
}

function slugifySegment(segment: string): string {
  const withoutExtension = segment.replace(/\.[^.]+$/u, '');
  const sanitized = withoutExtension
    .replace(/[_\s]+/gu, '-')
    .replace(/[^a-zA-Z0-9-]/gu, '-')
    .replace(/-+/gu, '-')
    .toLowerCase()
    .replace(/^-+|-+$/gu, '');
  return sanitized.length > 0 ? sanitized : 'index';
}

function toTitleCase(input: string): string {
  return input
    .split(/[-_\s]+/u)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function buildSlug(relativePath: string): string {
  const segments = relativePath
    .split('/')
    .filter(Boolean)
    .map((segment) => slugifySegment(segment));
  return segments.join('/');
}

function rewriteRelativeLinks(markdown: string, sourcePath: string): string {
  return markdown.replace(
    RELATIVE_LINK_PATTERN,
    (match: string, label: string, rawHref: string) => {
      const [pathPart, hash = ''] = rawHref.split('#');
      const trimmedPath = pathPart.trim();
      if (trimmedPath.length === 0) {
        return match;
      }
      const sourceDir = dirname(sourcePath);
      const resolvedPath = resolve(sourceDir, trimmedPath);
      const relativeFromProject = relative(PROJECT_ROOT, resolvedPath).replace(/\\/g, '/');

      if (relativeFromProject.startsWith('docs/')) {
        const relativeFromDocs = relative(SOURCE_DOCS_DIR, resolvedPath).replace(/\\/g, '/');
        const slug = buildSlug(relativeFromDocs);
        const hashSuffix = hash ? `#${hash}` : '';
        return `${label}(/docs/${slug}/${hashSuffix})`;
      }

      const githubUrl = new URL(relativeFromProject, GITHUB_BASE).toString();
      const hashSuffix = hash ? `#${hash}` : '';
      return `${label}(${githubUrl}${hashSuffix})`;
    },
  );
}

function extractTitleAndBody(markdown: string): {
  title: string | null;
  description: string | null;
  body: string;
} {
  let working = markdown.trimStart();
  let title: string | null = null;
  const headingMatch = working.match(/^#\s+(.+?)(?:\n+|$)/u);
  if (headingMatch) {
    title = headingMatch[1].trim();
    working = working.slice(headingMatch[0].length).trimStart();
  }

  const paragraphCandidates = working
    .split(/\n{2,}/u)
    .map((block) => block.trim())
    .filter((block) => block.length > 0 && !block.startsWith('#') && !block.startsWith('>'));
  const description = paragraphCandidates.at(0)?.replace(/\s+/gu, ' ').trim() ?? null;

  return { title, description, body: working.trim() };
}

async function transformDoc(sourcePath: string): Promise<GeneratedDoc> {
  const relativeFromDocs = relative(SOURCE_DOCS_DIR, sourcePath).replace(/\\/g, '/');
  const slug = buildSlug(relativeFromDocs);
  const sourceStats = await stat(sourcePath);
  const raw = await readFile(sourcePath, 'utf8');
  const { title: extractedTitle, description, body } = extractTitleAndBody(raw);
  const normalizedBody = rewriteRelativeLinks(body, sourcePath).trim() + '\n';
  const firstSegment = slug.split('/')[0] ?? 'general';
  const categoryLabel = CATEGORY_LABEL_OVERRIDES[firstSegment] ?? toTitleCase(firstSegment);
  const metadata: GeneratedDocMeta = {
    title: extractedTitle ?? toTitleCase(slug.split('/').pop() ?? 'Developer Guide'),
    description,
    category: firstSegment,
    categoryLabel,
    slug,
    sourcePath: relativeFromDocs,
    sourceLastModified: sourceStats.mtime.toISOString(),
  };

  const destinationPath = join(TARGET_DOCS_DIR, `${slug}.mdx`);

  const frontmatterObject = {
    title: metadata.title,
    category: metadata.category,
    categoryLabel: metadata.categoryLabel,
    ...(metadata.description ? { description: metadata.description } : {}),
    sourcePath: metadata.sourcePath,
    sourceLastModified: metadata.sourceLastModified,
    tags: [] as string[],
  } satisfies Record<string, unknown>;

  const serializedFrontmatter = stringifyYaml(frontmatterObject, { lineWidth: 80 }).trimEnd();
  const fileContents = `---\n${serializedFrontmatter}\n---\n\n${normalizedBody}`;

  return {
    destinationPath,
    body: fileContents,
    metadata,
  };
}

async function writeGeneratedDoc(doc: GeneratedDoc): Promise<void> {
  await ensureDirectory(dirname(doc.destinationPath));
  let existing: string | null = null;
  try {
    existing = await readFile(doc.destinationPath, 'utf8');
  } catch {
    existing = null;
  }
  if (existing === doc.body) {
    return;
  }
  await writeFile(doc.destinationPath, doc.body, 'utf8');
}

async function cleanupOrphanedFiles(validFiles: Set<string>): Promise<void> {
  try {
    const entries = await collectMarkdownFiles(TARGET_DOCS_DIR);
    await Promise.all(
      entries.map(async (path) => {
        if (!validFiles.has(path)) {
          await rm(path, { force: true });
        }
      }),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return;
    }
    throw error;
  }
}

async function main(): Promise<void> {
  await ensureDirectory(TARGET_DOCS_DIR);
  const sourceFiles = await collectMarkdownFiles(SOURCE_DOCS_DIR);
  const generatedFiles = new Set<string>();
  const summaries: GeneratedDocMeta[] = [];

  for (const file of sourceFiles) {
    const doc = await transformDoc(file);
    await writeGeneratedDoc(doc);
    generatedFiles.add(doc.destinationPath);
    summaries.push(doc.metadata);
  }

  await cleanupOrphanedFiles(generatedFiles);

  const manifestPayload = JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      source: pathToFileURL(SOURCE_DOCS_DIR).href,
      entries: summaries.sort((a, b) => a.slug.localeCompare(b.slug)),
    },
    null,
    2,
  );
  await ensureDirectory(TARGET_MANIFEST_DIR);
  await writeFile(TARGET_MANIFEST_PATH, `${manifestPayload}\n`, 'utf8');
  await rm(LEGACY_MANIFEST_PATH, { force: true });
  await rm(LEGACY_GENERATED_DIR, { force: true, recursive: true });
}

main().catch((error) => {
  console.error('[docs:ensure]', error);
  process.exitCode = 1;
});
