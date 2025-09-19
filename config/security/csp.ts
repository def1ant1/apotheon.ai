import crypto from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * A typed representation of a CSP directive map. Each directive maps to an array of
 * strings, which allows us to generate deterministic header strings later without
 * manual concatenation sprinkled around the codebase.
 */
export type DirectiveMap = Record<string, string[]>;

export interface BuildCspOptions {
  /**
   * Nonce forwarded to inline `<script>`/`<style>` tags. Generated automatically
   * when omitted to keep call sites terse.
   */
  nonce?: string;
  /**
   * Toggle report-only mode, used during local development and preview deploys so
   * teams can validate violations without breaking the page load.
   */
  reportOnly?: boolean;
  /**
   * Optional endpoint that receives `application/csp-report` payloads. When
   * provided we wire both `report-uri` and `Report-To` to keep modern browsers
   * satisfied.
   */
  reportUri?: string;
  /**
   * Hook for projects that need to extend the generated directives. Keeping this
   * strongly typed prevents typo-prone header strings littered across configs.
   */
  overrides?: Partial<DirectiveMap>;
}

/**
 * Cloudflare Workers are our default CSP reporting surface. Browsers expect a
 * JSON-encoded `Report-To` group descriptor, so we keep the name centralized to
 * avoid drift between Astro middleware and edge runtime handlers.
 */
export const REPORTING_GROUP = 'apotheon-csp';

/**
 * The default report endpoint aligns with the Worker stub introduced in
 * `workers/csp-report-handler.ts`. Hosts that proxy elsewhere can override this
 * per call.
 */
export const DEFAULT_REPORT_URI = '/api/security/csp-report';

/**
 * Opinionated baseline directives tuned for a static-first Astro deployment. We
 * keep most directives locked to `'self'` and selectively enable modern web APIs.
 * The values are arrays to simplify merging and cloning.
 */
export const BASELINE_DIRECTIVES: DirectiveMap = {
  'default-src': ["'self'"],
  'base-uri': ["'self'"],
  'object-src': ["'none'"],
  'frame-ancestors': ["'none'"],
  'form-action': ["'self'"],
  'img-src': ["'self'", 'data:', 'blob:'],
  'font-src': ["'self'", 'https:', 'data:'],
  'connect-src': ["'self'"],
  'style-src': ["'self'"],
  'script-src': ["'self'"],
  'worker-src': ["'self'"],
  'media-src': ["'self'"],
  'manifest-src': ["'self'"],
  'prefetch-src': ["'self'"],
  'upgrade-insecure-requests': [],
};

/**
 * An additional suite of defense-in-depth headers that we reuse for both the
 * Astro dev server and edge deployments. Keeping them alongside the CSP helpers
 * prevents fragmentation across configs.
 */
export const DEFAULT_SECURITY_HEADERS: Record<string, string> = {
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': [
    'accelerometer=()',
    'autoplay=(self)',
    'camera=()',
    'display-capture=()',
    'document-domain=()',
    'encrypted-media=(self)',
    'fullscreen=(self)',
    'geolocation=()',
    'gyroscope=()',
    'magnetometer=()',
    'microphone=()',
    'midi=()',
    'payment=()',
    'screen-wake-lock=()',
    'sync-xhr=()',
    'usb=()',
    'xr-spatial-tracking=()',
  ].join(', '),
  'Referrer-Policy': 'no-referrer',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
};

/**
 * Lightweight deep clone so every request gets a pristine directive map. Using a
 * helper keeps `structuredClone` polyfills out of the bundle and avoids mutating
 * the baseline constant by accident.
 */
const cloneDirectives = (directives: DirectiveMap): DirectiveMap =>
  Object.fromEntries(
    Object.entries(directives).map(([directive, values]) => [directive, [...values]]),
  );

/**
 * Generates a cryptographically strong nonce that is safe for CSP usage. The
 * `base64url` alphabet sidesteps `+` and `/` which historically caused confusion
 * when debugging in browser devtools.
 */
