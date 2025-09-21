/**
 * Centralised SEO metadata shared by Astro integrations, post-build scripts,
 * and CI smoke tests. Consolidating this manifest keeps sitemap and robots
 * automation in lockstep while documenting the rationale for our defaults.
 */
export const SEO_MANIFEST = Object.freeze({
  /**
   * Canonical production origin for absolute URLs. Astro's sitemap integration
   * requires an absolute `site` to compute `<loc>` values and `robots.txt`
   * needs it to emit `Sitemap:` hints. Update this once the production domain
   * changes; all automation will pick it up automatically.
   */
  site: new URL('https://apotheon.ai'),
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
  routes: {
    /**
     * Regex patterns describing routes that must never appear in the sitemap
     * or public search surfaces. We exclude hard error pages and auxiliary
     * documentation tooling (Ladle) that should not be indexed.
     */
    exclusionPatterns: Object.freeze([
      /^\/404\/?$/,
      /^\/500\/?$/,
      /^\/ladle(\/.*)?$/
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
