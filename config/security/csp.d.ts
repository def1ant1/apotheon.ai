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
export declare const REPORTING_GROUP = 'apotheon-csp';
/**
 * The default report endpoint aligns with the Worker stub introduced in
 * `workers/csp-report-handler.ts`. Hosts that proxy elsewhere can override this
 * per call.
 */
export declare const DEFAULT_REPORT_URI = '/api/security/csp-report';
/**
 * Opinionated baseline directives tuned for a static-first Astro deployment. We
 * keep most directives locked to `'self'` and selectively enable modern web APIs.
 * The values are arrays to simplify merging and cloning.
 */
export declare const BASELINE_DIRECTIVES: DirectiveMap;
/**
 * An additional suite of defense-in-depth headers that we reuse for both the
 * Astro dev server and edge deployments. Keeping them alongside the CSP helpers
 * prevents fragmentation across configs.
 */
export declare const DEFAULT_SECURITY_HEADERS: Record<string, string>;
/**
 * Generates a cryptographically strong nonce that is safe for CSP usage. The
 * `base64url` alphabet sidesteps `+` and `/` which historically caused confusion
 * when debugging in browser devtools.
 */
export declare const createNonce: (size?: number) => string;
/**
 * Build a directive map that includes nonce-aware `script-src`/`style-src`
 * directives and optional reporting hooks. The return value feeds into both the
 * middleware runtime and the `security.contentSecurityPolicy` option in
 * `astro.config.mjs`.
 */
export declare const buildNonceEnabledDirectives: ({
  nonce,
  reportUri,
  overrides,
}?: BuildCspOptions) => {
  nonce: string;
  directives: DirectiveMap;
};
/**
 * Convert a directive map into the RFC-compliant header string. We collapse
 * arrays into space-delimited tokens and omit directives whose arrays are empty
 * (e.g. `upgrade-insecure-requests`).
 */
export declare const serializeDirectives: (directives: DirectiveMap) => string;
/**
 * Translate our array-backed directive map into the shape Astro expects inside
 * `astro.config.mjs`. Directives with empty arrays map to `null`, which signals
 * valueless directives like `upgrade-insecure-requests`.
 */
export declare const toAstroContentSecurityPolicy: (
  directives: DirectiveMap,
) => Record<string, string | null>;
/**
 * Produce a ready-to-apply header bag for the current request. Consumers receive
 * the nonce so they can embed it into inline snippets, as well as the serialized
 * CSP string for logging or debugging purposes.
 */
export declare const buildCspHeaders: ({
  nonce,
  reportOnly,
  reportUri,
  overrides,
}?: BuildCspOptions) => {
  nonce: string;
  headerName: string;
  headerValue: string;
  reportTo: string;
  directives: DirectiveMap;
};
/**
 * Modern browsers prefer the Reporting API (`Report-To`) over deprecated
 * `report-uri`. We emit both for backwards compatibility across enterprise fleets.
 */
export declare const buildReportToHeader: (reportUri: string, group?: string) => string;
/**
 * Development-only helper that reads mkcert-generated certificates when present.
 * The Astro dev server consumes the parsed key/cert blob, falling back to Vite's
 * built-in self-signed cert when nothing exists yet.
 */
export declare const resolveDevHttpsConfig: () => {
  cert: Buffer;
  key: Buffer;
};
