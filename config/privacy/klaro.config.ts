/**
 * Klaro configuration
 * -------------------
 *
 * We ship Klaro with a trimmed-down, type-safe config so engineers can reason
 * about consent semantics entirely in TypeScript. The ConsentManager island
 * imports this configuration to drive UI rendering and to expose a headless API
 * for other components to query. Keeping the data in `config/` means security
 * reviews only diff a single file to understand what data we are collecting.
 */
export interface KlaroService {
  /** Unique identifier used as the consent key. */
  name: string;
  /** Human-friendly label surfaced in the UI. */
  title: string;
  /** Short description explaining the purpose. */
  description: string;
  /** High-level categories (analytics, marketing, etc.). */
  purposes: string[];
  /** Whether the service is strictly required and cannot be toggled off. */
  required?: boolean;
  /** Cookies or localStorage keys that Klaro should clear on opt-out. */
  cookies?: string[];
  /** Optional links for privacy policy deep dives. */
  privacyPolicyUrl?: string;
}

export interface KlaroConfig {
  version: string;
  /** Whether services default to opt-in (`true`) or opt-out (`false`). */
  defaultConsent: boolean;
  /** Services grouped by category to drive UI layout. */
  categories: Array<{
    id: string;
    title: string;
    description: string;
    services: string[];
  }>;
  services: KlaroService[];
}

export const klaroConfig: KlaroConfig = {
  version: '2024-10-analytics-hardening',
  defaultConsent: false,
  categories: [
    {
      id: 'essential',
      title: 'Essential features',
      description: 'Core functionality such as consent storage and session security.',
      services: ['consent-storage'],
    },
    {
      id: 'analytics',
      title: 'Privacy-friendly analytics',
      description: 'Anonymous event tracking that powers product feedback and roadmap decisions.',
      services: ['umami-telemetry'],
    },
    {
      id: 'marketing',
      title: 'Conversion tracking',
      description:
        'Events that alert sales and marketing teams when prospects request demos or collateral.',
      services: ['pipeline-alerts'],
    },
  ],
  services: [
    {
      name: 'consent-storage',
      title: 'Consent storage',
      description:
        'Stores your opt-in preferences so we respect them across visits. Disabling this would immediately forget your choices.',
      purposes: ['essential'],
      required: true,
      cookies: ['apotheon_privacy_consent'],
    },
    {
      name: 'umami-telemetry',
      title: 'Umami analytics',
      description:
        'Anonymous usage insights that guide roadmap priorities. We only record aggregated metrics — no IP addresses or fingerprints.',
      purposes: ['analytics'],
      privacyPolicyUrl: 'https://umami.is/docs/faq',
      cookies: ['umami.session'],
    },
    {
      name: 'pipeline-alerts',
      title: 'Pipeline notifications',
      description:
        'Optional signals that notify our go-to-market team when you explicitly request a demo, investor call, or whitepaper.',
      purposes: ['marketing'],
      cookies: ['apotheon_lead_optin'],
    },
  ],
};

/** Convenience accessor for callers that need a stable default map. */
export function getDefaultConsentState(): Record<string, boolean> {
  const defaults: Record<string, boolean> = {};
  for (const service of klaroConfig.services) {
    defaults[service.name] = Boolean(service.required ?? false) || klaroConfig.defaultConsent;
  }
  return defaults;
}
