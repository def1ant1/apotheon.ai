/// <reference types="@cloudflare/workers-types" />

/**
 * Blog analytics ingestion Worker. Mirrors the contact + whitepaper Workers by
 * validating payloads with Zod, enriching identities with `analyzeDomain`, and
 * persisting D1 rollups that downstream personalization + BI tooling consume.
 *
 * The Worker intentionally keeps the logic in-process (no external services)
 * so the ingestion path stays deterministic and easy to unit test with
 * Miniflare. Extensive comments double as runbook documentation for on-call
 * responders who need to trace failures quickly.
 */
import { z } from 'zod';

import { analyzeDomain, extractDomain } from '../src/utils/domain-allowlist';

interface Env {
  BLOG_ANALYTICS_DB: D1Database;
  BLOG_ANALYTICS_ALLOWED_ORIGINS?: string;
}

type JsonRecord = Record<string, unknown>;

type DomainAnalysisResult = ReturnType<typeof analyzeDomain>;

const BLOG_EVENT_TYPES = ['article_view', 'interaction', 'conversion'] as const;

type BlogEventType = (typeof BLOG_EVENT_TYPES)[number];

const identitySchema = z
  .object({
    email: z.string().email().optional(),
    domain: z
      .string()
      .trim()
      .min(1)
      .max(255)
      .transform((value) => value.toLowerCase())
      .optional(),
    accountId: z.string().trim().min(1).max(128).optional(),
  })
  .default({});

const metadataValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

const blogEventSchema = z.object({
  id: z.string().uuid().optional(),
  type: z.enum(BLOG_EVENT_TYPES),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(256)
    .transform((value) => value.toLowerCase()),
  sessionId: z.string().trim().min(8).max(128),
  occurredAt: z.coerce.date(),
  referrer: z.string().url().optional(),
  identity: identitySchema,
  metadata: z.record(z.string(), metadataValueSchema).default({}),
});

type BlogEvent = z.infer<typeof blogEventSchema>;

type BlogEventRollupRow = {
  eventDate: string;
  articleSlug: string;
  eventType: BlogEventType;
  domain: string;
  domainAnalysis: DomainAnalysisResult;
  totalEvents: number;
  uniqueSessions: number;
};

type PersistablePayload = {
  id: string;
  raw: string;
};

const blogEventBatchSchema = z.object({
  dataset: z.literal('blog'),
  source: z.string().optional(),
  events: z.array(blogEventSchema).min(1),
});

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

function parseAllowedOrigins(raw: string | undefined): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function deriveDomain(event: BlogEvent): string {
  if (event.identity?.domain) {
    return event.identity.domain;
  }
  if (event.identity?.email) {
    const extracted = extractDomain(event.identity.email);
    if (extracted) return extracted;
  }
  return 'unknown';
}

