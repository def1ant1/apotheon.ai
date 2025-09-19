import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import image from '@astrojs/image';

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

// Pagefind indexing is triggered post-build via the `pagefind:index` npm script
// to keep the static output lean while still supporting local full-text search.
export default defineConfig({
  output: 'static',
  trailingSlash: 'ignore',
  integrations: [
    tailwind({
      applyBaseStyles: false
    }),
    mdx(),
    react(),
    image({
      serviceEntryPoint: '@astrojs/image/sharp'
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
    server: {
      host: true,
      https: httpsOptions,
      headers: devServerHeaders
    },
    build: {
      target: 'esnext'
    },
    ssr: {
      external: ['sharp']
    }
  }
});
