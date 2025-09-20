import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it, beforeAll } from 'vitest';
import { parse } from 'yaml';

import type { SolutionEntry } from '../../../content/solutions';

interface SolutionDocumentLike {
  readonly slug: string;
  readonly data: SolutionEntry['data'];
}

let entries: SolutionDocumentLike[];

beforeAll(() => {
  const solutionsDir = join(process.cwd(), 'src/content/solutions');
  entries = readdirSync(solutionsDir)
    .filter((file) => file.endsWith('.mdx'))
    .map((file) => {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test suite reads controlled fixtures from the repository
      const contents = readFileSync(join(solutionsDir, file), 'utf8');
      const frontmatterMatch = contents.match(/^---\n([\s\S]+?)\n---/u);
      if (!frontmatterMatch) {
        throw new Error(`Missing frontmatter in ${file}`);
      }
      const rawFrontmatter = parse(frontmatterMatch[1]);
      const data = rawFrontmatter as SolutionEntry['data'];
      return { slug: file.replace(/\.mdx$/u, ''), data } satisfies SolutionDocumentLike;
    });
});

describe('solutions content fixtures', () => {
  it('exposes six published solutions with deterministic ordering metadata', () => {
    expect(entries.length).toBeGreaterThanOrEqual(6);
    entries.forEach((entry) => {
      expect(typeof entry.data.order).toBe('number');
      expect(entry.data.order).toBeGreaterThanOrEqual(0);
    });
  });

  it('includes comprehensive hero, overview, and CTA data for each solution', () => {
    entries.forEach((entry) => {
      const { hero, overview, finalCta } = entry.data;
      expect(hero.headline.length).toBeGreaterThan(10);
      expect(hero.primaryCta.href).toMatch(/^\//u);
      expect(overview.summary.length).toBeGreaterThan(20);
      expect(finalCta.primaryCta.label.length).toBeGreaterThan(0);
    });
  });

  it('provides rich lists for features, lifecycle steps, and use cases', () => {
    entries.forEach((entry) => {
      expect(entry.data.keyFeatures.length).toBeGreaterThanOrEqual(3);
      expect(entry.data.howItWorks.length).toBeGreaterThanOrEqual(3);
      expect(entry.data.useCases.length).toBeGreaterThanOrEqual(3);
      entry.data.keyFeatures.forEach((feature) => {
        expect(feature.title.length).toBeGreaterThan(0);
        expect(feature.description.length).toBeGreaterThan(0);
      });
    });
  });

  it('links to adjacent resources with descriptive labels', () => {
    entries.forEach((entry) => {
      expect(entry.data.crossLinks.length).toBeGreaterThanOrEqual(3);
      entry.data.crossLinks.forEach((link) => {
        expect(link.label.length).toBeGreaterThan(0);
        expect(link.href.length).toBeGreaterThan(0);
      });
    });
  });

  it('documents architecture diagrams with accessible metadata', () => {
    entries.forEach((entry) => {
      expect(entry.data.diagram.slug).toMatch(/^[a-z0-9-]+$/u);
      expect(entry.data.diagram.alt.length).toBeGreaterThan(20);
      expect(entry.data.diagram.caption.length).toBeGreaterThan(20);
    });
  });
});
