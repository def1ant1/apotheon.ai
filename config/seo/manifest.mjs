/**
 * Centralised SEO metadata shared by Astro integrations, post-build scripts,
 * and CI smoke tests. Consolidating this manifest keeps sitemap and robots
 * automation in lockstep while documenting the rationale for our defaults.
 */
const PRIMARY_SITE_ORIGIN = 'https://apotheon.ai';

const SEARCH_CONSOLE_PROPERTY_IDS = Object.freeze({
  /**
   * Production Search Console property reflects the canonical marketing domain.
   * Locales inherit this ID unless they explicitly override it (e.g. geo-
   * specific ccTLDs). Keep the ID stable so historical reports remain intact.
   */
  production: 'sc-domain:apotheon.ai',
  /**
   * Staging Search Console property mirrors the preview environment. We keep a
   * dedicated property so experimental locales or IA changes can be verified
   * without impacting the production property history.
   */
  staging: 'sc-domain:staging.apotheon.ai',
  /**
   * Preview property is used by CI smoke tests and ad-hoc environments. When we
   * light up a new locale we can point the Worker automation at this property
   * until we are ready for a production cut-over.
   */
  preview: 'sc-domain:preview.apotheon.ai',
});

export const SEO_MANIFEST = Object.freeze({
  /**
   * Canonical production origin for absolute URLs. Astro's sitemap integration
   * requires an absolute `site` to compute `<loc>` values and `robots.txt`
   * needs it to emit `Sitemap:` hints. Update this once the production domain
   * changes; all automation will pick it up automatically.
   */
  site: new URL(PRIMARY_SITE_ORIGIN),
  locales: Object.freeze({
    /**
     * Default locale applied when templates omit an explicit locale override.
     * Keep this aligned with the language negotiated by the CDN to ensure the
     * HTML `lang` attribute, canonical URLs, and schema payloads remain in
     * lockstep.
     */
    default: 'en-US',
    /**
     * Central registry of every locale the marketing surface supports. Locale
     * definitions include:
     * - `origin`: protocol + host used for canonical URLs in that locale.
     * - `pathPrefix`: root segment prepended to localized routes.
     * - `hrefLang`: hreflang token injected into `<link rel="alternate">` tags.
     * - `searchConsole`: per-stage property IDs for automation scripts.
     * Update this object when introducing a new locale so sitemap, robots,
     * structured data, and monitoring automation all receive the new metadata
     * automatically.
     */
    definitions: Object.freeze({
      'en-US': Object.freeze({
        code: 'en-US',
        label: 'English (United States)',
        origin: new URL(PRIMARY_SITE_ORIGIN),
        /**
         * Root-level pages live directly under `/`. Non-default locales should
         * use a locale-specific prefix (for example `/fr/`).
         */
        pathPrefix: '/',
        /**
         * hreflang token surfaced in `<link rel="alternate">` tags as well as
         * sitemap `<xhtml:link>` entries.
         */
        hrefLang: 'en-US',
        /**
         * Search Console properties keyed by deployment stage. Localised
         * domains can override specific stages (e.g. ccTLD staging hosts) while
         * inheriting the defaults for the rest.
         */
        searchConsole: Object.freeze({ ...SEARCH_CONSOLE_PROPERTY_IDS }),
      }),
    }),
    hreflang: Object.freeze({
      /**
       * Locale clusters ensure hreflang alternates are generated symmetrically
       * across language variants. Each cluster enumerates locales that serve
       * the same canonical content in different languages.
       */
      clusters: Object.freeze([Object.freeze(['en-US'])]),
      /**
       * Locale whose canonical URL should be re-used for the `x-default`
       * alternate when search engines need a fallback.
       */
      xDefault: 'en-US',
    }),
  }),
  sitemap: {
    /**
     * Entry limit well below the 50k hard ceiling imposed by the sitemap
     * protocol. Documenting this makes scaling discussions explicit once we
     * approach the threshold.
     */
    entryLimit: 45000,
    cache: {
      /**
       * Default cache guidance for search engines. We serialise this into each
       * sitemap entry so crawlers know they can reuse entries for 24 hours.
       */
      changeFrequency: 'daily',
      /**
       * Priority relative to sibling pages. Mid-range value keeps balance
       * between frequent marketing updates and evergreen docs.
       */
      priority: 0.7
    }
  },
  searchConsole: Object.freeze({
    /**
     * Stage-aware Search Console property IDs used by automation scripts.
     * Defaults mirror the locale-level configuration but remain at the top
     * level so CI tasks without locale context can still resolve credentials.
     */
    stages: Object.freeze({
      production: Object.freeze({
        propertyId: SEARCH_CONSOLE_PROPERTY_IDS.production,
        description:
          'Primary property for the production marketing domain. Core Web Vitals + coverage reports are sourced here.',
      }),
      staging: Object.freeze({
        propertyId: SEARCH_CONSOLE_PROPERTY_IDS.staging,
        description:
          'Staging property ensures experiments and QA crawls do not pollute the production Search Console history.',
      }),
      preview: Object.freeze({
        propertyId: SEARCH_CONSOLE_PROPERTY_IDS.preview,
        description:
          'Ephemeral preview property used by CI smoke tests. Useful when validating new locales prior to launch.',
      }),
    }),
  }),
  routes: {
    /**
     * Regex patterns describing routes that must never appear in the sitemap
     * or public search surfaces. We exclude hard error pages and auxiliary
     * documentation tooling (Ladle) that should not be indexed.
     */
    exclusionPatterns: Object.freeze([
      /^\/404\/?$/,
      /^\/500\/?$/,
      /^\/ladle(\/.*)?$/,
      /^\/lead-viewer(\/.*)?$/
    ]),
    /**
     * Representative canonical paths that our smoke tests assert are present in
     * the generated sitemap and robots outputs. Keep this list lean: it exists
     * to detect accidental regressions rather than mirror the full route map.
     */
    criticalPaths: Object.freeze(['/', '/about/', '/about/history/', '/blog/'])
  },
  robots: {
    /**
     * Environment variable keys the generator inspects to determine whether we
     * are producing a production-safe robots.txt or a non-production variant
     * that blocks crawlers. Variables are checked in order so project-specific
     * overrides (like APOTHEON_DEPLOY_ENV) win.
     */
    environmentKeys: Object.freeze([
      'APOTHEON_DEPLOY_ENV',
      'DEPLOY_ENV',
      'VERCEL_ENV',
      'NETLIFY_ENV',
      'NODE_ENV'
    ]),
    /**
     * Baseline directives for the two supported deployment stages. Additional
     * user agents can be layered on when needed without changing the generator
     * logic.
     */
    policies: Object.freeze({
      production: Object.freeze([
        {
          userAgent: '*',
          allow: ['/'],
          disallow: ['/404', '/500', '/ladle', '/_astro', '/_image']
        }
      ]),
      nonProduction: Object.freeze([
        {
          userAgent: '*',
          disallow: ['/']
        }
      ])
    })
  }
});

