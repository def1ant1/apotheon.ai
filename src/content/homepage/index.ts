import { defineCollection, z } from 'astro:content';

/**
 * Homepage collection centralizes hero content so marketing teams can update copy + assets
 * without touching Astro layouts. The schema intentionally mirrors the design system props
 * consumed by `HomepageHero.astro`.
 */
const homepageSchema = z.object({
  /**
   * Eyebrow kicker that primes the hero narrative before the headline.
   * Editors typically use 1-3 words that align to current campaigns.
   */
  eyebrow: z
    .string()
    .min(1)
    .describe('Short context-setting kicker rendered above the hero headline'),
  /**
   * Primary hero headline rendered as an <h1> for LCP and SEO.
   * Keep copy concise (≤ 70 chars) to prevent wrapping on narrow breakpoints.
   */
  headline: z.string().min(1).describe('Primary hero headline surfaced as the main page <h1>'),
  /**
   * Investor CTA surfaces key corporate documents. Provide href + accessible label.
   */
  investorCta: z
    .object({
      /** Human-friendly CTA label copy rendered on the button */
      label: z.string().min(1).describe('Visible CTA label copy'),
      /** Destination URL (internal absolute path or fully-qualified external link) */
      href: z.string().min(1).describe('Destination URL for investors'),
      /** aria-label supporting screen readers when the label alone is insufficient */
      ariaLabel: z.string().min(1).describe('Accessible label describing the investor action'),
    })
    .describe('Configuration object for the investor-focused primary CTA'),
  /**
   * Demo CTA entices product-qualified leads to request a walkthrough or sandbox.
   */
  demoCta: z
    .object({
      /** Visible CTA label copy */
      label: z.string().min(1).describe('Button label shown to end users'),
      /** Destination link for demo flow */
      href: z.string().min(1).describe('URL for demo scheduling or request flow'),
      /** Screen reader label for additional context */
      ariaLabel: z.string().min(1).describe('Accessible label for assistive technologies'),
    })
    .describe('Configuration object for the demo/secondary CTA'),
  /**
   * Supporting bullets extend the hero message with succinct proof points.
   * Provide 2-4 entries to preserve rhythm and avoid layout overflow.
   */
  supportingBullets: z
    .array(
      z.object({
        /** Optional icon identifier consumed by downstream icon registry */
        icon: z.string().optional().describe('Design token or icon name'),
        /** Short label emphasized in bold */
        title: z.string().min(1).describe('Short headline for the supporting bullet point'),
        /** Expanded explanation shown below the label */
        description: z
          .string()
          .min(1)
          .describe('Body copy elaborating on the supporting bullet point'),
      }),
    )
    .min(1)
    .max(5)
    .describe('Array of supporting bullet points reinforcing the hero promise'),
  /**
   * Hero media drives first impression + LCP. Source should resolve via Vite import.
   */
  heroMedia: z
    .object({
      /** Path to the base raster asset processed through @astrojs/image */
      src: z.string().min(1).describe('Image source path imported from the repo'),
      /** Plain-language description for screen readers */
      alt: z.string().min(1).describe('Accessible alt text for the hero image'),
      /** Target render width in pixels to precompute aspect ratios */
      width: z.number().int().positive().describe('Width (px) used for generated derivatives'),
      /** Target render height in pixels to precompute aspect ratios */
      height: z.number().int().positive().describe('Height (px) used for generated derivatives'),
      /** Flag to opt-in to <link rel="preload"> for LCP optimization */
      preload: z
        .boolean()
        .default(true)
        .describe('Whether the component should emit a preload hint for the hero media'),
    })
    .describe('Configuration for hero media rendered with @astrojs/image'),
});

export const homepageCollection = defineCollection({
  type: 'content',
  schema: homepageSchema,
});

export const homepageEntryId = 'landing';

export type HomepageHeroContent = z.infer<typeof homepageSchema>;
