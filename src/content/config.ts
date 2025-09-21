import { z, defineCollection } from 'astro:content';

import { homepageCollection } from './homepage';
import { industriesCollection } from './industries';
import { solutionCollection } from './solutions';
import { whitepaperCollection } from './whitepapers';

// Blog articles will live in `src/content/blog`. The schema is designed so
// teams can progressively enhance metadata without migrations.
const blogCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string().describe('Human readable page title'),
    description: z.string().max(160).describe('Meta description for SEO + social cards'),
    publishDate: z.date().describe('ISO publish date for chronological sorting'),
    updatedDate: z.date().optional().describe('Optional last updated date for release notes'),
    heroImage: z
      .string()
      .min(1)
      .describe(
        'Path to hero image processed by @astrojs/image. Required so every launch post ships with art.',
      ),
    heroImageAlt: z
      .string()
      .min(1)
      .describe('Plain-language alt text accompanying heroImage for accessibility compliance'),
    tags: z
      .array(z.string().min(1))
      .min(1)
      .describe(
        'Search facets + related content scoring (lowercase kebab-case values recommended). Empty arrays fail validation.',
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
    openGraph: z
      .object({
        image: z
          .string()
          .min(1)
          .describe(
            'Absolute or relative path to the social card artwork surfaced in meta tags + feeds',
          ),
        alt: z
          .string()
          .min(1)
          .describe(
            'Description read by screen readers + surfaced in Schema.org markup for OG images',
          ),
        generatorRequestId: z
          .string()
          .optional()
          .describe(
            'Optional identifier tying the artwork back to the upcoming OG Worker (Epic 14) so we can reconcile generation logs.',
          ),
      })
      .describe('OpenGraph artwork references keep marketing previews consistent across channels.'),
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
  /**
   * Industries collection powering the /industries routes.
   *
   * Each MDX file follows the typed schema exported from
   * `src/content/industries/index.ts`, meaning editors must populate:
   * - `hero` metadata with an icon slug tied to `src/components/icons` so the
   *   page hero renders a pre-approved SVG alongside the copy.
   * - `pressures` describing quantifiable sector headwinds that the layout
   *   surfaces immediately after the hero.
   * - `complianceHighlights` calling out frameworks, attestations, and
   *   supporting evidence that risk stakeholders expect.
   * - `solutionMap` entries that reference existing solution slugs; the schema
   *   validates the slug against `src/content/solutions` to prevent broken
   *   cross-links.
   * - `useCases` detailing persona-specific workflows that benefit from the
   *   platform.
   * - `ctas` that include both a demo-oriented CTA and a whitepaper download to
   *   support hand-raisers and async researchers.
   */
  industries: industriesCollection,
  /**
   * Whitepapers collection powers the gated asset library and the delivery Worker.
   *
   * Each MDX entry defines:
   * - `asset` metadata so Workers can verify checksums and generate signed URLs.
   * - `gatingNotes` with reviewer checklists that lifecycle owners initial before
   *   publishing the PDF.
   * - `lifecycle` controls to embargo or sunset assets without manual route edits.
   */
  whitepapers: whitepaperCollection,
};
