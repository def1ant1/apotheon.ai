import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const astroConfigModulePath = new URL(
  './node_modules/astro/dist/core/config/index.js',
  import.meta.url,
).href;
const astroLoggerModulePath = new URL(
  './node_modules/astro/dist/core/logger/core.js',
  import.meta.url,
).href;
const astroPluginModulePath = new URL(
  './node_modules/astro/dist/vite-plugin-astro/index.js',
  import.meta.url,
).href;
const astroAssetsModulePath = fileURLToPath(
  new URL('./node_modules/astro/dist/assets/index.js', import.meta.url),
);
const astroContentModulePath = fileURLToPath(
  new URL('./node_modules/astro/dist/content/index.js', import.meta.url),
);
const contentDirectory = fileURLToPath(new URL('./src/content', import.meta.url));

export default defineConfig(async () => {
  const root = dirname(fileURLToPath(new URL(import.meta.url)));
  process.env.ASTRO_SITE = 'file:///__vitest__/';
  const [{ resolveConfig, createSettings }, { Logger }, astroModule] = await Promise.all([
    import(astroConfigModulePath),
    import(astroLoggerModulePath),
    import(astroPluginModulePath),
  ]);

  const { astroConfig } = await resolveConfig({ root }, 'dev');
  const settings = await createSettings(astroConfig, root);
  const logger = new Logger({ dest: { write: () => true }, level: 'error' });

  return {
    plugins: [astroModule.default({ settings, logger })],
    resolve: {
      alias: {
        'astro:assets': astroAssetsModulePath,
        'astro:content': astroContentModulePath,
        '@content': contentDirectory,
      },
    },
    test: {
      environment: 'jsdom',
      exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**'],
      setupFiles: ['vitest.setup.ts'],
    },
  };
});
