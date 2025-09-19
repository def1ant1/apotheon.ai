import { sequence } from 'astro/middleware';

import { securityMiddleware } from './middleware/security';

/**
 * Astro loads `src/middleware.ts` automatically. We compose middleware with
 * `sequence()` to maintain a predictable execution order as future hardening
 * layers are introduced.
 */
export const onRequest = sequence(securityMiddleware);
