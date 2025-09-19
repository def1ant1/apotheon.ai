import { defineConfig, mergeConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tsconfigPaths from 'vite-tsconfig-paths';

/**
 * Dedicated Vite configuration for Ladle. We reuse the same SWC React plugin stack used by
 * the production Astro islands to guarantee feature parity (class properties, decorators,
 * JSX runtimes). The tsconfig-paths plugin mirrors Astro/Tailwind aliasing so stories can
 * import from `@components/*` without additional boilerplate.
 */
export default defineConfig(() =>
  mergeConfig(
    {},
    {
      plugins: [
        react(),
        tsconfigPaths({
          projects: ['tsconfig.ladle.json'],
        }),
      ],
      server: {
        /**
         * Bind on all interfaces so containerized CI (e.g., GitHub Actions) can hit the dev
         * server when running Playwright or Puppeteer checks.
         */
        host: '0.0.0.0',
      },
    },
  ),
);
