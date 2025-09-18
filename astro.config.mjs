import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import image from '@astrojs/image';

const cspDirectives = {
  'default-src': "'self'",
  'script-src': "'self'",
  'style-src': "'self'",
  'img-src': "'self' data: blob:",
  'font-src': "'self'",
  'connect-src': "'self'",
  'frame-src': "'self'",
  'object-src': "'none'"
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
      directives: cspDirectives
    }
  },
  vite: {
    build: {
      target: 'esnext'
    },
    ssr: {
      external: ['sharp']
    }
  }
});
