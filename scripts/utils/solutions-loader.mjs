#!/usr/bin/env node
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse } from 'yaml';

/**
 * Resolve the absolute filesystem path to the project root. Using `package.json`
 * as an anchor means contributors can run this helper from anywhere inside the
 * repository (or via `node -r`) without worrying about `process.cwd()` quirks.
 */
const ROOT_DIRECTORY = dirname(fileURLToPath(new URL('../../package.json', import.meta.url)));

/**
 * Central directory housing the structured MDX files that drive the solutions
 * collection. Keeping the path here avoids sprinkling string literals across
 * scripts and tests while making refactors (e.g., migrating to a CMS mirror)
 * straightforward.
 */
const SOLUTIONS_CONTENT_DIRECTORY = join(ROOT_DIRECTORY, 'src', 'content', 'solutions');

/**
 * Lightweight cache so repeated lookups within a single execution avoid hitting
 * the filesystem. CI jobs often invoke the helper multiple times per command,
 * and memoizing keeps the overhead negligible even as the solutions library
 * grows.
 */
let cachedSolutions;

/**
 * The frontmatter in each MDX file powers Astro’s content collection. This
 * helper reproduces Astro’s slug inference: the file name (minus the `.mdx`
 * extension) becomes the route segment under `/solutions/<slug>/`.
 */
function deriveSlugFromFilename(filename) {
  return filename.replace(/\.mdx$/u, '');
}

/**
 * Parse the YAML frontmatter block from an MDX document. We intentionally keep
 * the implementation simple and dependency-free beyond `yaml` so the helper can
 * run in both Node scripts and test environments without bundler support.
 */
function extractFrontmatter(rawContents, filepath) {
  const frontmatterMatch = rawContents.match(/^---\n([\s\S]+?)\n---/u);

  if (!frontmatterMatch) {
    throw new Error(`solutions-loader: ${filepath} is missing a frontmatter block`);
  }

  return parse(frontmatterMatch[1]);
}

/**
 * Public entry point. Returns an array of `{ slug, data, sourcePath }` objects
 * mirroring Astro’s `CollectionEntry<'solutions'>` shape for the `data` field.
 *
 * @param {object} [options]
 * @param {boolean} [options.includeDrafts=false] - When true, retain entries
 *   flagged with `draft: true`. CI defaults to published-only to mimic the
 *   production route map.
 * @returns {Array<{ slug: string; data: import('../../src/content/solutions').SolutionEntry['data']; sourcePath: string; }>} solutions
 */
export function loadSolutionFrontmatter(options = {}) {
  const { includeDrafts = false } = options;

  if (!cachedSolutions) {
    cachedSolutions = readdirSync(SOLUTIONS_CONTENT_DIRECTORY)
      .filter((filename) => filename.endsWith('.mdx'))
      .map((filename) => {
        const sourcePath = join(SOLUTIONS_CONTENT_DIRECTORY, filename);
        const rawContents = readFileSync(sourcePath, 'utf8');
        const data = extractFrontmatter(rawContents, sourcePath);

        return {
          slug: deriveSlugFromFilename(filename),
          data,
          sourcePath,
        };
      })
      .sort((a, b) => a.slug.localeCompare(b.slug));
  }

  return cachedSolutions.filter((entry) => includeDrafts || entry.data.draft !== true);
}

export default loadSolutionFrontmatter;
