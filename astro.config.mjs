import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import image from '@astrojs/image';
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
  toAstroContentSecurityPolicy
} from './config/security/csp';
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
const isRouteExcludedFromDiscovery = createRouteExclusionPredicate();
const sitemapLastModified = new Date();

export default defineConfig({
  output: 'static',
  trailingSlash: 'ignore',
  site: canonicalSiteUrl,
  integrations: [
    tailwind({
      applyBaseStyles: false
    }),
    mdx(),
    react(),
    image({
      serviceEntryPoint: '@astrojs/image/sharp'
    }),
    i18next({
      /**
       * The config file colocated in `src/i18n` keeps locale metadata near the
       * translation bundles so teams can evolve strings and runtime behaviour in
       * one place.
       */
      configPath: './src/i18n/i18next.server.mjs'
    }),
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
    resolve: {
      alias: {
        '@i18n': I18N_SOURCE_DIR
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
