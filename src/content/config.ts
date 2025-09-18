import { z, defineCollection } from 'astro:content';

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
    draft: z.boolean().default(false).describe('Toggle to omit unpublished drafts from static builds')
  })
});

// Marketing and evergreen content (solutions, pricing, etc.) stay in
// `src/content/marketing` with intentionally flexible fields.
const marketingCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    summary: z.string().optional(),
    heroCtaLabel: z.string().optional(),
    order: z.number().int().default(0).describe('Controls navigation ordering without renaming files'),
    featured: z.boolean().default(false)
  })
});

export const collections = {
  blog: blogCollection,
  marketing: marketingCollection
};
