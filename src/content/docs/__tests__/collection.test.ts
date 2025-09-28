import { getCollection } from 'astro:content';
import { describe, expect, it } from 'vitest';

describe('docs content collection', () => {
  it('loads generated handbook entries with normalized slugs', async () => {
    const docs = await getCollection('docs', ({ data }) => data.draft !== true);
    const slugs = docs.map((entry) => entry.slug);

    expect(slugs).toContain('dev/workflows');
    expect(slugs).toContain('brand/styleguide');
    expect(slugs).toContain('security/incident-response');
  });

  it('exposes metadata needed for GitHub provenance', async () => {
    const docs = await getCollection('docs');
    const workflows = docs.find((entry) => entry.slug === 'dev/workflows');
    const whyApotheon = docs.find((entry) => entry.slug === 'why-apotheon');

    expect(workflows?.data.sourcePath).toBe('dev/WORKFLOWS.md');
    expect(workflows?.data.category).toBe('dev');
    expect(whyApotheon?.data.categoryLabel).toBe('Overview');
    expect(whyApotheon?.data.sourcePath).toBe('src/content/docs/why-apotheon.mdx');
  });
});
