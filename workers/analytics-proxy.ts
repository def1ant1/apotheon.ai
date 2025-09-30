/// <reference types="@cloudflare/workers-types" />

/**
 * Analytics proxy Worker
 * ----------------------
 *
 * The Worker acts as a zero-trust ingress layer in front of the Umami
 * deployment managed in `infra/analytics`. Every inbound beacon is validated,
 * rate-limited, and cryptographically signed before we fan it out to the
 * private Umami origin. Because privacy is a first-class requirement, the
 * Worker also honours Do-Not-Track and Global Privacy Control headers, refuses
 * requests without Cloudflare geo metadata, and returns a hardened
 * Content-Security-Policy header.
 */
import { z } from 'zod';

export interface AnalyticsProxyEnv {
  ANALYTICS_BACKEND_URL: string;
  ANALYTICS_PROXY_SECRET: string;
  ANALYTICS_RATE_LIMIT: KVNamespace;
  ANALYTICS_AUDIT_DB: D1Database;
  ANALYTICS_ALLOWED_ORIGINS?: string;
  ANALYTICS_RATE_LIMIT_MAX?: string;
  ANALYTICS_RATE_LIMIT_WINDOW_SECONDS?: string;
  PLAUSIBLE_ENDPOINT?: string;
  PLAUSIBLE_DOMAIN?: string;
  GA_ENDPOINT?: string;
  GA_MEASUREMENT_ID?: string;
  GA_API_SECRET?: string;
}

type BeaconRecord = z.infer<typeof beaconSchema>;

type JsonRecord = Record<string, unknown>;

const beaconSchema = z
  .object({
    event: z.string().trim().min(1).max(64),
    sessionId: z.string().trim().min(8).max(72),
    payload: z.record(z.string(), z.any()).default({}),
    occurredAt: z.coerce.date().optional(),
    meta: z
      .object({
        userAgent: z.string().trim().optional(),
        href: z.string().url().optional(),
      })
      .default({}),
  })
  .passthrough();

const PREFETCH_EVENT_NAME = 'prefetch_navigation_metrics';
const PREFETCH_BUCKET_LABELS = [
  '0-100ms',
  '100-200ms',
  '200-400ms',
  '400-800ms',
  '800-1600ms',
  '1600ms+',
] as const;
const PREFETCH_ROUTE_SEGMENTS_MAX = 4;
const PREFETCH_SEGMENT_LENGTH_MAX = 48;
const PREFETCH_MAX_ROUTES = 64;
const PREFETCH_MAX_VISITS = 10_000;

const prefetchMetricGroupSchema = z.object({
  visits: z.number().int().min(0).max(PREFETCH_MAX_VISITS).default(0),
  buckets: z
    .record(z.enum(PREFETCH_BUCKET_LABELS), z.number().int().min(0).max(PREFETCH_MAX_VISITS))
    .default({} as Record<(typeof PREFETCH_BUCKET_LABELS)[number], number>),
});

const prefetchPayloadSchema = z.object({
  version: z.literal(1),
  recordedAt: z.string().datetime({ offset: true }),
  routes: z
    .array(
      z.object({
        route: z.string().trim().min(1).max(256),
        prefetched: prefetchMetricGroupSchema,
        nonPrefetched: prefetchMetricGroupSchema,
      }),
    )
    .max(PREFETCH_MAX_ROUTES),
});

const REQUIRED_GEO_HEADERS = ['cf-ipcountry', 'cf-ray'] as const;
const RATE_LIMIT_WINDOW_DEFAULT = 60;
const RATE_LIMIT_MAX_DEFAULT = 120;

/**
 * Utility that parses `ANALYTICS_ALLOWED_ORIGINS` into a fast lookup table.
 */
