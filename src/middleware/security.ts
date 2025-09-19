import { defineMiddleware } from 'astro/middleware';

import {
  buildCspHeaders,
  DEFAULT_REPORT_URI,
  DEFAULT_SECURITY_HEADERS,
} from '../../config/security/csp';

/**
 * Shared helper to determine whether the current runtime should run in
 * report-only mode. We default to report-only for local dev and preview
 * deploys so engineers can tighten directives iteratively without blocking
 * testers.
 */
const shouldReportOnly = () =>
  import.meta.env.DEV ||
  process.env.ASTRO_PREVIEW === 'true' ||
  process.env.ASTRO_CSP_REPORT_ONLY === 'true';

/**
 * Centralized security middleware responsible for wiring nonce-based CSP headers
 * as well as a few evergreen defense-in-depth headers. Keeping the logic here
 * guarantees parity between dev, preview, and production environments.
 */
export const securityMiddleware = defineMiddleware(async (context, next) => {
  const reportOnly = shouldReportOnly();
  const reportUri = process.env.ASTRO_CSP_REPORT_URI ?? DEFAULT_REPORT_URI;

  const { nonce, headerName, headerValue, reportTo } = buildCspHeaders({
    nonce: context.locals.cspNonce,
    reportOnly,
    reportUri,
  });

  // Stash the nonce on locals so page-level utilities can inject it into inline
  // scripts or style tags on demand (e.g. analytics bootstrap). We set the nonce
  // before calling `next()` to make it available to downstream middleware or
  // Astro endpoints.
  context.locals.cspNonce = nonce;

  const response = await next();

  response.headers.set(headerName, headerValue);

  if (reportTo) {
    response.headers.set('Report-To', reportTo);
  }

  for (const [header, value] of Object.entries(DEFAULT_SECURITY_HEADERS)) {
    response.headers.set(header, value);
  }

  return response;
});
