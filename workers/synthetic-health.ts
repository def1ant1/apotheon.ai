/// <reference types="@cloudflare/workers-types" />

import { MemoryD1Database } from './shared/memory-d1';
import {
  CONTACT_CHECK_IDENTIFIER,
  SYNTHETIC_CHECK_HEADER,
  SYNTHETIC_NONCE_HEADER,
  SYNTHETIC_RUN_ID_HEADER,
  SYNTHETIC_SIGNATURE_HEADER,
  SYNTHETIC_TIMESTAMP_HEADER,
  WHITEPAPER_CHECK_IDENTIFIER,
  createSyntheticSignature,
} from './shared/synthetic-signature';

import type { D1Database } from '@cloudflare/workers-types';

interface SyntheticHealthEnv {
  SYNTHETIC_HEALTH_DB: D1Database;
  SYNTHETIC_SIGNING_SECRET: string;
  SYNTHETIC_ALERT_WEBHOOK?: string;
  SYNTHETIC_CONTACT_ENDPOINT?: string;
  SYNTHETIC_WHITEPAPER_ENDPOINT?: string;
  SYNTHETIC_WHITEPAPER_SLUG?: string;
  SYNTHETIC_LATENCY_BUDGET_MS?: string;
}

interface SyntheticExecutionOptions {
  dryRun?: boolean;
  fetchImplementation?: typeof fetch;
  logger?: Pick<typeof console, 'info' | 'error' | 'warn'>;
}

type SyntheticStatus = 'healthy' | 'degraded' | 'failed';

interface SyntheticCheckResult {
  check: string;
  status: SyntheticStatus;
  latencyMs: number;
  responseStatus: number;
  auditId?: string;
  failureReason?: string;
  endpoint: string;
}

interface SyntheticRunSummary {
  runId: string;
  status: SyntheticStatus;
  checks: SyntheticCheckResult[];
  dryRun: boolean;
}

let schemaInitialized = false;

async function ensureSchema(env: SyntheticHealthEnv): Promise<void> {
  if (schemaInitialized) {
    return;
  }
  const statements = [
    `CREATE TABLE IF NOT EXISTS synthetic_health_runs (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      check_name TEXT NOT NULL,
      status TEXT NOT NULL,
      latency_ms INTEGER NOT NULL,
      response_status INTEGER NOT NULL,
      audit_id TEXT,
      failure_reason TEXT,
      request_url TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS synthetic_health_runs_run_id_idx
      ON synthetic_health_runs (run_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS synthetic_health_runs_created_at_idx
      ON synthetic_health_runs (created_at DESC)`,
  ];

  for (const statement of statements) {
    await env.SYNTHETIC_HEALTH_DB.prepare(statement).run();
  }
  schemaInitialized = true;
}

const DEFAULT_CONTACT_ENDPOINT = 'https://apotheon.ai/api/contact';
const DEFAULT_WHITEPAPER_ENDPOINT = 'https://apotheon.ai/api/whitepapers';
const DEFAULT_WHITEPAPER_SLUG = 'apotheon-investor-brief';
const DEFAULT_LATENCY_BUDGET_MS = 2_500;
const SYNTHETIC_EMAIL = 'synthetic-monitor@apotheon.ai';
const SYNTHETIC_COMPANY = 'Apotheon Synthetic QA';
const SYNTHETIC_SOURCE_URL = 'https://status.apotheon.ai/synthetic-health';
const SYNTHETIC_UTM = Object.freeze({
  source: 'synthetic-monitor',
  medium: 'automation',
  campaign: 'synthetic-health',
});
const SYNTHETIC_USER_AGENT = 'apotheon-synthetic-health/1.0';
const SYNTHETIC_IP = '203.0.113.77';

function resolveEndpoint(candidate: string | undefined, fallback: string): string {
  if (candidate && candidate.length > 0) {
    return candidate;
  }
  return fallback;
}

function resolveLatencyBudget(env: SyntheticHealthEnv): number {
  const override = env.SYNTHETIC_LATENCY_BUDGET_MS
    ? Number.parseInt(env.SYNTHETIC_LATENCY_BUDGET_MS, 10)
    : NaN;
  if (Number.isFinite(override) && override > 0) {
    return override;
  }
  return DEFAULT_LATENCY_BUDGET_MS;
}

