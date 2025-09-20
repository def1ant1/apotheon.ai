import { z, defineCollection } from 'astro:content';

import { homepageCollection } from './homepage';
import { solutionCollection } from './solutions';

// Blog articles will live in `src/content/blog`. The schema is designed so
// teams can progressively enhance metadata without migrations.
const blogCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string().describe('Human readable page title'),
    description: z.string().max(160).describe('Meta description for SEO + social cards'),
    publishDate: z.date().describe('ISO publish date for chronological sorting'),
    updatedDate: z.date().optional().describe('Optional last updated date for release notes'),
    heroImage: z.string().optional().describe('Path to hero image processed by @astrojs/image'),
    heroImageAlt: z
      .string()
      .optional()
      .describe('Plain-language alt text accompanying heroImage for accessibility compliance'),
    tags: z
      .array(z.string())
      .default([])
      .describe(
        'Search facets + related content scoring (lowercase kebab-case values recommended)',
      ),
    estimatedReadingMinutes: z
      .number()
      .int()
      .positive()
      .describe('Rounded reading time used in hero metadata + JSON-LD hydration'),
    author: z
      .object({
        name: z.string().describe('Primary byline for the article'),
        title: z
          .string()
          .optional()
          .describe('Role or team affiliation displayed alongside the name'),
        avatar: z
          .string()
          .optional()
          .describe('Optional path to an avatar rendered via @astrojs/image'),
        bio: z
          .string()
          .describe(
            'Short-form bio rendered in the shared author component for context + trust signals',
          ),
        links: z
          .array(
            z.object({
              label: z.string().describe('Link label such as “LinkedIn” or “Research Portfolio”'),
              url: z.string().url().describe('Destination URL'),
              rel: z
                .string()
                .optional()
                .describe('Override rel attribute for compliance (e.g., noopener)'),
            }),
          )
          .default([])
          .describe('Optional social/portfolio links that render inline below the author bio copy'),
      })
      .describe(
        'Structured author metadata keeps layout + JSON-LD in sync without per-page overrides',
      ),
    draft: z
      .boolean()
      .default(false)
      .describe('Toggle to omit unpublished drafts from static builds'),
  }),
});

// Marketing and evergreen content (solutions, pricing, etc.) stay in
// `src/content/marketing` with intentionally flexible fields.
const marketingCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    summary: z.string().optional(),
    heroCtaLabel: z.string().optional(),
    order: z
      .number()
      .int()
      .default(0)
      .describe('Controls navigation ordering without renaming files'),
    featured: z.boolean().default(false),
    draft: z
      .boolean()
      .default(false)
      .describe('Toggle to hide unpublished marketing entries from navigation + homepage previews'),
  }),
});

export const collections = {
  blog: blogCollection,
  marketing: marketingCollection,
  homepage: homepageCollection,
  solutions: solutionCollection,
};
