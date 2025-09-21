/// <reference types="@cloudflare/workers-types" />

import { z } from 'zod';

import { serverContactFormSchema } from '../src/utils/contact-validation';
import {
  analyzeDomain,
  extractDomain,
  lookupMxRecords,
  shouldPerformMxLookup,
  type DomainAnalysisFlags,
} from '../src/utils/domain-allowlist';

interface Env {
  CONTACT_RATE_LIMIT: KVNamespace;
  CONTACT_AUDIT_DB: D1Database;
  TURNSTILE_SECRET: string;
  CONTACT_BLOCKLIST?: string;
  CONTACT_ALLOWLIST?: string;
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
const RATE_LIMIT_KEY_PREFIX = 'contact-rate';
const TURNSTILE_VERIFY_ENDPOINT = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

const serverSideSchema = serverContactFormSchema;

const turnstileResponseSchema = z.object({
  success: z.boolean(),
  challenge_ts: z.string().optional(),
  hostname: z.string().optional(),
  'error-codes': z.array(z.string()).optional(),
  action: z.string().optional(),
  cdata: z.string().optional(),
  score: z.number().optional(),
});

type TurnstileResponse = z.infer<typeof turnstileResponseSchema>;
type SanitizedPayload = z.infer<typeof serverSideSchema>;
type UnknownPayload = Record<string, unknown>;

async function parseRequestPayload(request: Request): Promise<UnknownPayload> {
  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    const json: unknown = await request.json();
    if (json && typeof json === 'object' && !Array.isArray(json)) {
      const result: UnknownPayload = {};
      for (const [key, value] of Object.entries(json as Record<string, unknown>)) {
        result[key] = value;
      }
      return result;
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
  const existing = await env.CONTACT_RATE_LIMIT.get(key);

  if (existing) {
    throw new HttpError(429, 'Too many submissions detected. Please retry in a few minutes.');
  }

  await env.CONTACT_RATE_LIMIT.put(key, '1', { expirationTtl: RATE_LIMIT_WINDOW_SECONDS });
}

function deriveCustomList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

async function persistSubmission(
  env: Env,
  payload: SanitizedPayload,
  options: {
    domainRationale: string[];
    domainClassification: string;
    domainFlags: DomainAnalysisFlags;
    remoteIp: string | null;
    userAgent: string | null;
    turnstile: TurnstileResponse;
    mxRecords?: string[];
  },
) {
  const submissionId = crypto.randomUUID();
  const statement = env.CONTACT_AUDIT_DB.prepare(
    `INSERT INTO contact_submissions
      (id, name, email, company, intent, message, domain, domain_classification, domain_flags, domain_rationale,
       ip_address, user_agent, turnstile_success, turnstile_score, turnstile_action, mx_records, source_url, utm, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, datetime('now'))`,
  );

  await statement
    .bind(
      submissionId,
      payload.name,
      payload.email,
      payload.company,
      payload.intent,
      payload.message,
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
      payload.sourceUrl ?? null,
      JSON.stringify(payload.utm ?? {}),
    )
    .run();

  return submissionId;
}

function createAuditResponse(submissionId: string) {
  return new Response(JSON.stringify({ status: 'accepted', submissionId }), {
    status: 202,
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

      const rawUtm = candidate.utm;
      if (rawUtm && typeof rawUtm === 'object' && !Array.isArray(rawUtm)) {
        candidate.utm = rawUtm;
      } else {
        delete candidate.utm;
      }

      const validation = serverSideSchema.safeParse(candidate);

      if (!validation.success) {
        return new Response(
          JSON.stringify({ error: 'Validation failed', details: validation.error.flatten() }),
          {
            status: 400,
            headers: { 'content-type': 'application/json' },
          },
        );
      }

      const sanitizedPayload = validation.data;
      const remoteIp = request.headers.get('CF-Connecting-IP');
      const userAgent = request.headers.get('user-agent');

      const additionalBlocklist = deriveCustomList(env.CONTACT_BLOCKLIST);
      const additionalAllowlist = deriveCustomList(env.CONTACT_ALLOWLIST);

      const domainAssessment = analyzeDomain(sanitizedPayload.email, {
        additionalAllowlist,
        additionalBlocklist,
      });

      if (domainAssessment.classification === 'block') {
        return new Response(
          JSON.stringify({
            error: 'Disposable or blocked domain detected.',
            rationale: domainAssessment.rationale,
          }),
          {
            status: 400,
            headers: { 'content-type': 'application/json' },
          },
        );
      }

      const domain = extractDomain(sanitizedPayload.email) ?? '';
      const rateLimitIdentifier = `${remoteIp ?? 'unknown'}:${domain}`;
      await enforceRateLimit(env, rateLimitIdentifier);

      const turnstile = await verifyTurnstileToken(
        sanitizedPayload.turnstileToken,
        env.TURNSTILE_SECRET,
        remoteIp,
      );

      let mxRecords: string[] | undefined;
      if (domain && shouldPerformMxLookup(domainAssessment)) {
        const lookup = await lookupMxRecords(domain);
        mxRecords = lookup.records;
        if (!lookup.hasMxRecords) {
          return new Response(
            JSON.stringify({
              error: 'Unable to verify corporate email domain.',
              rationale: [...domainAssessment.rationale, 'No MX records returned from DNS lookup.'],
            }),
            {
              status: 400,
              headers: { 'content-type': 'application/json' },
            },
          );
        }
      }

      const submissionId = await persistSubmission(env, sanitizedPayload, {
        domainRationale: domainAssessment.rationale,
        domainClassification: domainAssessment.classification,
        domainFlags: domainAssessment.flags,
        remoteIp,
        userAgent,
        turnstile,
        mxRecords,
      });

      ctx.waitUntil(
        Promise.resolve().then(() => {
          console.log('Contact submission stored', {
            submissionId,
            domain,
            remoteIp,
            intent: sanitizedPayload.intent,
            turnstileScore: turnstile.score,
          });
        }),
      );

      return createAuditResponse(submissionId);
    } catch (error) {
      console.error('Contact worker error', error);
      if (error instanceof HttpError) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: error.status,
          headers: { 'content-type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ error: 'Internal error processing submission.' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      });
    }
  },
};
