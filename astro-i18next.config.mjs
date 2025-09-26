import astroI18nextConfig from './src/i18n/i18next.server.mjs';

/**
 * Thin wrapper so the astro-i18next integration can auto-discover the runtime
 * configuration while allowing feature teams to colocate translation metadata
 * with other localisation utilities inside `src/i18n`.
 */
export default astroI18nextConfig;