function evaluateOverallStatus(results: SyntheticCheckResult[]): SyntheticStatus {
  if (results.some((result) => result.status === 'failed')) {
    return 'failed';
  }
  if (results.some((result) => result.status === 'degraded')) {
    return 'degraded';
  }
  return 'healthy';
}

async function persistResult(
  env: SyntheticHealthEnv,
  runId: string,
  result: SyntheticCheckResult,
): Promise<void> {
  await ensureSchema(env);
  const statement = env.SYNTHETIC_HEALTH_DB.prepare(
    `INSERT INTO synthetic_health_runs
      (id, run_id, check_name, status, latency_ms, response_status, audit_id, failure_reason, request_url, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, datetime('now'))`,
  );

  await statement
    .bind(
      crypto.randomUUID(),
      runId,
      result.check,
      result.status,
      result.latencyMs,
      result.responseStatus,
      result.auditId ?? null,
      result.failureReason ?? null,
      result.endpoint,
    )
    .run();
}

async function executeContactCheck(
  env: SyntheticHealthEnv,
  runId: string,
  latencyBudgetMs: number,
  fetcher: typeof fetch,
): Promise<SyntheticCheckResult> {
  const endpoint = resolveEndpoint(env.SYNTHETIC_CONTACT_ENDPOINT, DEFAULT_CONTACT_ENDPOINT);
  const payload = {
    name: 'Synthetic Health Monitor',
    email: SYNTHETIC_EMAIL,
    company: SYNTHETIC_COMPANY,
    intent: 'support',
    message:
      'Synthetic health check ensuring contact intake remains operational. Please ignore this automated message unless regressions surface.',
    turnstileToken: 'synthetic-monitor-token',
    honeypot: '',
    sourceUrl: SYNTHETIC_SOURCE_URL,
    utm: SYNTHETIC_UTM,
  };

  const normalized = {
    email: payload.email.toLowerCase(),
    company: payload.company,
    intent: payload.intent,
    name: payload.name,
  };

  const timestamp = Date.now().toString();
  const nonce = crypto.randomUUID();
  const signature = await createSyntheticSignature(
    env.SYNTHETIC_SIGNING_SECRET,
    CONTACT_CHECK_IDENTIFIER,
    timestamp,
    nonce,
    normalized,
  );

  const headers = new Headers({
    'content-type': 'application/json',
    accept: 'application/json',
    'cf-connecting-ip': SYNTHETIC_IP,
    'user-agent': SYNTHETIC_USER_AGENT,
    [SYNTHETIC_SIGNATURE_HEADER]: signature,
    [SYNTHETIC_TIMESTAMP_HEADER]: timestamp,
    [SYNTHETIC_NONCE_HEADER]: nonce,
    [SYNTHETIC_CHECK_HEADER]: CONTACT_CHECK_IDENTIFIER,
    [SYNTHETIC_RUN_ID_HEADER]: runId,
  });

  const startedAt = Date.now();
  const response = await fetcher(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const latencyMs = Date.now() - startedAt;

  let body: unknown;
  try {
    body = await response.clone().json();
  } catch {
    body = undefined;
  }

  const auditId =
    body &&
    typeof body === 'object' &&
    typeof (body as { submissionId?: unknown }).submissionId === 'string'
      ? (body as { submissionId: string }).submissionId
      : undefined;

  let status: SyntheticStatus = 'healthy';
  let failureReason: string | undefined;

  if (!response.ok || !auditId) {
    status = 'failed';
    const baseReason = `Contact intake responded with status ${response.status}`;
    failureReason = auditId ? baseReason : `${baseReason} (missing submissionId)`;
  } else if (latencyMs > latencyBudgetMs) {
    status = 'degraded';
    failureReason = `Contact intake latency ${latencyMs}ms breached budget ${latencyBudgetMs}ms.`;
  }

  return {
    check: CONTACT_CHECK_IDENTIFIER,
    status,
    latencyMs,
    responseStatus: response.status,
    auditId,
    failureReason,
    endpoint,
  };
}

async function executeWhitepaperCheck(
  env: SyntheticHealthEnv,
  runId: string,
  latencyBudgetMs: number,
  fetcher: typeof fetch,
): Promise<SyntheticCheckResult> {
  const endpoint = resolveEndpoint(env.SYNTHETIC_WHITEPAPER_ENDPOINT, DEFAULT_WHITEPAPER_ENDPOINT);
  const whitepaperSlug = env.SYNTHETIC_WHITEPAPER_SLUG ?? DEFAULT_WHITEPAPER_SLUG;
  const payload = {
    name: 'Synthetic Health Monitor',
    email: SYNTHETIC_EMAIL,
    company: SYNTHETIC_COMPANY,
    role: 'Site Reliability Automation',
    justification:
      'Running automated download rehearsal to confirm whitepaper pipeline health. No commercial intent; safe to ignore unless errors arise.',
    whitepaperSlug,
    marketingOptIn: false,
    turnstileToken: 'synthetic-monitor-token',
    honeypot: '',
    sourceUrl: SYNTHETIC_SOURCE_URL,
    utm: SYNTHETIC_UTM,
  };

  const normalized = {
    email: payload.email.toLowerCase(),
    company: payload.company,
    whitepaperSlug: payload.whitepaperSlug,
    justification: payload.justification,
  };

  const timestamp = Date.now().toString();
  const nonce = crypto.randomUUID();
  const signature = await createSyntheticSignature(
    env.SYNTHETIC_SIGNING_SECRET,
    WHITEPAPER_CHECK_IDENTIFIER,
    timestamp,
    nonce,
    normalized,
  );

  const headers = new Headers({
    'content-type': 'application/json',
    accept: 'application/json',
    'cf-connecting-ip': SYNTHETIC_IP,
    'user-agent': SYNTHETIC_USER_AGENT,
    [SYNTHETIC_SIGNATURE_HEADER]: signature,
    [SYNTHETIC_TIMESTAMP_HEADER]: timestamp,
    [SYNTHETIC_NONCE_HEADER]: nonce,
    [SYNTHETIC_CHECK_HEADER]: WHITEPAPER_CHECK_IDENTIFIER,
    [SYNTHETIC_RUN_ID_HEADER]: runId,
  });

  const startedAt = Date.now();
  const response = await fetcher(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const latencyMs = Date.now() - startedAt;

  let body: unknown;
  try {
    body = await response.clone().json();
  } catch {
    body = undefined;
  }

  const auditId =
    body &&
    typeof body === 'object' &&
    typeof (body as { requestId?: unknown }).requestId === 'string'
      ? (body as { requestId: string }).requestId
      : undefined;

  let status: SyntheticStatus = 'healthy';
  let failureReason: string | undefined;

  if (!response.ok || !auditId) {
    status = 'failed';
    const baseReason = `Whitepaper delivery responded with status ${response.status}`;
    failureReason = auditId ? baseReason : `${baseReason} (missing requestId)`;
  } else if (latencyMs > latencyBudgetMs) {
    status = 'degraded';
    failureReason = `Whitepaper delivery latency ${latencyMs}ms breached budget ${latencyBudgetMs}ms.`;
  }

  return {
    check: WHITEPAPER_CHECK_IDENTIFIER,
    status,
    latencyMs,
    responseStatus: response.status,
    auditId,
    failureReason,
    endpoint,
  };
}

async function triggerRegressionWebhook(
  env: SyntheticHealthEnv,
  summary: SyntheticRunSummary,
  fetcher: typeof fetch,
  logger: Pick<typeof console, 'info' | 'error' | 'warn'>,
): Promise<void> {
  if (!env.SYNTHETIC_ALERT_WEBHOOK) {
    return;
  }

  try {
    await fetcher(env.SYNTHETIC_ALERT_WEBHOOK, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        runId: summary.runId,
        status: summary.status,
        checks: summary.checks,
        triggeredAt: new Date().toISOString(),
      }),
    });
    logger.info('[synthetic-health] webhook_dispatched', {
      runId: summary.runId,
      status: summary.status,
    });
  } catch (error) {
    logger.error('[synthetic-health] webhook_failed', error);
  }
}