function parseAllowedOrigins(input: string | undefined): Set<string> {
  if (!input) return new Set();
  return new Set(
    input
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

/**
 * Builds a canonical rate-limit key using the visitor IP and session ID. We
 * hash the combination to avoid leaking identifiers in KV.
 */
async function buildRateLimitKey(request: Request, beacon: BeaconRecord): Promise<string> {
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
  const encoder = new TextEncoder();
  const data = encoder.encode(`${ip}:${beacon.sessionId}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const bytes = Array.from(new Uint8Array(digest));
  const hex = bytes.map((value) => value.toString(16).padStart(2, '0')).join('');
  return `rl:${hex}`;
}

/**
 * Implements a simple fixed-window rate limit using KV with TTLs. We keep the
 * logic intentionally verbose so on-call responders can audit behaviour.
 */
async function enforceRateLimit(
  env: AnalyticsProxyEnv,
  request: Request,
  beacon: BeaconRecord,
): Promise<{ allowed: true } | { allowed: false; retryAfter: number }> {
  const windowSeconds = Number(
    env.ANALYTICS_RATE_LIMIT_WINDOW_SECONDS ?? RATE_LIMIT_WINDOW_DEFAULT,
  );
  const maxRequests = Number(env.ANALYTICS_RATE_LIMIT_MAX ?? RATE_LIMIT_MAX_DEFAULT);

  const key = await buildRateLimitKey(request, beacon);
  const now = Math.floor(Date.now() / 1000);

  const stored = await env.ANALYTICS_RATE_LIMIT.get(key, { type: 'json' });

  if (stored && typeof stored === 'object' && 'count' in stored && 'reset' in stored) {
    const current = stored as { count: number; reset: number };
    if (now >= current.reset) {
      await env.ANALYTICS_RATE_LIMIT.put(
        key,
        JSON.stringify({ count: 1, reset: now + windowSeconds }),
        { expirationTtl: windowSeconds },
      );
      return { allowed: true };
    }

    if (current.count >= maxRequests) {
      return { allowed: false, retryAfter: current.reset - now };
    }

    await env.ANALYTICS_RATE_LIMIT.put(
      key,
      JSON.stringify({ count: current.count + 1, reset: current.reset }),
      { expirationTtl: current.reset - now },
    );
    return { allowed: true };
  }

  await env.ANALYTICS_RATE_LIMIT.put(
    key,
    JSON.stringify({ count: 1, reset: now + windowSeconds }),
    { expirationTtl: windowSeconds },
  );
  return { allowed: true };
}

/**
 * Validates that Cloudflare edge has appended the geo headers we rely on for
 * compliance logging. Failing fast prevents anonymous tunnelling attempts.
 */
function assertGeoHeaders(request: Request): void {
  for (const header of REQUIRED_GEO_HEADERS) {
    if (!request.headers.has(header)) {
      throw new HttpError(428, `Missing required header: ${header}`);
    }
  }
}

/** Custom HTTP error helper so we can bubble intention-revealing responses. */
class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/**
 * Calculates an HMAC-SHA256 signature for the outbound payload so Umami can
 * authenticate the Worker. Returning hex keeps downstream integrations simple.
 */
async function signPayload(secret: string, body: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Cloudflare Workers entry point. We keep the handler small and readable; any
 * complexity lives in the helpers above for targeted unit tests.
 */
export default {
  async fetch(request: Request, env: AnalyticsProxyEnv, ctx: ExecutionContext): Promise<Response> {
    try {
      if (request.method !== 'POST') {
        throw new HttpError(405, 'Method Not Allowed');
      }

      const allowedOrigins = parseAllowedOrigins(env.ANALYTICS_ALLOWED_ORIGINS);
      const origin = request.headers.get('origin');
      if (allowedOrigins.size > 0 && origin && !allowedOrigins.has(origin)) {
        throw new HttpError(403, 'Origin not permitted');
      }

      // Respect Do-Not-Track and Global Privacy Control by short-circuiting.
      const dntEnabled =
        request.headers.get('dnt') === '1' || request.headers.get('sec-gpc') === '1';
      if (dntEnabled) {
        return createNoopResponse('analytics-suppressed=dnt');
      }

      assertGeoHeaders(request);

      let rawBody = await request.text();
      if (!rawBody) {
        throw new HttpError(400, 'Empty payload');
      }

      if (rawBody.length > 32_768) {
        throw new HttpError(413, 'Payload too large');
      }

      let beacon: BeaconRecord;
      try {
        const json = JSON.parse(rawBody) as JsonRecord;
        beacon = beaconSchema.parse(json);
      } catch (error) {
        throw new HttpError(422, error instanceof Error ? error.message : 'Invalid payload');
      }

      if (beacon.event === PREFETCH_EVENT_NAME) {
        try {
          const normalised = normalizePrefetchMetricsPayload(beacon.payload);
          if (normalised.routes.length === 0) {
            return createNoopResponse('analytics-suppressed=prefetch-empty');
          }
          beacon = { ...beacon, payload: normalised } as BeaconRecord;
          rawBody = JSON.stringify(beacon);
        } catch (error) {
          throw new HttpError(
            422,
            error instanceof Error ? error.message : 'Invalid prefetch payload',
          );
        }
      }

      const rate = await enforceRateLimit(env, request, beacon);
      if (!rate.allowed) {
        return createErrorResponse(429, 'Too Many Requests', rate.retryAfter);
      }

      const signature = await signPayload(env.ANALYTICS_PROXY_SECRET, rawBody);

      const backendUrl = new URL('/api/collect', env.ANALYTICS_BACKEND_URL);
      const backendRequest = new Request(backendUrl.toString(), {
        method: 'POST',
        body: rawBody,
        headers: buildForwardHeaders(request, signature),
      });

      const response = await fetch(backendRequest);

      ctx.waitUntil(fanOutAsyncTasks(env, request, beacon, response.status));

      if (!response.ok) {
        throw new HttpError(502, `Backend responded with ${response.status}`);
      }

      return createSuccessResponse();
    } catch (error) {
      if (error instanceof HttpError) {
        return createErrorResponse(error.status, error.message);
      }

      return createErrorResponse(500, error instanceof Error ? error.message : 'Unknown error');
    }
  },
};

function buildForwardHeaders(request: Request, signature: string): HeadersInit {
  const headers = new Headers();
  headers.set('content-type', 'application/json');
  headers.set('x-analytics-signature', `sha256=${signature}`);
  headers.set('cf-connecting-ip', request.headers.get('cf-connecting-ip') ?? '0.0.0.0');
  headers.set('cf-ipcountry', request.headers.get('cf-ipcountry') ?? 'XX');
  headers.set('cf-ray', request.headers.get('cf-ray') ?? '');

  const userAgent = request.headers.get('user-agent');
  if (userAgent) {
    headers.set('user-agent', userAgent);
  }

  return headers;
}

async function persistAuditRecord(
  env: AnalyticsProxyEnv,
  options: { beacon: BeaconRecord; status: number; cfRay: string | null; country: string },
): Promise<void> {
  await ensureAuditTable(env);
  const occurredAt = options.beacon.occurredAt ?? new Date();
  await env.ANALYTICS_AUDIT_DB.prepare(
    `INSERT INTO analytics_forwarding_audit
      (id, session_id, event, status_code, cf_ray, country, occurred_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      options.beacon.sessionId,
      options.beacon.event,
      options.status,
      options.cfRay,
      options.country,
      occurredAt.toISOString(),
    )
    .run();
}

function createSuccessResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: buildSecurityHeaders({ cache: 'private, max-age=0, must-revalidate' }),
  });
}

