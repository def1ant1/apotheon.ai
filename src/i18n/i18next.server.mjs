import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  DEFAULT_LOCALE,
  DEFAULT_NAMESPACE,
  NAMESPACES,
  SUPPORTED_LOCALES,
} from './metadata.mjs';

const moduleDirectory = dirname(fileURLToPath(import.meta.url));

/**
 * Shared i18next options applied to both SSG and SSR execution contexts. The
 * integration uses the filesystem backend during builds and on-demand renders to
 * avoid duplicate fetch logic.
 */
export const sharedServerOptions = {
  supportedLngs: SUPPORTED_LOCALES,
  fallbackLng: DEFAULT_LOCALE,
  ns: NAMESPACES,
  defaultNS: DEFAULT_NAMESPACE,
  initImmediate: false,
  returnObjects: true,
  interpolation: {
    /**
     * Astro handles HTML escaping upstream. Disabling the default escaping keeps
     * embedded markup (e.g., <strong>) intact while remaining XSS-safe.
     */
    escapeValue: false
  }
};

/**
 * Filesystem backend configuration. Each namespace is stored under
 * `src/i18n/<locale>/<namespace>.json`.
 */
export const filesystemBackend = {
  loadPath: join(moduleDirectory, '{{lng}}', '{{ns}}.json'),
  /**
   * Having an `addPath` defined allows future tooling to write missing keys
   * during localisation reviews without additional setup.
   */
  addPath: join(moduleDirectory, '{{lng}}', '{{ns}}.missing.json')
};

/**
 * Server-side i18next initialisation shared between SSG (during `astro build`)
 * and SSR (during dynamic middleware execution).
 */
export const i18nextServerConfig = {
  ...sharedServerOptions,
  backend: filesystemBackend
};

/**
 * Astro-i18next expects a config object describing locales and the runtime
 * server options. Exporting it as the default keeps the integration wiring
 * ergonomic while still allowing selective named imports.
 */
const astroI18nextConfig = {
  defaultLocale: DEFAULT_LOCALE,
  locales: SUPPORTED_LOCALES,
  namespaces: NAMESPACES,
  defaultNamespace: DEFAULT_NAMESPACE,
  /**
   * Keep i18n resources inside the source tree. The integration resolves the
   * filesystem path relative to Astro's `public/` directory at runtime, so we
   * step back to reach the source bundles.
   */
  resourcesBasePath: '../src/i18n',
  /**
   * Loading on the server ensures translations are baked directly into the
   * rendered HTML for both SSG output and SSR fallbacks, reducing client-side
   * JavaScript.
   */
  load: ['server'],
  i18nextServer: i18nextServerConfig,
  trailingSlash: 'ignore'
};

export default astroI18nextConfig;
export { DEFAULT_LOCALE, DEFAULT_NAMESPACE, NAMESPACES, SUPPORTED_LOCALES } from './metadata.mjs';