export const createNonce = (size = 16): string => crypto.randomBytes(size).toString('base64url');

/**
 * Build a directive map that includes nonce-aware `script-src`/`style-src`
 * directives and optional reporting hooks. The return value feeds into both the
 * middleware runtime and the `security.contentSecurityPolicy` option in
 * `astro.config.mjs`.
 */
export const buildNonceEnabledDirectives = ({
  nonce = createNonce(),
  reportUri = DEFAULT_REPORT_URI,
  overrides,
}: BuildCspOptions = {}): { nonce: string; directives: DirectiveMap } => {
  const cloned = cloneDirectives(BASELINE_DIRECTIVES);

  cloned['script-src'] = ["'self'", "'strict-dynamic'", `'nonce-${nonce}'`];

  cloned['style-src'] = ["'self'", `'nonce-${nonce}'`];

  cloned['connect-src'] = ["'self'", 'https:'];

  if (reportUri) {
    cloned['report-uri'] = [reportUri];
    cloned['report-to'] = [REPORTING_GROUP];
  }

  if (overrides) {
    for (const [directive, values] of Object.entries(overrides)) {
      if (!values) continue;
      cloned[directive] = Array.isArray(values) ? [...values] : [values];
    }
  }

  return { nonce, directives: cloned };
};

/**
 * Convert a directive map into the RFC-compliant header string. We collapse
 * arrays into space-delimited tokens and omit directives whose arrays are empty
 * (e.g. `upgrade-insecure-requests`).
 */
export const serializeDirectives = (directives: DirectiveMap): string =>
  Object.entries(directives)
    .map(([directive, values]) => {
      if (!values.length) {
        return directive;
      }
      return `${directive} ${values.join(' ')}`;
    })
    .join('; ');

/**
 * Translate our array-backed directive map into the shape Astro expects inside
 * `astro.config.mjs`. Directives with empty arrays map to `null`, which signals
 * valueless directives like `upgrade-insecure-requests`.
 */
export const toAstroContentSecurityPolicy = (
  directives: DirectiveMap,
): Record<string, string | null> =>
  Object.fromEntries(
    Object.entries(directives).map(([directive, values]) => [
      directive,
      values.length ? values.join(' ') : null,
    ]),
  );

/**
 * Produce a ready-to-apply header bag for the current request. Consumers receive
 * the nonce so they can embed it into inline snippets, as well as the serialized
 * CSP string for logging or debugging purposes.
 */
export const buildCspHeaders = ({
  nonce,
  reportOnly = false,
  reportUri,
  overrides,
}: BuildCspOptions = {}) => {
  const { nonce: resolvedNonce, directives } = buildNonceEnabledDirectives({
    nonce,
    reportUri,
    overrides,
  });
  const headerValue = serializeDirectives(directives);
  const headerName = reportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy';

  return {
    nonce: resolvedNonce,
    headerName,
    headerValue,
    reportTo: reportUri ? buildReportToHeader(reportUri) : undefined,
    directives,
  };
};

/**
 * Modern browsers prefer the Reporting API (`Report-To`) over deprecated
 * `report-uri`. We emit both for backwards compatibility across enterprise fleets.
 */
export const buildReportToHeader = (reportUri: string, group = REPORTING_GROUP) =>
  JSON.stringify({
    group,
    max_age: 60 * 60 * 24 * 7, // one week keeps reports flowing without stale configs
    endpoints: [{ url: reportUri }],
  });

/**
 * Development-only helper that reads mkcert-generated certificates when present.
 * The Astro dev server consumes the parsed key/cert blob, falling back to Vite's
 * built-in self-signed cert when nothing exists yet.
 */
export const resolveDevHttpsConfig = () => {
  const certPath = resolve('certs/localhost-cert.pem');
  const keyPath = resolve('certs/localhost-key.pem');

  const hasCert = existsSync(certPath) && existsSync(keyPath);

  if (!hasCert) {
    return undefined;
  }

  return {
    cert: readFileSync(certPath),
    key: readFileSync(keyPath),
  };
};