function toEventDate(value: Date): string {
  const utc = new Date(value.getTime());
  const year = utc.getUTCFullYear();
  const month = `${utc.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${utc.getUTCDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildRollupKey(row: BlogEventRollupRow): string {
  return [row.eventDate, row.articleSlug, row.eventType, row.domain].join('::');
}

function createRollups(events: BlogEvent[]): {
  rollups: BlogEventRollupRow[];
  payloads: PersistablePayload[];
} {
  const accumulator = new Map<string, { row: BlogEventRollupRow; sessionIds: Set<string> }>();
  const payloads: PersistablePayload[] = [];

  for (const event of events) {
    const eventId = event.id ?? crypto.randomUUID();
    payloads.push({ id: eventId, raw: JSON.stringify(event satisfies JsonRecord) });

    const domain = deriveDomain(event);
    const domainAnalysis = analyzeDomain(domain);
    const eventDate = toEventDate(event.occurredAt);

    const baseRow = {
      row: {
        eventDate,
        articleSlug: event.slug,
        eventType: event.type,
        domain,
        domainAnalysis,
        totalEvents: 0,
        uniqueSessions: 0,
      },
      sessionIds: new Set<string>(),
    };

    const key = buildRollupKey(baseRow.row);
    const existing = accumulator.get(key) ?? baseRow;

    existing.row.totalEvents += 1;
    existing.sessionIds.add(event.sessionId);
    existing.row.uniqueSessions = existing.sessionIds.size;
    existing.row.domainAnalysis = domainAnalysis;

    accumulator.set(key, existing);
  }

  const rollups = Array.from(accumulator.values()).map(({ row }) => row);
  return { rollups, payloads };
}

async function persistRollups(
  env: Env,
  rollups: BlogEventRollupRow[],
  payloads: PersistablePayload[],
) {
  if (!rollups.length && !payloads.length) return;

  const statements: D1PreparedStatement[] = [];

  const insertRollupSql = `INSERT INTO blog_event_rollups
    (event_date, article_slug, event_type, domain, domain_classification, domain_flags, total_events, unique_sessions, last_seen_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, datetime('now'))
    ON CONFLICT(event_date, article_slug, event_type, domain) DO UPDATE SET
      total_events = blog_event_rollups.total_events + excluded.total_events,
      unique_sessions = blog_event_rollups.unique_sessions + excluded.unique_sessions,
      domain_classification = excluded.domain_classification,
      domain_flags = excluded.domain_flags,
      last_seen_at = datetime('now')`;

  for (const rollup of rollups) {
    statements.push(
      env.BLOG_ANALYTICS_DB.prepare(insertRollupSql).bind(
        rollup.eventDate,
        rollup.articleSlug,
        rollup.eventType,
        rollup.domain,
        rollup.domainAnalysis.classification,
        JSON.stringify(rollup.domainAnalysis.flags),
        rollup.totalEvents,
        rollup.uniqueSessions,
      ),
    );
  }

  if (payloads.length) {
    const insertPayloadSql = `INSERT OR IGNORE INTO blog_event_payloads (id, raw_payload)
      VALUES (?1, ?2)`;
    for (const payload of payloads) {
      statements.push(
        env.BLOG_ANALYTICS_DB.prepare(insertPayloadSql).bind(payload.id, payload.raw),
      );
    }
  }

  await env.BLOG_ANALYTICS_DB.batch(statements);
}

function buildCorsHeaders(requestOrigin: string | null, allowedOrigins: Set<string>) {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (!requestOrigin) {
    return headers;
  }
  if (!allowedOrigins.size || allowedOrigins.has(requestOrigin)) {
    headers.set('access-control-allow-origin', requestOrigin);
    headers.set('vary', 'origin');
  }
  return headers;
}

async function handleRequest(request: Request, env: Env): Promise<Response> {
  const allowedOrigins = parseAllowedOrigins(env.BLOG_ANALYTICS_ALLOWED_ORIGINS);
  const origin = request.headers.get('origin');

  if (request.method === 'OPTIONS') {
    const headers = buildCorsHeaders(origin, allowedOrigins);
    headers.set('access-control-allow-methods', 'POST, OPTIONS');
    headers.set('access-control-allow-headers', 'content-type');
    headers.set('access-control-max-age', '86400');
    return new Response(null, { status: 204, headers });
  }

  if (request.method !== 'POST') {
    const headers = buildCorsHeaders(origin, allowedOrigins);
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers,
    });
  }

  const headers = buildCorsHeaders(origin, allowedOrigins);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch (error) {
    throw new HttpError(400, `Invalid JSON payload: ${(error as Error).message}`);
  }

  const batch = blogEventBatchSchema.parse(payload);
  const filteredEvents = batch.events.filter((event) => BLOG_EVENT_TYPES.includes(event.type));

  if (!filteredEvents.length) {
    return new Response(
      JSON.stringify({ status: 'ignored', reason: 'No supported event types found in batch.' }),
      { status: 202, headers },
    );
  }

  const { rollups, payloads } = createRollups(filteredEvents);
  await persistRollups(env, rollups, payloads);

  return new Response(
    JSON.stringify({
      status: 'accepted',
      received: filteredEvents.length,
      rollups: rollups.length,
    }),
    { status: 202, headers },
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      const headers = buildCorsHeaders(
        request.headers.get('origin'),
        parseAllowedOrigins(env.BLOG_ANALYTICS_ALLOWED_ORIGINS),
      );
      headers.set('content-type', 'application/json');

      if (error instanceof HttpError) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: error.status,
          headers,
        });
      }

      console.error('[blog-analytics] unexpected failure', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers,
      });
    }
  },
};

export const __internal = {
  BLOG_EVENT_TYPES,
  blogEventSchema,
  blogEventBatchSchema,
  deriveDomain,
  createRollups,
  toEventDate,
};