/**
 * Sitemap index file name emitted by @astrojs/sitemap. Kept separate so robots
 * automation and smoke tests refer to a single constant.
 */
export const SITEMAP_INDEX_BASENAME = 'sitemap-index.xml';

const PRODUCTION_TOKENS = new Set(['prod', 'production', 'live', 'release']);
const NON_PRODUCTION_TOKENS = new Set([
  'preview',
  'preprod',
  'staging',
  'qa',
  'test',
  'development',
  'dev'
]);

/**
 * Resolve whether the current build should emit production-friendly robots
 * directives. The first recognised environment variable wins, enabling
 * fine-grained overrides in CI/CD without changing code.
 */
export function resolveDeploymentStage(env = process.env) {
  for (const key of SEO_MANIFEST.robots.environmentKeys) {
    const value = env[key];
    if (!value) continue;

    const normalised = String(value).toLowerCase();
    if (PRODUCTION_TOKENS.has(normalised)) {
      return 'production';
    }

    if (NON_PRODUCTION_TOKENS.has(normalised)) {
      return 'nonProduction';
    }
  }

  if (env.NODE_ENV) {
    const normalizedNodeEnv = String(env.NODE_ENV).toLowerCase();
    if (PRODUCTION_TOKENS.has(normalizedNodeEnv) || normalizedNodeEnv === 'production') {
      return 'production';
    }

    if (NON_PRODUCTION_TOKENS.has(normalizedNodeEnv)) {
      return 'nonProduction';
    }
  }

  return 'production';
}

/**
 * Convenience helper for consumers that need the canonical sitemap index URL.
 */
export function getSitemapIndexUrl(manifest = SEO_MANIFEST) {
  return new URL(SITEMAP_INDEX_BASENAME, manifest.site).toString();
}

/**
 * Returns a predicate suitable for sitemap filtering. Centralising the logic
 * ensures the sitemap integration, robots generator, and smoke tests all agree
 * on which routes qualify for public discovery.
 */
export function createRouteExclusionPredicate(
  patterns = SEO_MANIFEST.routes.exclusionPatterns
) {
  return (path) => patterns.some((pattern) => pattern.test(path));
}

/**
 * Resolve the robots policy array for the given stage. Defaults to production
 * directives so unexpected environment values fail closed.
 */
export function resolveRobotsPolicies(stage = resolveDeploymentStage()) {
  const { policies } = SEO_MANIFEST.robots;
  return policies[stage] ?? policies.production;
}