async function runSyntheticHealth(
  env: SyntheticHealthEnv,
  options: SyntheticExecutionOptions = {},
): Promise<SyntheticRunSummary> {
  const fetcher = options.fetchImplementation ?? fetch;
  const logger = options.logger ?? console;
  const dryRun = options.dryRun === true;

  if (!env.SYNTHETIC_SIGNING_SECRET || env.SYNTHETIC_SIGNING_SECRET.length < 32) {
    throw new Error('SYNTHETIC_SIGNING_SECRET must be configured with a strong HMAC key.');
  }

  const runId = crypto.randomUUID();
  const latencyBudgetMs = resolveLatencyBudget(env);

  const contactResult = await executeContactCheck(env, runId, latencyBudgetMs, fetcher);
  const whitepaperResult = await executeWhitepaperCheck(env, runId, latencyBudgetMs, fetcher);

  const checks = [contactResult, whitepaperResult];
  const status = evaluateOverallStatus(checks);

  if (!dryRun) {
    for (const result of checks) {
      await persistResult(env, runId, result);
    }
  }

  logger.info('[synthetic-health] run_complete', {
    runId,
    status,
    dryRun,
    checks,
  });

  const summary: SyntheticRunSummary = {
    runId,
    status,
    checks,
    dryRun,
  };

  if (!dryRun && status !== 'healthy') {
    await triggerRegressionWebhook(env, summary, fetcher, logger);
  }

  if (status !== 'healthy') {
    throw new Error(`Synthetic health run ${runId} detected ${status} state.`);
  }

  return summary;
}

