/// <reference types="@cloudflare/workers-types" />

import { z } from 'zod';

import {
  WHITEPAPER_MANIFEST_BY_SLUG,
  type WhitepaperManifestEntry,
} from '../src/generated/whitepapers.manifest';
import {
  analyzeDomain,
  extractDomain,
  lookupMxRecords,
  shouldPerformMxLookup,
  type DomainAnalysisFlags,
} from '../src/utils/domain-allowlist';
import { serverWhitepaperRequestSchema } from '../src/utils/whitepaper-request';

interface Env {
  WHITEPAPER_RATE_LIMIT: KVNamespace;
  WHITEPAPER_AUDIT_DB: D1Database;
  WHITEPAPER_ASSETS: R2Bucket;
  TURNSTILE_SECRET: string;
  WHITEPAPER_BLOCKLIST?: string;
  WHITEPAPER_ALLOWLIST?: string;
  WHITEPAPER_SIGNING_TTL_SECONDS?: string;
}

interface WorkerExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

const RATE_LIMIT_WINDOW_SECONDS = 15 * 60;
const RATE_LIMIT_KEY_PREFIX = 'whitepaper-rate';
const TURNSTILE_VERIFY_ENDPOINT = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const DEFAULT_SIGNING_TTL_SECONDS = 15 * 60;

const serverSideSchema = serverWhitepaperRequestSchema;

const turnstileResponseSchema = z.object({
  success: z.boolean(),
  challenge_ts: z.string().optional(),
  hostname: z.string().optional(),
  'error-codes': z.array(z.string()).optional(),
  action: z.string().optional(),
  cdata: z.string().optional(),
  score: z.number().optional(),
});

const signedUrlSchema = z.object({
  url: z.string().url(),
  expiration: z.string().datetime(),
});

type TurnstileResponse = z.infer<typeof turnstileResponseSchema>;
type SignedUrl = z.infer<typeof signedUrlSchema>;

type UnknownPayload = Record<string, unknown>;

type SignableBucket = R2Bucket & {
  // The runtime exposes `createSignedUrl` even though the type definition does not.
  createSignedUrl?: (options: {
    key: string;
    expires: number;
    method?: string;
  }) => Promise<string | { url: string }>;
};

async function parseRequestPayload(request: Request): Promise<UnknownPayload> {
  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    const json: unknown = await request.json();
    if (json && typeof json === 'object' && !Array.isArray(json)) {
      return { ...json } as Record<string, unknown>;
    }
    return {};
  }

  const formData = await request.formData();
  const result: UnknownPayload = {};
  for (const [key, value] of formData.entries()) {
    result[key] = value;
  }
  return result;
}

async function verifyTurnstileToken(
  token: string,
  secret: string,
  remoteIp: string | null,
  fetcher: typeof fetch = fetch,
): Promise<TurnstileResponse> {
  const params = new URLSearchParams();
  params.append('secret', secret);
  params.append('response', token);
  if (remoteIp) params.append('remoteip', remoteIp);

  const response = await fetcher(TURNSTILE_VERIFY_ENDPOINT, {
    method: 'POST',
    body: params,
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
  });

  if (!response.ok) {
    throw new HttpError(502, 'Verification service unavailable.');
  }

  const parsed = turnstileResponseSchema.parse(await response.json());

  if (!parsed.success) {
    throw new HttpError(400, 'Verification failed. Please refresh and try again.');
  }

  return parsed;
}

async function enforceRateLimit(env: Env, identifier: string) {
  const key = `${RATE_LIMIT_KEY_PREFIX}:${identifier}`;
  const existing = await env.WHITEPAPER_RATE_LIMIT.get(key);

  if (existing) {
    throw new HttpError(429, 'Too many requests detected. Retry shortly.');
  }

  await env.WHITEPAPER_RATE_LIMIT.put(key, '1', { expirationTtl: RATE_LIMIT_WINDOW_SECONDS });
}

function deriveCustomList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function resolveWhitepaper(slug: string): WhitepaperManifestEntry {
  const entry = WHITEPAPER_MANIFEST_BY_SLUG.get(slug);
  if (!entry) {
    throw new HttpError(404, 'Requested whitepaper is not available.');
  }
  if (entry.lifecycle.draft || entry.lifecycle.archived) {
    throw new HttpError(404, 'Requested whitepaper is not available.');
  }
  if (entry.lifecycle.embargoedUntil) {
    const embargoDate = new Date(entry.lifecycle.embargoedUntil);
    if (Number.isFinite(embargoDate.valueOf()) && embargoDate.getTime() > Date.now()) {
      throw new HttpError(403, 'This asset is not yet available for distribution.');
    }
  }
  return entry;
}

async function ensureAssetExists(bucket: R2Bucket, key: string) {
  const head = await bucket.head(key);
  if (!head) {
    throw new HttpError(500, 'Requested asset is unavailable.');
  }
}

async function createSignedUrl(
  bucket: SignableBucket,
  key: string,
  ttlSeconds: number,
): Promise<SignedUrl> {
  const expirationMs = Date.now() + ttlSeconds * 1000;
  const expirationIso = new Date(expirationMs).toISOString();

  if (typeof bucket.createSignedUrl === 'function') {
    const expires = Math.floor(expirationMs / 1000);
    const signed = await bucket.createSignedUrl({ key, expires, method: 'GET' });
    const url = typeof signed === 'string' ? signed : signed?.url;
    if (!url) {
      throw new HttpError(500, 'Failed to generate download link.');
    }
    return signedUrlSchema.parse({ url, expiration: expirationIso });
  }

  throw new HttpError(500, 'Bucket binding missing signed URL capability.');
}