async function fanOutAsyncTasks(
  env: AnalyticsProxyEnv,
  request: Request,
  beacon: BeaconRecord,
  status: number,
): Promise<void> {
  await Promise.allSettled([
    persistAuditRecord(env, {
      beacon,
      status,
      cfRay: request.headers.get('cf-ray') ?? null,
      country: request.headers.get('cf-ipcountry') ?? 'XX',
    }),
    forwardToPlausible(env, beacon),
    forwardToGa(env, beacon),
  ]);
}

function createNoopResponse(reason: string): Response {
  return new Response(null, {
    status: 204,
    headers: buildSecurityHeaders({ 'x-analytics-noop': reason }),
  });
}

function createErrorResponse(status: number, message: string, retryAfter?: number): Response {
  const headers = buildSecurityHeaders({ 'content-type': 'application/json' });
  if (retryAfter !== undefined) {
    headers.set('retry-after', String(Math.max(1, retryAfter)));
  }
  return new Response(JSON.stringify({ error: message }), { status, headers });
}

function buildSecurityHeaders(extra: Record<string, string> = {}): Headers {
  const headers = new Headers({
    'content-security-policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'permissions-policy': 'geolocation=(), microphone=(), camera=()',
  });

  for (const [key, value] of Object.entries(extra)) {
    headers.set(key, value);
  }

  return headers;
}

