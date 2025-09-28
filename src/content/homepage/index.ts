import { defineCollection, z } from 'astro:content';

/**
 * Homepage collection centralizes hero content so marketing teams can update copy + assets
 * without touching Astro layouts. The schema intentionally mirrors the design system props
 * consumed by `HomepageHero.astro`.
 */
export const homepageSchema = z.object({
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
   * Benefit cards quantify business impact in a scannable grid. Keep titles short (≤ 35 chars),
   * anchor proof points in measurable outcomes, and pair each with an attributable metric so
   * RevOps can reconcile claims during diligence.
   */
  benefits: z
    .array(
      z.object({
        /** Short label rendered as the benefit card heading (e.g., ROI, Security). */
        title: z.string().min(1).describe('Benefit title surfaced as the card heading'),
        /**
         * Narrative proof point that explains how the platform delivers the outcome. Favor
         * customer-ready language and cap at two sentences to preserve balance with the metric.
         */
        proofPoint: z
          .string()
          .min(1)
          .describe('Supporting copy articulating how the benefit manifests operationally'),
        /** Quantified result (percentage, multiplier, timeline) that anchors the claim. */
        metric: z
          .string()
          .min(1)
          .describe('Metric string rendered in the emphasized data point slot'),
      }),
    )
    .min(3)
    .max(6)
    .describe('Curated set of benefits rendered below the hero to reinforce enterprise ROI'),
  /**
   * Hero media drives first impression + LCP. Source should resolve via Vite import.
   */
  heroMedia: z
    .object({
      /** Path to the base raster asset processed through astro:assets */
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
    .describe('Configuration for hero media rendered with astro:assets'),
  /**
   * Pillars summarize the AI Operating System value props the homepage teases before deeper
   * solution pages. Keep entries ordered by strategic priority so downstream surfaces (navigation,
   * sales decks) can reuse the list without manual resorting.
   */
  pillars: z
    .array(
      z.object({
        /** Short label rendered as the card heading. */
        label: z.string().min(1).describe('Pillar label rendered as the card title'),
        /**
         * One-line supporting copy that lands immediately below the label. Treat it like a
         * high-level elevator pitch before the long-form blurb.
         */
        tagline: z.string().min(1).describe('Single-sentence teaser that expands on the label'),
        /** Rich copy describing how the pillar manifests in the product. */
        longForm: z
          .string()
          .min(1)
          .describe('Expanded explanation surfaced inside the pillar card body'),
        /**
         * Icon slug referencing an SVG under `public/static/icons/brand`. Keep filenames in
         * kebab-case (e.g., `hermes`, `morpheus`). If the design team swaps artwork, they only
         * need to update the SVG asset while reusing the same slug here.
         */
        icon: z
          .string()
          .min(1)
          .describe('Brand icon slug without extension (maps to /static/icons/brand/*.svg)'),
      }),
    )
    .min(3)
    .describe('Array of AIOS pillars rendered in a responsive grid with semantic list markup'),
  /**
   * Product modules enumerate the flagship capabilities available within the platform. These are
   * surfaced immediately after the pillars to highlight depth once the strategic framing lands.
   */
  modules: z
    .array(
      z.object({
        /** Human-readable module name (also used in aria labels). */
        name: z.string().min(1).describe('Module name displayed as the link title'),
        /** Supporting summary clarifying what the module unlocks. */
        summary: z
          .string()
          .min(1)
          .describe('One or two sentences outlining primary module capabilities'),
        /** Destination URL—prefer on-site routes to keep analytics + SEO cohesive. */
        href: z
          .string()
          .min(1)
          .describe('Absolute or relative URL pointing to the canonical module detail page'),
        /**
         * Brand icon slug shared with the pillars. Using the same source keeps iconography
         * consistent and ensures the automated icon build stays authoritative.
         */
        icon: z
          .string()
          .min(1)
          .describe('Brand icon slug (no extension) reused from /static/icons/brand'),
      }),
    )
    .min(1)
    .describe('Collection of primary product modules rendered as linked cards'),
  /**
   * Optional copy overrides for the industries preview that surfaces below the modules grid.
   * Marketing can update the heading and intro copy here to align homepage messaging with
   * active campaigns without touching Astro templates.
   */
  industriesPreview: z
    .object({
      /** Overrides the default industries preview heading rendered in the <h2>. */
      headline: z
        .string()
        .min(1)
        .optional()
        .describe('Custom heading copy for the homepage industries preview block'),
      /** Optional paragraph rendered under the heading to frame the industry cards. */
      intro: z
        .string()
        .min(1)
        .optional()
        .describe('Supporting paragraph introducing the industry cards'),
    })
    .optional()
    .describe('Homepage industries preview copy overrides managed by marketing'),
  /**
   * CTA banners extend the hero conversions deeper on the page. Each entry mirrors the UX blocks
   * rendered below the benefits grid so marketing can independently evolve messaging cadence.
   */
  ctaBanners: z
    .object({
      /** Investor banner prioritizes diligence resources and IR outreach details. */
      investor: z
        .object({
          /** Banner headline rendered as an <h2>. Keep ≤ 60 characters for balance. */
          heading: z.string().min(1).describe('Investor banner headline copy'),
          /** Primary paragraph setting expectations for the linked resource bundle. */
          body: z
            .string()
            .min(1)
            .describe('Body copy framing what investors receive after engaging the CTA'),
          /** Optional supporting note for deadlines, SLAs, or eligibility qualifiers. */
          secondaryText: z
            .string()
            .min(1)
            .optional()
            .describe('Optional secondary line for IR office hours or disclosure reminders'),
          /** Button metadata reused across hero + banners to keep analytics instrumentation aligned. */
          cta: z
            .object({
              label: z.string().min(1).describe('Visible CTA label copy'),
              href: z.string().min(1).describe('Destination URL for the investor CTA'),
              ariaLabel: z
                .string()
                .min(1)
                .describe('Accessible label describing the investor-focused action'),
            })
            .describe('Configuration for the investor banner button'),
        })
        .describe('Investor enablement banner copy + CTA metadata'),
      /** Demo banner routes prospects into guided evaluations managed by RevOps. */
      demo: z
        .object({
          /** Banner headline rendered as an <h2>. */
          heading: z.string().min(1).describe('Demo banner headline copy'),
          /** Supporting copy that frames expectations (hands-on lab, guided tour, etc.). */
          body: z
            .string()
            .min(1)
            .describe('Body copy clarifying how the demo request will be fulfilled'),
          /** Optional note for response times or prerequisites. */
          secondaryText: z
            .string()
            .min(1)
            .optional()
            .describe('Optional secondary message for SLA or qualification guidance'),
          /** CTA metadata ensures accessible labels remain in sync with analytics tracking. */
          cta: z
            .object({
              label: z.string().min(1).describe('Visible CTA label copy'),
              href: z.string().min(1).describe('Destination URL for the demo CTA'),
              ariaLabel: z
                .string()
                .min(1)
                .describe('Accessible label for assistive technology users'),
            })
            .describe('Configuration for the demo banner button'),
        })
        .describe('Demo request banner copy + CTA metadata'),
    })
    .describe('Pair of lower-funnel CTA banners rendered after the benefits grid'),
});

export const homepageCollection = defineCollection({
  type: 'content',
  schema: homepageSchema,
});

export const homepageEntryId = 'landing';

export type HomepageHeroContent = z.infer<typeof homepageSchema>;
export type HomepagePillar = HomepageHeroContent['pillars'][number];
export type HomepageModule = HomepageHeroContent['modules'][number];
export type HomepageIndustriesPreview = NonNullable<HomepageHeroContent['industriesPreview']>;
export type HomepageBenefit = HomepageHeroContent['benefits'][number];
export type HomepageCtaBanners = HomepageHeroContent['ctaBanners'];
export type HomepageInvestorBanner = HomepageCtaBanners['investor'];
export type HomepageDemoBanner = HomepageCtaBanners['demo'];
