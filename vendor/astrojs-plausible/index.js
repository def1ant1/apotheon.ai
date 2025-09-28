/**
 * Local Plausible integration wrapper
 * -----------------------------------
 *
 * Astro normally ships an official `@astrojs/plausible` package that injects the tracking
 * script directly into the document head. Our enterprise build gates all telemetry behind
 * Klaro consent flows, so we vendor a slim integration that mirrors the upstream API while
 * delegating to a consent-aware bootstrapper inside `/src/scripts`.
 */
export default function plausibleIntegration(options = {}) {
  const {
    domain = 'apotheon.ai',
    scriptSrc = 'https://plausible.io/js/script.tagged.js',
    apiHost,
    consentService = 'umami-telemetry',
  } = options;

  const serializedConfig = JSON.stringify({ domain, scriptSrc, apiHost, consentService });

  return {
    name: 'apotheon-consent-aware-plausible',
    hooks: {
      'astro:config:setup'({ injectScript }) {
        injectScript(
          'page',
          `import("/src/scripts/analytics-consent-gate.ts").then((module) => {
             if (typeof module?.bootstrapConsentAwareAnalytics === 'function') {
               module.bootstrapConsentAwareAnalytics(${serializedConfig});
             }
           }).catch((error) => {
             console.error('[apotheon-plausible] bootstrap failed', error);
           });`,
        );
      },
    },
  };
}
