import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { defineConfig, sharpImageService } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import plausible from '@astrojs/plausible';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import i18next from 'astro-i18next';

import {
  BASELINE_DIRECTIVES,
  buildNonceEnabledDirectives,
  buildReportToHeader,
  DEFAULT_SECURITY_HEADERS,
  DEFAULT_REPORT_URI,
  serializeDirectives,
  resolveDevHttpsConfig,
  toAstroContentSecurityPolicy,
} from './config/security/csp.js';
import {
  SEO_MANIFEST,
  createRouteExclusionPredicate
} from './config/seo/manifest.mjs';

function loadImageOptimizationManifest() {
  try {
    const contents = readFileSync(new URL('./src/generated/image-optimization.manifest.json', import.meta.url), 'utf8');
    return JSON.parse(contents);
  } catch (error) {
    console.warn('[astro-config] Unable to load image optimization manifest:', error);
    return { version: 1, assets: {} };
  }
}

const IMAGE_OPTIMIZATION_MANIFEST = loadImageOptimizationManifest();
const I18N_SOURCE_DIR = fileURLToPath(new URL('./src/i18n', import.meta.url));

const enableHttps = process.env.ASTRO_DEV_HTTPS === 'true';
const httpsOptions = enableHttps ? resolveDevHttpsConfig() ?? true : undefined;

const { directives: devCspDirectives } = buildNonceEnabledDirectives({
  reportUri: DEFAULT_REPORT_URI,
  overrides: {
    'script-src': [...BASELINE_DIRECTIVES['script-src']],
    'style-src': [...BASELINE_DIRECTIVES['style-src']]
  }
});

const devCspHeaderValue = serializeDirectives(devCspDirectives);

const devServerHeaders = {
  ...DEFAULT_SECURITY_HEADERS,
  'Content-Security-Policy-Report-Only': devCspHeaderValue,
  'Report-To': buildReportToHeader(DEFAULT_REPORT_URI)
};

// Search indexing, sitemap emission, and robots.txt generation are orchestrated
// by the npm `build` script so every deployment artifact is fully SEO-ready.

const canonicalSiteUrl = SEO_MANIFEST.site.toString();
const canonicalAnalyticsDomain = new URL(canonicalSiteUrl).hostname;
const isRouteExcludedFromDiscovery = createRouteExclusionPredicate();
const sitemapLastModified = new Date();

const contentLayerIntegrations = [
  /**
   * MDX remains the only content-layer plugin today, but living here keeps
   * the migration path explicit once content collections move to the
   * Content Layer API. The integration is otherwise unchanged – it still
   * extends remark/rehype and participates in Markdown automation – but
   * the central registry guarantees future loaders inherit the same guardrails.
   */
  mdx()
];

export default defineConfig({
  output: 'static',
  trailingSlash: 'ignore',
  site: canonicalSiteUrl,
  content: {
    layer: {
      /**
       * Centralised automation contract for anything that augments the content
       * layer. Astro 5 consolidates MDX, Markdoc, and future data loaders under
       * this hook so CI can diff integrations in a single place and Ops can
       * spot drift when reconciling production vs. staging manifests. All new
       * content processors MUST register here so the deploy pipeline can
       * auto-wire telemetry, cache busting, and schema generation before build.
       */
      integrations: contentLayerIntegrations
    }
  },
  image: {
    /**
     * Astro 5 promotes the built-in `astro:assets` pipeline, so we explicitly
     * wire the Sharp-based image service here rather than relying on the
     * deprecated `@astrojs/image` integration wrapper. Keeping the service
     * declaration declarative ensures future service swaps (Cloudflare, Squoosh,
     * etc.) are a one-line change and documents to operators that responsive
     * media is still routed through Sharp for deterministic output.
     */
    service: sharpImageService()
  },
  integrations: [
    ...contentLayerIntegrations,
    plausible({
      /**
       * Plausible traditionally injects immediately, but our consent automation requires a
       * Klaro gate. The vendored integration proxies configuration into a client-side module
       * that listens for `apotheon:consent:updated` events before appending the analytics
       * script. Inline comments live alongside the runtime to keep privacy reviews frictionless.
       */
      domain: canonicalAnalyticsDomain,
      scriptSrc: process.env.ANALYTICS_PLAUSIBLE_SCRIPT_URL ?? 'https://plausible.io/js/script.tagged.js',
      apiHost: process.env.ANALYTICS_PLAUSIBLE_API_HOST,
      consentService: 'umami-telemetry'
    }),
    react(),
    i18next(),
    sitemap({
      /**
       * `@astrojs/sitemap` introspects Astro's route manifest after the build
       * completes. The integration automatically enumerates all statically
       * generated pages (content collections, dynamic routes, etc.) and feeds
       * them through this filter before writing the final sitemap files.
       */
      filter: (page) => {
        /**
         * `page` is a fully-qualified URL string, so normalising through the
         * canonical site URL lets us re-use the central exclusion predicate.
         */
        const { pathname } = new URL(page, canonicalSiteUrl);
        /**
         * Keep the sitemap aligned with our robots policy by skipping any path
         * that matches the shared exclusion list (error routes, Ladle docs,
         * etc.). Updating the manifest updates both sitemap and robots.txt.
         */
        return !isRouteExcludedFromDiscovery(pathname);
      },
      /**
       * Guardrail for sitemap chunking. When we approach the limit we can wire
       * in additional index shards before hitting the protocol's 50k ceiling.
       */
      entryLimit: SEO_MANIFEST.sitemap.entryLimit,
      /**
       * Change frequency and priority communicate soft caching hints to search
       * engines. We intentionally keep them declarative in the manifest so CI,
       * docs, and smoke tests remain in sync with production behaviour.
       */
      changefreq: SEO_MANIFEST.sitemap.cache.changeFrequency,
      priority: SEO_MANIFEST.sitemap.cache.priority,
      /**
       * A stable timestamp for this build. Individual pages may override it
       * later, but setting a baseline keeps cache validators deterministic.
       */
      lastmod: sitemapLastModified
    })
  ],
  markdown: {
    syntaxHighlight: 'shiki',
    shikiConfig: {
      theme: 'github-dark-dimmed'
    }
  },
  security: {
    checkOrigin: true,
    contentSecurityPolicy: {
      directives: toAstroContentSecurityPolicy(BASELINE_DIRECTIVES)
    }
  },
  vite: {
    plugins: [
      /**
       * Tailwind 4 ships as a first-party Vite plugin. Placing it first keeps
       * its PostCSS emulation ahead of Astro's own transforms while the
       * commented rationale reminds engineers that the legacy @astrojs/tailwind
       * wrapper has been retired.
       */
      tailwindcss()
    ],
    resolve: {
      alias: {
        '@i18n': I18N_SOURCE_DIR,
        /**
         * Vite 6 externalises Node built-ins like `util` when compiling the
         * client bundle, which breaks packages such as `escalade` that rely on
         * `util.promisify`. Installing the userland `util` polyfill and mapping
         * requests here restores the helper in browser builds without
         * impacting server output.
         */
        util: 'util/'
      }
    },
    server: {
      host: true,
      https: httpsOptions,
      headers: devServerHeaders
    },
    build: {
      target: 'esnext',
      rollupOptions: {
        external: ['@resvg/resvg-js', 'satori']
      }
    },
    ssr: {
      external: ['sharp', '@resvg/resvg-js', 'satori']
    },
    define: {
      __APOTHEON_IMAGE_MANIFEST__: JSON.stringify(IMAGE_OPTIMIZATION_MANIFEST)
    }
  }
});