async function persistRequest(
  env: Env,
  payload: z.infer<typeof serverSideSchema>,
  entry: WhitepaperManifestEntry,
  options: {
    domainClassification: string;
    domainFlags: DomainAnalysisFlags;
    domainRationale: string[];
    remoteIp: string | null;
    userAgent: string | null;
    turnstile: TurnstileResponse;
    mxRecords?: string[];
    signedUrl: SignedUrl;
  },
) {
  const requestId = crypto.randomUUID();
  const statement = env.WHITEPAPER_AUDIT_DB.prepare(
    `INSERT INTO whitepaper_requests
      (id, whitepaper_slug, whitepaper_title, name, email, company, role, justification,
       domain, domain_classification, domain_flags, domain_rationale,
       ip_address, user_agent, turnstile_success, turnstile_score, turnstile_action,
       mx_records, marketing_opt_in, signed_url_expires_at, asset_object_key, asset_checksum,
       asset_content_type, source_url, utm, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8,
             ?9, ?10, ?11, ?12,
             ?13, ?14, ?15, ?16, ?17,
             ?18, ?19, ?20, ?21, ?22,
             ?23, ?24, ?25, datetime('now'))`,
  );

  await statement
    .bind(
      requestId,
      entry.slug,
      entry.title,
      payload.name,
      payload.email,
      payload.company,
      payload.role,
      payload.justification,
      extractDomain(payload.email) ?? '',
      options.domainClassification,
      JSON.stringify(options.domainFlags),
      JSON.stringify(options.domainRationale),
      options.remoteIp,
      options.userAgent,
      options.turnstile.success ? 1 : 0,
      options.turnstile.score ?? null,
      options.turnstile.action ?? null,
      JSON.stringify(options.mxRecords ?? []),
      payload.marketingOptIn ? 1 : 0,
      options.signedUrl.expiration,
      entry.asset.objectKey,
      entry.asset.checksum,
      entry.asset.contentType,
      payload.sourceUrl ?? null,
      JSON.stringify(payload.utm ?? {}),
    )
    .run();

  return requestId;
}

function createResponse(payload: {
  status: string;
  downloadUrl?: string;
  expiresAt?: string;
  requestId: string;
}) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    },
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: WorkerExecutionContext): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
        status: 405,
        headers: { 'content-type': 'application/json' },
      });
    }

    try {
      const payload = await parseRequestPayload(request);
      const candidate: UnknownPayload = { ...payload };
      const rawSourceUrl = candidate.sourceUrl;
      const fallbackSource = request.headers.get('referer') ?? undefined;
      candidate.sourceUrl = typeof rawSourceUrl === 'string' ? rawSourceUrl : fallbackSource;

      const sanitized = serverSideSchema.parse(candidate);

      const allowlist = deriveCustomList(env.WHITEPAPER_ALLOWLIST);
      const blocklist = deriveCustomList(env.WHITEPAPER_BLOCKLIST);
      const domainAnalysis = analyzeDomain(sanitized.email, {
        additionalAllowlist: allowlist,
        additionalBlocklist: blocklist,
      });

      if (domainAnalysis.classification === 'block') {
        throw new HttpError(403, 'Use a corporate email address that passes verification.');
      }

      const remoteIp =
        request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for') ?? null;
      const userAgent = request.headers.get('user-agent');

      const rateLimitKey = `${sanitized.email.toLowerCase()}::${remoteIp ?? 'unknown'}`;
      await enforceRateLimit(env, rateLimitKey);

      const turnstile = await verifyTurnstileToken(
        sanitized.turnstileToken,
        env.TURNSTILE_SECRET,
        remoteIp,
      );

      let mxRecords: string[] | undefined;
      if (shouldPerformMxLookup(domainAnalysis)) {
        const lookupResult = await lookupMxRecords(
          domainAnalysis.domain || extractDomain(sanitized.email) || '',
        );
        mxRecords = lookupResult.records;
      }

      const entry = resolveWhitepaper(sanitized.whitepaperSlug);
      await ensureAssetExists(env.WHITEPAPER_ASSETS, entry.asset.objectKey);

      const ttlOverride = env.WHITEPAPER_SIGNING_TTL_SECONDS
        ? Number.parseInt(env.WHITEPAPER_SIGNING_TTL_SECONDS, 10)
        : NaN;
      const ttlSeconds =
        Number.isFinite(ttlOverride) && ttlOverride > 0 ? ttlOverride : DEFAULT_SIGNING_TTL_SECONDS;
      const signedUrl = await createSignedUrl(
        env.WHITEPAPER_ASSETS as SignableBucket,
        entry.asset.objectKey,
        ttlSeconds,
      );

      const requestId = await persistRequest(env, sanitized, entry, {
        domainClassification: domainAnalysis.classification,
        domainFlags: domainAnalysis.flags,
        domainRationale: domainAnalysis.rationale,
        remoteIp,
        userAgent,
        turnstile,
        mxRecords,
        signedUrl,
      });

      ctx.waitUntil(
        Promise.resolve().then(() => {
          console.info('[whitepapers] request_issued', {
            requestId,
            slug: entry.slug,
            domain: domainAnalysis.domain,
            classification: domainAnalysis.classification,
          });
        }),
      );

      return createResponse({
        status: 'granted',
        downloadUrl: signedUrl.url,
        expiresAt: signedUrl.expiration,
        requestId,
      });
    } catch (error) {
      console.error('[whitepapers] request_failed', error);
      if (error instanceof HttpError) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: error.status,
          headers: { 'content-type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ error: 'Unable to process request.' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      });
    }
  },
};

export { createSignedUrl, deriveCustomList, resolveWhitepaper, signedUrlSchema };
export type { SignableBucket };