export const __internal = {
  parseAllowedOrigins,
  enforceRateLimit,
  signPayload,
  assertGeoHeaders,
  buildSecurityHeaders,
  buildForwardHeaders,
  normalizePrefetchMetricsPayload,
  sanitisePrefetchRoute,
};

let auditTableReady = false;
const AUDIT_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS analytics_forwarding_audit (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  event TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  cf_ray TEXT,
  country TEXT NOT NULL,
  occurred_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_analytics_forwarding_audit_session ON analytics_forwarding_audit (session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_forwarding_audit_created ON analytics_forwarding_audit (occurred_at);
`;

async function ensureAuditTable(env: AnalyticsProxyEnv): Promise<void> {
  if (auditTableReady) return;
  await env.ANALYTICS_AUDIT_DB.exec(AUDIT_TABLE_SQL);
  auditTableReady = true;
}

const PLAUSIBLE_EVENTS = new Set(['search_query', 'docs_exit']);

function mapBeaconToPlausiblePayload(env: AnalyticsProxyEnv, beacon: BeaconRecord) {
  const name = beacon.event === 'search_query' ? 'pagefind_search' : beacon.event;
  const props: Record<string, unknown> = {};
  if (beacon.event === 'search_query') {
    props.query = beacon.payload?.query;
    props.status = beacon.payload?.status;
    props.resultCount = beacon.payload?.resultCount;
  }
  if (beacon.event === 'docs_exit') {
    props.slug = beacon.payload?.slug;
    props.exitPath = beacon.payload?.exitPath;
    props.timeOnPageMs = beacon.payload?.timeOnPageMs;
    props.scrollDepth = beacon.payload?.scrollDepth;
  }
  return {
    domain: env.PLAUSIBLE_DOMAIN,
    name,
    url: beacon.meta?.href ?? undefined,
    props,
  };
}

async function forwardToPlausible(env: AnalyticsProxyEnv, beacon: BeaconRecord): Promise<void> {
  if (!env.PLAUSIBLE_ENDPOINT || !env.PLAUSIBLE_DOMAIN) return;
  if (!PLAUSIBLE_EVENTS.has(beacon.event)) return;
  const payload = mapBeaconToPlausiblePayload(env, beacon);
  payload.domain = env.PLAUSIBLE_DOMAIN;
  if (!payload.url) {
    payload.url = `https://${env.PLAUSIBLE_DOMAIN}/`;
  }
  await fetch(env.PLAUSIBLE_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

async function forwardToGa(env: AnalyticsProxyEnv, beacon: BeaconRecord): Promise<void> {
  if (!env.GA_MEASUREMENT_ID || !env.GA_API_SECRET) return;
  if (!PLAUSIBLE_EVENTS.has(beacon.event)) return;
  const endpoint = env.GA_ENDPOINT ?? 'https://www.google-analytics.com/mp/collect';
  const url = new URL(endpoint);
  url.searchParams.set('measurement_id', env.GA_MEASUREMENT_ID);
  url.searchParams.set('api_secret', env.GA_API_SECRET);

  const params: Record<string, unknown> = {
    session_id: beacon.sessionId,
  };
  if (beacon.event === 'search_query') {
    params.search_term = beacon.payload?.query;
    params.search_status = beacon.payload?.status;
    params.search_results = beacon.payload?.resultCount;
  }
  if (beacon.event === 'docs_exit') {
    params.page_path = beacon.payload?.slug;
    params.exit_path = beacon.payload?.exitPath;
    params.time_on_page = beacon.payload?.timeOnPageMs;
    params.scroll_depth = beacon.payload?.scrollDepth;
  }

  const body = {
    client_id: beacon.sessionId,
    events: [
      {
        name: beacon.event === 'search_query' ? 'pagefind_search' : 'docs_exit',
        params,
      },
    ],
  };

  await fetch(url.toString(), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function normalizePrefetchMetricsPayload(payload: unknown) {
  const parsed = prefetchPayloadSchema.parse(payload);
  const routes = parsed.routes
    .map((route) => {
      const routeId = sanitisePrefetchRoute(route.route);
      const prefetched = normalisePrefetchGroup(route.prefetched);
      const nonPrefetched = normalisePrefetchGroup(route.nonPrefetched);
      if (prefetched.visits === 0 && nonPrefetched.visits === 0) {
        return null;
      }
      return {
        route: routeId,
        prefetched,
        nonPrefetched,
      };
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value));

  return {
    version: 1 as const,
    recordedAt: parsed.recordedAt,
    routes,
  };
}

function normalisePrefetchGroup(group: z.infer<typeof prefetchMetricGroupSchema>) {
  const buckets: Record<(typeof PREFETCH_BUCKET_LABELS)[number], number> = {
    '0-100ms': 0,
    '100-200ms': 0,
    '200-400ms': 0,
    '400-800ms': 0,
    '800-1600ms': 0,
    '1600ms+': 0,
  };

  let bucketTotal = 0;
  for (const label of PREFETCH_BUCKET_LABELS) {
    const raw = group.buckets?.[label] ?? 0;
    const clamped = clampPrefetchCount(raw);
    buckets[label] = clamped;
    bucketTotal += clamped;
  }

  const desired = clampPrefetchCount(group.visits ?? bucketTotal, Math.max(bucketTotal, 0));
  const visits = Math.min(PREFETCH_MAX_VISITS, Math.max(bucketTotal, desired));
  return {
    visits,
    buckets,
  };
}

function clampPrefetchCount(value: unknown, fallback = 0): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return Math.min(PREFETCH_MAX_VISITS, Math.max(0, Math.round(fallback)));
  }
  return Math.min(PREFETCH_MAX_VISITS, Math.max(0, Math.round(numeric)));
}

function sanitisePrefetchRoute(route: string): string {
  let path = '/';
  try {
    const url = new URL(route, 'https://apotheon.ai');
    path = url.pathname;
  } catch {
    path = route.startsWith('/') ? route : `/${route}`;
  }

  const segments = path
    .split('/')
    .slice(0, PREFETCH_ROUTE_SEGMENTS_MAX + 1)
    .map((segment) => sanitisePrefetchSegment(segment))
    .filter((segment, index, array) => segment !== '' || index === 0 || index === array.length - 1);

  const normalised = segments.join('/');
  return normalised || '/';
}

function sanitisePrefetchSegment(segment: string): string {
  if (!segment) return '';
  let decoded = segment;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    decoded = segment;
  }
  decoded = decoded.trim();
  if (decoded.length === 0) {
    return '';
  }

  const lower = decoded.toLowerCase();
  if (/^\d+$/.test(lower)) {
    return ':int';
  }
  if (/^[0-9a-f]{8,}$/.test(lower.replace(/-/g, ''))) {
    return ':hash';
  }
  return decoded.slice(0, PREFETCH_SEGMENT_LENGTH_MAX);
}
