import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { parse } from 'yaml';

import type { SolutionEntry } from '../../src/content/solutions';

interface FrontmatterEntry<T> {
  readonly slug: string;
  readonly data: T;
  readonly sourcePath: string;
}

const SOLUTIONS_DIRECTORY = join(process.cwd(), 'src', 'content', 'solutions');
const MARKETING_DIRECTORY = join(process.cwd(), 'src', 'content', 'marketing');
const BLOG_DIRECTORY = join(process.cwd(), 'src', 'content', 'blog');

function parseFrontmatterFile<T>(filePath: string): T {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test helper reads controlled repository fixtures.
  const contents = readFileSync(filePath, 'utf8');
  const match = contents.match(/^---\n([\s\S]+?)\n---/u);

  if (!match) {
    throw new Error(`Missing frontmatter in ${filePath}`);
  }

  return parse(match[1] ?? '') as T;
}

function walkFrontmatterDirectory<T>(baseDir: string, prefix = ''): FrontmatterEntry<T>[] {
  const entries: FrontmatterEntry<T>[] = [];
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- Directory traversal stays within the repository tree.
  const dirents = readdirSync(baseDir, { withFileTypes: true });

  for (const dirent of dirents) {
    if (dirent.isDirectory()) {
      const nextPrefix = prefix ? `${prefix}/${dirent.name}` : dirent.name;
      entries.push(...walkFrontmatterDirectory<T>(join(baseDir, dirent.name), nextPrefix));
      continue;
    }

    if (!dirent.isFile() || !dirent.name.endsWith('.mdx')) {
      continue;
    }

    const sourcePath = join(baseDir, dirent.name);
    const slug = prefix
      ? `${prefix}/${dirent.name.replace(/\.mdx$/u, '')}`
      : dirent.name.replace(/\.mdx$/u, '');
    entries.push({ slug, data: parseFrontmatterFile<T>(sourcePath), sourcePath });
  }

  return entries;
}

export interface LoadedSolutionEntry extends FrontmatterEntry<SolutionEntry['data']> {}

export function loadSolutionFrontmatterFromFs(): LoadedSolutionEntry[] {
  return walkFrontmatterDirectory<SolutionEntry['data']>(SOLUTIONS_DIRECTORY)
    .filter((entry) => entry.data.draft !== true)
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

type GenericFrontmatter = { draft?: boolean } & Record<string, unknown>;

export interface LoadedMarketingEntry extends FrontmatterEntry<GenericFrontmatter> {}

export function loadMarketingFrontmatterFromFs(): LoadedMarketingEntry[] {
  return walkFrontmatterDirectory<GenericFrontmatter>(MARKETING_DIRECTORY).filter(
    (entry) => entry.data.draft !== true,
  );
}

export interface LoadedBlogEntry extends FrontmatterEntry<GenericFrontmatter> {}

export function loadBlogFrontmatterFromFs(): LoadedBlogEntry[] {
  return walkFrontmatterDirectory<GenericFrontmatter>(BLOG_DIRECTORY).filter(
    (entry) => entry.data.draft !== true,
  );
}
