type PersistedReportStore = {
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
};

interface WorkerExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

type NormalizedReport = {
  blockedUri: string | null;
  documentUri: string | null;
  effectiveDirective: string | null;
  violatedDirective: string | null;
  originalPolicy: string | null;
  referrer: string | null;
  disposition: string | null;
  lineNumber: number | null;
  columnNumber: number | null;
  sourceFile: string | null;
  statusCode: number | null;
  userAgent: string | null;
  sample: string | null;
};

const RUNBOOK_REFERENCE = 'docs/security/RUNBOOK_CSP_Triage.md';

const DEFAULT_ALLOWED_HOSTS = ['self', 'about:blank', 'https://apotheon.ai'];

export interface Env {
  /**
   * Durable store for CSP batches. In production back this with KV, D1, Queues,
   * or another append-only sink that supports incident forensics.
   */
  REPORTS?: PersistedReportStore;
  /**
   * Webhook destination for high-severity alerts. The payload references the
   * runbook and persisted storage key so on-call can drill in quickly.
   */
  CSP_ALERT_WEBHOOK?: string;
  /**
   * Friendly environment label (production, staging, etc.) propagated into
   * alert payloads and persisted batches for correlation.
   */
  CSP_ENVIRONMENT?: string;
  /**
   * Optional TTL override (seconds) for KV persistence. Defaults to 30 days.
   */
  CSP_BATCH_TTL_SECONDS?: string;
  /**
   * Comma-delimited list of allowed blocked-uri hosts. Accepts wildcards
   * prefixed with `*.` and absolute URLs or bare hosts.
   */
  CSP_ALLOWED_HOSTS?: string;
}

function safeNumber(input: unknown): number | null {
  const parsed = Number(input);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseAllowedHosts(raw: string | undefined): { exact: Set<string>; suffixes: string[] } {
  const entries = raw ? raw.split(',') : [];
  const exact = new Set<string>();
  const suffixes: string[] = [];

  const canonicalEntries = [...DEFAULT_ALLOWED_HOSTS, ...entries];
  for (const entry of canonicalEntries) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    if (trimmed === 'self') {
      exact.add('self');
      continue;
    }
    if (trimmed.startsWith('*.')) {
      suffixes.push(trimmed.slice(1).toLowerCase());
      continue;
    }
    try {
      const url = new URL(trimmed);
      exact.add(url.host.toLowerCase());
      continue;
    } catch {
      // Fall through for bare hosts or keywords like about:blank.
    }
    exact.add(trimmed.toLowerCase());
  }

  return { exact, suffixes };
}

