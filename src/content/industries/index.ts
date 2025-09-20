import { readdirSync } from 'node:fs';
import { extname } from 'node:path';

import { defineCollection, z, type CollectionEntry } from 'astro:content';

import { INDUSTRY_ICON_SLUGS } from './iconSlugs';

const solutionDirectory = new URL('../solutions/', import.meta.url);
// eslint-disable-next-line security/detect-non-literal-fs-filename
const solutionSlugs = readdirSync(solutionDirectory)
  .filter((entry) => extname(entry) === '.mdx')
  .map((entry) => entry.replace(/\.mdx$/u, ''))
  .sort();

const heroSchema = z
  .object({
    eyebrow: z
      .string()
      .min(1)
      .describe('Short uppercase strapline that signals the vertical to scanning visitors.'),
    headline: z
      .string()
      .min(1)
      .describe(
        'Primary hero headline aligning with the tone guidelines documented in docs/dev/INDUSTRIES.md.',
      ),
    copy: z
      .string()
      .min(1)
      .describe(
        'Support paragraph summarizing the sector story and referencing compliance positioning.',
      ),
    icon: z
      .enum(INDUSTRY_ICON_SLUGS)
      .describe('Slug that resolves to an inline SVG icon defined in src/components/icons.'),
  })
  .describe('Hero metadata rendered at the top of the industry template.');

const pressureSchema = z
  .object({
    title: z.string().min(1).describe('Executive-level pressure statement used as an h3 heading.'),
    description: z
      .string()
      .min(1)
      .describe('Expanded narrative clarifying the operational pressure felt by the sector.'),
    metric: z
      .string()
      .optional()
      .describe('Optional quantitative anchor that grounds the pressure in measurable reality.'),
  })
  .describe('Individual industry pressure surfaced directly after the hero to validate urgency.');

const complianceSchema = z
  .object({
    framework: z.string().min(1).describe('Named regulation, framework, or control family.'),
    highlight: z
      .string()
      .min(1)
      .describe('Copy summarizing how Apotheon.ai satisfies the referenced framework.'),
    evidence: z
      .string()
      .optional()
      .describe(
        'Optional attestation, report, or control identifier that backs the compliance claim.',
      ),
  })
  .describe('Compliance proof points rendered inside the dedicated compliance section.');

const solutionMapSchema = z
  .object({
    slug: z
      .string()
      .min(1)
      .describe('Slug corresponding to a solution entry stored under src/content/solutions.')
      .refine(
        (value) => solutionSlugs.includes(value),
        (value) => ({
          message: `Solution slug "${String(value)}" does not exist in src/content/solutions.`,
        }),
      ),
    positioning: z
      .string()
      .min(1)
      .describe('Narrative articulating why the solution accelerates sector outcomes.'),
    outcome: z
      .string()
      .optional()
      .describe('Optional measurable outcome unlocked once the solution is deployed.'),
  })
  .describe('Solution references validated against the canonical solutions collection.');

const useCaseSchema = z
  .object({
    title: z.string().min(1).describe('Use case title rendered as a definition list term.'),
    persona: z.string().min(1).describe('Primary persona or team accountable for this use case.'),
    narrative: z
      .string()
      .min(1)
      .describe('Detailed story describing the workflow Apotheon.ai enables for the persona.'),
    automationLevel: z
      .string()
      .optional()
      .describe('Optional maturity note describing automation coverage or rollout stage.'),
  })
  .describe('Persona-targeted scenario rendered in the use case definition list.');

const ctaSchema = z
  .object({
    label: z.string().min(1).describe('Button label rendered in the CTA banner.'),
    href: z.string().min(1).describe('Relative or absolute URL that the CTA should navigate to.'),
    description: z
      .string()
      .optional()
      .describe('Optional supporting copy reinforcing the commitment requested by the CTA.'),
    ariaLabel: z
      .string()
      .optional()
      .describe(
        'Optional aria-label override used when the visual label lacks sufficient context.',
      ),
  })
  .describe('Shared CTA contract used across hero and closing banner components.');

const ctaGroupSchema = z
  .object({
    demo: ctaSchema.describe(
      'Conversion entry point for coordinating a live platform walkthrough.',
    ),
    whitepaper: ctaSchema.describe(
      'Evergreen whitepaper CTA capturing high-intent research traffic.',
    ),
  })
  .describe('Dual CTA group rendered at the bottom of each industry page.');

export const industriesCollection = defineCollection({
  type: 'content',
  schema: z
    .object({
      title: z
        .string()
        .min(1)
        .describe('Human-readable page title surfaced in metadata and navigation.'),
      order: z
        .number()
        .int()
        .default(0)
        .describe('Sort order applied to cards and breadcrumb navigation elements.'),
      featured: z
        .boolean()
        .default(false)
        .describe('Flags industries that should receive featured styling on list views.'),
      draft: z
        .boolean()
        .default(false)
        .describe(
          'Prevents unpublished industries from generating static routes or appearing in lists.',
        ),
      hero: heroSchema,
      pressures: z
        .array(pressureSchema)
        .min(1)
        .describe('Collection of business or regulatory pressures addressed by the platform.'),
      complianceHighlights: z
        .array(complianceSchema)
        .min(1)
        .describe('Compliance assurances covering frameworks, attestations, and control coverage.'),
      solutionMap: z
        .array(solutionMapSchema)
        .min(1)
        .describe('Validated solution references automatically linked inside the template.'),
      useCases: z
        .array(useCaseSchema)
        .min(1)
        .describe(
          'Targeted scenarios demonstrating how cross-functional teams activate the platform.',
        ),
      ctas: ctaGroupSchema,
      seo: z
        .object({
          description: z
            .string()
            .min(1)
            .describe('Optional meta description override for the industry detail page.'),
        })
        .optional()
        .describe('Optional SEO overrides applied when the default messaging needs refinement.'),
    })
    .describe('Schema powering structured industry narratives with compliance-forward messaging.'),
});

export type IndustryEntry = CollectionEntry<'industries'>;
export type IndustryDocument = IndustryEntry;
