import { readdirSync } from 'node:fs';
import { extname } from 'node:path';

import { defineCollection, z, type CollectionEntry } from 'astro:content';

const industriesDirectory = new URL('../industries/', import.meta.url);
// eslint-disable-next-line security/detect-non-literal-fs-filename
const industrySlugs = readdirSync(industriesDirectory)
  .filter((entry) => extname(entry) === '.mdx')
  .map((entry) => entry.replace(/\.mdx$/u, ''))
  .sort();

const lifecycleSchema = z
  .object({
    draft: z
      .boolean()
      .default(false)
      .describe(
        'Toggle to exclude the whitepaper from static generation and automation feeds while content is in review.',
      ),
    archived: z
      .boolean()
      .default(false)
      .describe('Marks the asset as sunset; request flows should return maintenance messaging.'),
    embargoedUntil: z
      .string()
      .datetime()
      .optional()
      .describe(
        'Optional ISO timestamp representing when marketing automation may begin distributing this asset.',
      ),
  })
  .describe(
    'Lifecycle metadata helps RevOps schedule releases and keep suppressed assets out of circulation.',
  );

const gatingNotesSchema = z
  .object({
    distribution: z
      .string()
      .min(1)
      .describe(
        'Editorial reminder explaining how marketing should frame the asset in nurture programs.',
      ),
    reviewerChecklist: z
      .array(
        z
          .string()
          .min(1)
          .describe(
            'Actionable review step (e.g., “Confirm legal citations” or “Validate KPI deltas against latest benchmark”).',
          ),
      )
      .min(1)
      .describe('Ordered checklist that lifecycle reviewers initial before shipping the PDF.'),
    complianceContacts: z
      .array(
        z
          .object({
            team: z
              .string()
              .min(1)
              .describe('Functional owner responsible for signing off compliance positioning.'),
            email: z
              .string()
              .email()
              .describe('Direct inbox used when automation escalates edge-case download requests.'),
          })
          .describe('Individual compliance approver responsible for specific review domains.'),
      )
      .min(1)
      .describe('Designated compliance reviewers who must approve gating copy before release.'),
  })
  .describe('Process notes that govern how marketing automates access while staying audit-ready.');

const assetSchema = z
  .object({
    objectKey: z
      .string()
      .min(1)
      .describe('Exact R2 object key; Workers use this to generate signed download URLs.'),
    checksum: z
      .string()
      .regex(/^[a-f0-9]{64}$/iu, 'Provide a hex-encoded SHA-256 checksum for tamper detection.')
      .describe('Hex-encoded SHA-256 digest captured by the asset hygiene script.'),
    contentType: z
      .string()
      .default('application/pdf')
      .describe('MIME type asserted when issuing signed URLs and telemetry payloads.'),
    pageCount: z
      .number()
      .int()
      .positive()
      .describe('Total number of PDF pages surfaced in analytics and nurture copy.'),
  })
  .describe('Download metadata surfaced to automation flows and the delivery Worker.');

const industriesSchema = z
  .array(
    z
      .string()
      .min(1)
      .refine(
        (value) => industrySlugs.includes(value),
        (value) => ({
          message: `Industry slug "${String(value)}" does not exist in src/content/industries.`,
        }),
      )
      .describe(
        'Industry slug referencing src/content/industries entries for contextual targeting.',
      ),
  )
  .min(1)
  .describe('Target industries prioritized when marketing sequences this asset.');

export const whitepaperCollection = defineCollection({
  type: 'content',
  schema: z
    .object({
      title: z
        .string()
        .min(1)
        .describe(
          'Human-readable whitepaper title surfaced in navigation, hero copy, and analytics.',
        ),
      summary: z
        .string()
        .min(1)
        .describe('Short synopsis used for meta descriptions and nurture previews.'),
      industries: industriesSchema,
      asset: assetSchema,
      gatingNotes: gatingNotesSchema,
      lifecycle: lifecycleSchema,
      seo: z
        .object({
          description: z
            .string()
            .min(1)
            .describe('Meta description override tailored to the gated asset landing page.'),
        })
        .optional()
        .describe('Optional SEO overrides when the summary needs additional context for search.'),
    })
    .describe(
      'Structured metadata powering the whitepaper library, delivery automation, and compliance audits.',
    ),
});

export type WhitepaperEntry = CollectionEntry<'whitepapers'>;
export type WhitepaperDocument = WhitepaperEntry;