function extractHost(uri: string | null): string | null {
  if (!uri) return null;
  const normalized = uri.replace(/"/g, '').trim();
  if (!normalized) return null;
  if (normalized === 'self' || normalized === "'self'") return 'self';
  if (normalized === 'about:blank') return 'about:blank';
  if (normalized.startsWith('data:')) return 'data:';
  if (normalized.startsWith('inline')) return 'inline';

  try {
    const url = new URL(normalized);
    return url.host.toLowerCase();
  } catch {
    return normalized.toLowerCase();
  }
}

function isAllowedHost(
  host: string | null,
  allowList: { exact: Set<string>; suffixes: string[] },
): boolean {
  if (!host) return false;
  if (allowList.exact.has(host)) return true;
  if (host === 'data:' || host === 'inline') return false;
  for (const suffix of allowList.suffixes) {
    if (host.endsWith(suffix)) {
      return true;
    }
  }
  return false;
}

function normalizeReportBody(
  report: Record<string, unknown>,
  userAgent: string | null,
): NormalizedReport {
  const blockedUri =
    (report.blockedURI as string | undefined) ??
    (report['blocked-uri'] as string | undefined) ??
    null;
  const documentUri =
    (report.documentURI as string | undefined) ??
    (report['document-uri'] as string | undefined) ??
    null;
  const effectiveDirective =
    (report.effectiveDirective as string | undefined) ??
    (report['effective-directive'] as string | undefined) ??
    null;
  const violatedDirective =
    (report.violatedDirective as string | undefined) ??
    (report['violated-directive'] as string | undefined) ??
    null;
  const originalPolicy =
    (report.originalPolicy as string | undefined) ??
    (report['original-policy'] as string | undefined) ??
    null;
  const referrer = (report.referrer as string | undefined) ?? null;
  const disposition = (report.disposition as string | undefined) ?? null;
  const lineNumber = safeNumber(report.lineNumber ?? report['line-number']);
  const columnNumber = safeNumber(report.columnNumber ?? report['column-number']);
  const sourceFile =
    (report.sourceFile as string | undefined) ??
    (report['source-file'] as string | undefined) ??
    null;
  const statusCode = safeNumber(report.statusCode ?? report['status-code']);
  const sample =
    (report.sample as string | undefined) ??
    (report['script-sample'] as string | undefined) ??
    (report['sample'] as string | undefined) ??
    null;

  return {
    blockedUri,
    documentUri,
    effectiveDirective,
    violatedDirective,
    originalPolicy,
    referrer,
    disposition,
    lineNumber,
    columnNumber,
    sourceFile,
    statusCode,
    userAgent,
    sample,
  };
}

function normalizePayload(payload: unknown): NormalizedReport[] {
  if (!payload || typeof payload !== 'object') return [];

  // Reporting API batches: { reports: [{ body: {...}, user_agent, type, url }] }
  if (Array.isArray((payload as { reports?: unknown }).reports)) {
    const reports = (payload as { reports: Array<Record<string, unknown>> }).reports;
    return reports.flatMap((entry) => {
      const body = entry.body;
      if (!body || typeof body !== 'object') return [];
      return [
        normalizeReportBody(body as Record<string, unknown>, (entry.user_agent as string) ?? null),
      ];
    });
  }

  // Legacy structure: { "csp-report": {...} }
  if ('csp-report' in (payload as Record<string, unknown>)) {
    const report = (payload as Record<string, unknown>)['csp-report'];
    if (report && typeof report === 'object') {
      return [normalizeReportBody(report as Record<string, unknown>, null)];
    }
  }

  // Some browsers send { body: {...} }
  if ('body' in (payload as Record<string, unknown>)) {
    const body = (payload as Record<string, unknown>).body;
    if (body && typeof body === 'object') {
      return [normalizeReportBody(body as Record<string, unknown>, null)];
    }
  }

  return [];
}

function summarizeReports(reports: NormalizedReport[], request: Request, env: Env) {
  const directiveCounts = new Map<string, number>();
  const blockedHosts = new Map<string, number>();

  for (const report of reports) {
    const directive = (
      report.effectiveDirective ??
      report.violatedDirective ??
      'unknown'
    ).toLowerCase();
    directiveCounts.set(directive, (directiveCounts.get(directive) ?? 0) + 1);

    const host = extractHost(report.blockedUri);
    if (host) {
      blockedHosts.set(host, (blockedHosts.get(host) ?? 0) + 1);
    }
  }

  const allowList = parseAllowedHosts(env.CSP_ALLOWED_HOSTS);
  const shouldEscalate = reports.some((report) => {
    const directive = (report.effectiveDirective ?? report.violatedDirective ?? '').toLowerCase();
    const host = extractHost(report.blockedUri);
    if (!directive && !host) return false;
    if (directive.startsWith('script-src')) return true;
    if (host === 'data:' || host === 'inline') return true;
    if (!host) return false;
    return !isAllowedHost(host, allowList);
  });

  const summary = {
    runbook: RUNBOOK_REFERENCE,
    environment: env.CSP_ENVIRONMENT ?? 'production',
    receivedAt: new Date().toISOString(),
    totalReports: reports.length,
    directiveBreakdown: Object.fromEntries(directiveCounts),
    blockedHosts: Object.fromEntries(blockedHosts),
    requestMeta: {
      ip: request.headers.get('cf-connecting-ip') ?? null,
      rayId: request.headers.get('cf-ray') ?? null,
      userAgent: request.headers.get('user-agent') ?? null,
    },
    severity: shouldEscalate ? 'high' : 'informational',
  };

  return { summary, shouldEscalate };
}

async function persistBatch(
  store: PersistedReportStore,
  key: string,
  payload: {
    summary: ReturnType<typeof summarizeReports>['summary'];
    reports: NormalizedReport[];
    raw: unknown;
  },
  ttlSeconds: number,
) {
  await store.put(key, JSON.stringify(payload), { expirationTtl: ttlSeconds });
}

async function dispatchAlert(webhook: string, body: unknown) {
  try {
    const response = await fetch(webhook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error('CSP alert webhook rejected payload', {
        status: response.status,
        body: await response.text().catch(() => 'unavailable'),
      });
    }
  } catch (error) {
    console.error('Failed to dispatch CSP alert', error);
  }
}

/**
 * Cloudflare Worker stub that accepts CSP violation reports, aggregates them, and
 * links storage + alerting back to the documented runbook.
 */
export default {
  async fetch(request: Request, env: Env, ctx: WorkerExecutionContext): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return new Response('Invalid report payload', { status: 400 });
    }

    const normalizedReports = normalizePayload(payload);
    if (normalizedReports.length === 0) {
      console.warn('Received CSP payload without report bodies', { payload });
      return new Response(null, { status: 202 });
    }

    const { summary, shouldEscalate } = summarizeReports(normalizedReports, request, env);
    const storageKey = `csp:violation:${Date.now()}:${crypto.randomUUID()}`;
    const ttlSeconds = env.CSP_BATCH_TTL_SECONDS
      ? Number(env.CSP_BATCH_TTL_SECONDS)
      : 60 * 60 * 24 * 30;

    console.log('Persisting CSP violation batch', { storageKey, summary });

    if (env.REPORTS) {
      ctx.waitUntil(
        persistBatch(
          env.REPORTS,
          storageKey,
          { summary, reports: normalizedReports, raw: payload },
          ttlSeconds,
        ).catch((error) => {
          console.error('Failed to persist CSP violation batch', error);
        }),
      );
    }

    if (shouldEscalate && env.CSP_ALERT_WEBHOOK) {
      ctx.waitUntil(
        dispatchAlert(env.CSP_ALERT_WEBHOOK, {
          ...summary,
          storageKey,
          runbook: RUNBOOK_REFERENCE,
        }),
      );
    }

    return new Response(null, { status: 204 });
  },
};
