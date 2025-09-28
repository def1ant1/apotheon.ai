import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

/**
 * The docs pipeline materialises a manifest (`src/content/docs-manifest/manifest.json`) during
 * pre-commit verification. The manifest preserves the slug/category/sourcePath metadata that the
 * production `astro:content` runtime exposes to the navigation layer. Importing `astro:content`
 * directly inside Vitest is brittle because the Astro Vite plugin wires that module at runtime –
 * relying on the generated manifest keeps the assertions deterministic while still exercising the
 * exact data the navigation contracts consume.
 */

const docsManifestPath = join(process.cwd(), 'src', 'content', 'docs-manifest', 'manifest.json');

interface DocsManifestEntry {
  readonly slug: string;
  readonly category: string;
  readonly categoryLabel: string;
  readonly sourcePath: string;
}

interface DocsManifestPayload {
  readonly entries: readonly DocsManifestEntry[];
}

function loadDocsManifest(): DocsManifestPayload {
  const raw = readFileSync(docsManifestPath, 'utf8');
  const parsed = JSON.parse(raw) as DocsManifestPayload;

  return parsed;
}

interface MdxFrontmatter {
  readonly category?: string;
  readonly categoryLabel?: string;
  readonly sourcePath?: string;
}

function loadDocFrontmatter(relativePath: string): MdxFrontmatter {
  const absolutePath = join(process.cwd(), relativePath);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test helper reads controlled repository fixtures.
  const raw = readFileSync(absolutePath, 'utf8');
  const match = raw.match(/^---\n([\s\S]+?)\n---/u);

  if (!match) {
    throw new Error(`Expected frontmatter block in ${relativePath}`);
  }

  return parse(match[1] ?? '') as MdxFrontmatter;
}

// Parsing once per suite keeps the assertions deterministic and mirrors the behaviour of the
// navigation layer, which consumes the manifest at build time to seed static menus.
const docsManifest = loadDocsManifest();

describe('docs content collection', () => {
  it('loads generated handbook entries with normalized slugs', async () => {
    const slugs = docsManifest.entries.map((entry) => entry.slug);

    expect(slugs).toContain('dev/workflows');
    expect(slugs).toContain('brand/styleguide');
    expect(slugs).toContain('security/incident-response');
  });

  it('exposes metadata needed for GitHub provenance', async () => {
    const workflows = docsManifest.entries.find((entry) => entry.slug === 'dev/workflows');
    const whyApotheonFrontmatter = loadDocFrontmatter('src/content/docs/why-apotheon.mdx');

    expect(workflows?.sourcePath).toBe('dev/WORKFLOWS.md');
    expect(workflows?.category).toBe('dev');
    expect(whyApotheonFrontmatter.categoryLabel).toBe('Overview');
    expect(whyApotheonFrontmatter.sourcePath).toBe('src/content/docs/why-apotheon.mdx');
  });
});
