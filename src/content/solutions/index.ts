import { defineCollection, z, type CollectionEntry } from 'astro:content';

import { diagramSchema } from './diagramSchema';

const ctaSchema = z
  .object({
    label: z.string().min(1).describe('Button label rendered in CTA components'),
    href: z
      .string()
      .min(1)
      .describe('Relative or absolute destination URL handled by the CTA button'),
    description: z
      .string()
      .optional()
      .describe('Optional assistive copy surfaced below the primary CTA label'),
  })
  .describe('Shared CTA contract reused across hero + footer banners');

const heroSchema = z
  .object({
    eyebrow: z
      .string()
      .min(1)
      .describe('Short descriptor rendered above the headline (e.g., “Solutions”)'),
    headline: z
      .string()
      .min(1)
      .describe('Primary hero headline aligned with search + brand messaging guardrails'),
    copy: z.string().min(1).describe('Supporting hero paragraph summarizing the value proposition'),
    primaryCta: ctaSchema.describe('Primary conversion target rendered as the leading hero button'),
    secondaryCta: ctaSchema
      .partial({ description: true })
      .optional()
      .describe('Optional supporting CTA rendered as a secondary link-style button'),
  })
  .describe('Hero metadata powering the top-of-page solution summary');

const overviewSchema = z
  .object({
    summary: z
      .string()
      .min(1)
      .describe('One-paragraph elevator pitch reused for meta descriptions + hero fallbacks'),
    bullets: z
      .array(
        z.object({
          label: z.string().min(1).describe('Short bullet heading reinforcing the summary'),
          description: z
            .string()
            .min(1)
            .describe('Support copy that translates the bullet into a business outcome'),
        }),
      )
      .default([])
      .describe('Optional summary bullets rendered directly under the overview copy'),
  })
  .describe('Structured overview copy surfaced immediately after the hero');

const featureSchema = z
  .object({
    title: z.string().min(1).describe('Feature title rendered as an h3 within the feature grid'),
    description: z
      .string()
      .min(1)
      .describe('Narrative describing how the feature manifests inside the platform'),
    evidence: z
      .string()
      .optional()
      .describe('Optional quantitative proof point rendered as muted supporting text'),
  })
  .describe('Individual feature bullet powering the “Key Features” section');

const lifecycleStepSchema = z
  .object({
    title: z
      .string()
      .min(1)
      .describe('Lifecycle step title rendered inside an ordered list for “How it works”'),
    description: z
      .string()
      .min(1)
      .describe('Detailed explanation of how this step executes inside the rollout plan'),
    duration: z
      .string()
      .optional()
      .describe('Optional duration or SLA surfaced via small text below each step'),
    owner: z
      .string()
      .optional()
      .describe('Optional accountable role surfaced inside the ordered list item'),
  })
  .describe('Process step rendered inside the “How it works” ordered list');

const useCaseSchema = z
  .object({
    title: z.string().min(1).describe('Use case title rendered as list heading'),
    persona: z
      .string()
      .optional()
      .describe('Optional persona tag clarifying which team benefits from the use case'),
    description: z
      .string()
      .min(1)
      .describe('Narrative describing business impact for the specified use case'),
    outcome: z
      .string()
      .optional()
      .describe('Optional quantitative or qualitative success metric to highlight results'),
  })
  .describe('Audience-specific scenario rendered in the “Use cases” section');

const crossLinkSchema = z
  .object({
    title: z.string().min(1).describe('Linked resource title rendered as list heading'),
    description: z
      .string()
      .min(1)
      .describe('Supporting copy summarizing why the linked resource matters'),
    href: z.string().min(1).describe('Relative or absolute destination used for the resource link'),
    label: z.string().min(1).describe('Accessible label surfaced on the actionable link element'),
  })
  .describe('Cross-link target connecting the solution to adjacent resources');

export { solutionDiagramFrontmatterSchema } from './diagramSchema';

const finalCtaSchema = z
  .object({
    headline: z
      .string()
      .min(1)
      .describe('Closing CTA headline rendered above the final call-to-action banner'),
    copy: z
      .string()
      .min(1)
      .describe('Support copy reinforcing why prospects should take the final action'),
    primaryCta: ctaSchema.describe('Primary CTA button rendered in the final banner'),
    secondaryCta: ctaSchema
      .partial({ description: true })
      .optional()
      .describe('Optional secondary CTA rendered as a link-style action in the banner'),
  })
  .describe('Bottom-of-page CTA driving the next best action');

export const solutionCollection = defineCollection({
  type: 'content',
  schema: z
    .object({
      title: z.string().min(1).describe('Human-readable page title surfaced in metadata + hero'),
      hero: heroSchema,
      overview: overviewSchema,
      keyFeatures: z
        .array(featureSchema)
        .min(1)
        .describe('Feature bullets rendered inside the `KeyFeatures` component'),
      howItWorks: z
        .array(lifecycleStepSchema)
        .min(1)
        .describe('Ordered lifecycle steps powering the `HowItWorks` component'),
      useCases: z
        .array(useCaseSchema)
        .min(1)
        .describe('Audience-specific scenarios rendered inside the `UseCases` component'),
      crossLinks: z
        .array(crossLinkSchema)
        .min(1)
        .describe('Related resources rendered via the `CrossLinks` component'),
      diagram: diagramSchema.describe(
        'Architecture visual rendered after the “How it works” section',
      ),
      finalCta: finalCtaSchema,
      order: z
        .number()
        .int()
        .default(0)
        .describe('Sorting index used by the /solutions landing grid'),
      featured: z
        .boolean()
        .default(false)
        .describe('Flags solutions that should receive featured styling across surfaces'),
      draft: z
        .boolean()
        .default(false)
        .describe('Prevents draft entries from generating static routes'),
      seo: z
        .object({
          description: z
            .string()
            .min(1)
            .describe('Optional override for the meta description + OpenGraph summary'),
        })
        .optional()
        .describe('Optional SEO overrides scoped to the solution detail page'),
    })
    .describe('Schema powering the dedicated solutions content collection'),
});

export type SolutionEntry = CollectionEntry<'solutions'>;
export type SolutionDocument = SolutionEntry;