async function handleStatusRequest(env: SyntheticHealthEnv): Promise<Response> {
  const { results } = await env.SYNTHETIC_HEALTH_DB.prepare(
    `SELECT run_id, check_name, status, latency_ms, response_status, audit_id, failure_reason, request_url, created_at
       FROM synthetic_health_runs
       ORDER BY created_at DESC
       LIMIT 50`,
  ).all<{
    run_id: string;
    check_name: string;
    status: SyntheticStatus;
    latency_ms: number;
    response_status: number;
    audit_id?: string | null;
    failure_reason?: string | null;
    request_url: string;
    created_at: string;
  }>();

  if (!results || results.length === 0) {
    return new Response(
      JSON.stringify({ status: 'unknown', generatedAt: new Date().toISOString(), checks: [] }),
      {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'cache-control': 'no-store',
          'access-control-allow-origin': '*',
        },
      },
    );
  }

  const latestRunId = results[0]?.run_id;
  const latestChecks = results.filter((row) => row.run_id === latestRunId);
  const checks = latestChecks.map((row) => ({
    check: row.check_name,
    status: row.status,
    latencyMs: row.latency_ms,
    responseStatus: row.response_status,
    auditId: row.audit_id ?? undefined,
    failureReason: row.failure_reason ?? undefined,
    endpoint: row.request_url,
  }));
  const status = evaluateOverallStatus(checks);
  const generatedAt = latestChecks[0]?.created_at ?? new Date().toISOString();

  return new Response(
    JSON.stringify({
      status,
      runId: latestRunId,
      generatedAt,
      checks,
    }),
    {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'no-store',
        'access-control-allow-origin': '*',
      },
    },
  );
}

const syntheticHealthWorker = {
  async fetch(request: Request, env: SyntheticHealthEnv): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET,OPTIONS',
          'access-control-allow-headers': 'content-type',
        },
      });
    }

    if (request.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
        status: 405,
        headers: {
          'content-type': 'application/json',
          'access-control-allow-origin': '*',
        },
      });
    }

    try {
      return await handleStatusRequest(env);
    } catch (error) {
      console.error('[synthetic-health] status_endpoint_error', error);
      return new Response(JSON.stringify({ error: 'Unable to load synthetic status.' }), {
        status: 500,
        headers: {
          'content-type': 'application/json',
          'cache-control': 'no-store',
          'access-control-allow-origin': '*',
        },
      });
    }
  },
  scheduled(event: ScheduledEvent, env: SyntheticHealthEnv, ctx: ExecutionContext): void {
    void event;
    ctx.waitUntil(
      runSyntheticHealth(env, { logger: console }).catch((error) => {
        console.error('[synthetic-health] scheduled_run_failed', error);
      }),
    );
  },
};

export default syntheticHealthWorker;
export { MemoryD1Database, runSyntheticHealth };
