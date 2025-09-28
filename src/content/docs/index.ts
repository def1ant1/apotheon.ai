import { defineCollection, z } from 'astro:content';

/**
 * Developer Handbook collection unifies repo-native markdown and curated MDX content so Astro can
 * statically generate `/docs` with rich metadata, breadcrumbs, and search coverage. The ensure
 * script (`npm run ensure:docs-handbook`) injects slugs + descriptions which this schema enforces so
 * Pagefind and JSON-LD stay trustworthy.
 */
const docsSchema = z
  .object({
    title: z.string().min(1, 'Docs require a human-readable title for navigation + SEO.'),
    description: z
      .string()
      .optional()
      .describe('Synopsis rendered on the handbook landing page and OpenGraph metadata.'),
    category: z
      .string()
      .default('general')
      .describe('Source folder or topical grouping (e.g., dev, security, content).'),
    categoryLabel: z
      .string()
      .default('General')
      .describe('Human-friendly label surfaced in UI chips and breadcrumbs.'),
    tags: z
      .array(z.string().min(1))
      .default([])
      .describe('Optional facets powering future filtering + related content surfaces.'),
    sourcePath: z
      .string()
      .optional()
      .describe('Relative repository path back to the authoritative markdown source.'),
    sourceLastModified: z
      .union([z.string(), z.date()])
      .transform((value) => (value instanceof Date ? value.toISOString() : value))
      .optional()
      .describe('ISO timestamp attached to the source file during sync for recency auditing.'),
    draft: z
      .boolean()
      .default(false)
      .describe('Allow staging handbook material without exposing it in production builds.'),
  })
  .strict();

export type DocsFrontmatter = z.infer<typeof docsSchema>;

export const docsCollection = defineCollection({
  type: 'content',
  schema: docsSchema,
});
