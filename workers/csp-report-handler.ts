type PersistedReportStore = {
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
};

interface WorkerExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

export interface Env {
  /**
   * Placeholder binding for durable storage. Swap for R2, KV, Queues, or your
   * preferred logging pipeline when wiring the Worker into production.
   */
  REPORTS?: PersistedReportStore;
}

/**
 * Cloudflare Worker stub that accepts CSP violation reports and fans them out to
 * whatever observability sink the platform standardizes on. Keeping the handler
 * here documents the contract for the nonce-based CSP emitted by the Astro app.
 */
export default {
  async fetch(request: Request, env: Env, ctx: WorkerExecutionContext): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    let report: unknown;

    try {
      report = await request.json();
    } catch {
      return new Response('Invalid report payload', { status: 400 });
    }

    // For now we simply log to the Cloudflare dashboard. Swap this for
    // `env.REPORTS.put(...)`, Queue dispatch, or a third-party SIEM/observability
    // endpoint during infrastructure hardening.
    console.log('CSP violation received', report);

    ctx.waitUntil(
      (async () => {
        if (!env.REPORTS) return;
        try {
          await env.REPORTS.put(crypto.randomUUID(), JSON.stringify(report), {
            expirationTtl: 60 * 60 * 24,
          });
        } catch (unknownError) {
          const message =
            unknownError instanceof Error ? unknownError : new Error('Unknown persistence error');
          console.error('Failed to persist CSP report', message);
        }
      })(),
    );

    return new Response(null, { status: 204 });
  },
};
