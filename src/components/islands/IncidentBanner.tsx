import { type FC, useEffect, useMemo, useState } from 'react';

interface SyntheticCheck {
  check: string;
  status: 'healthy' | 'degraded' | 'failed';
  latencyMs: number;
  responseStatus: number;
  auditId?: string;
  failureReason?: string;
}

interface SyntheticStatusPayload {
  status: 'healthy' | 'degraded' | 'failed' | 'unknown';
  runId?: string;
  generatedAt?: string;
  checks: SyntheticCheck[];
}

const DEFAULT_ENDPOINT = 'https://synthetic.apotheon.ai/status';
const META_NAME = 'apotheon:synthetic-status-endpoint';

function resolveEndpoint(): string {
  if (typeof document !== 'undefined') {
    const meta = document.querySelector(`meta[name="${META_NAME}"]`);
    if (meta && meta instanceof HTMLMetaElement && meta.content) {
      return meta.content;
    }
  }

  if (
    typeof window !== 'undefined' &&
    typeof window.__APOTHEON_SYNTHETIC_STATUS_ENDPOINT__ === 'string'
  ) {
    return window.__APOTHEON_SYNTHETIC_STATUS_ENDPOINT__;
  }

  return DEFAULT_ENDPOINT;
}

function formatLatency(latencyMs: number): string {
  return `${latencyMs}ms`;
}

const IncidentBanner: FC = () => {
  const [ready, setReady] = useState(false);
  const [payload, setPayload] = useState<SyntheticStatusPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setReady(true);
    const controller = new AbortController();
    const endpoint = resolveEndpoint();

    const fetchStatus = async () => {
      try {
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: { accept: 'application/json' },
          cache: 'no-store',
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Synthetic status endpoint returned ${response.status}`);
        }

        const data: SyntheticStatusPayload = await response.json();
        setPayload(data);
        setError(null);
      } catch (fetchError) {
        if (fetchError instanceof DOMException && fetchError.name === 'AbortError') {
          return;
        }
        console.error('[incident-banner] status_fetch_failed', fetchError);
        setError('Synthetic monitors are unreachable.');
      }
    };

    void fetchStatus();

    const interval = window.setInterval(() => {
      void fetchStatus();
    }, 60_000);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, []);

  const incidentChecks: SyntheticCheck[] = useMemo(() => {
    if (!payload) {
      return [];
    }
    return payload.checks.filter(
      (check) => check.status === 'failed' || check.status === 'degraded',
    );
  }, [payload]);

  if (error) {
    return (
      <div
        className="bg-amber-600 px-gutter-inline py-space-xs text-white"
        data-testid="incident-banner"
        data-js-ready={ready}
        data-incident-status="unknown"
        role="alert"
        aria-live="assertive"
      >
        <div className="mx-auto flex max-w-5xl flex-col gap-space-2xs">
          <p className="text-sm font-semibold">Synthetic monitors are unreachable.</p>
          <p className="text-xs text-amber-100">
            The automated health checks failed to return data. Review the synthetic Worker logs and
            verify the D1 replica before proceeding with customer comms.
          </p>
        </div>
      </div>
    );
  }

  if (
    !payload ||
    payload.status === 'healthy' ||
    payload.status === 'unknown' ||
    incidentChecks.length === 0
  ) {
    return (
      <div
        data-testid="incident-banner"
        data-js-ready={ready}
        data-incident-status="healthy"
        hidden
      />
    );
  }

  const severity = incidentChecks.some((check) => check.status === 'failed')
    ? 'failed'
    : 'degraded';
  const bannerClasses =
    severity === 'failed' ? 'bg-rose-700 text-white' : 'bg-amber-600 text-white';

  return (
    <div
      className={`${bannerClasses} px-gutter-inline py-space-xs`}
      data-testid="incident-banner"
      data-js-ready={ready}
      data-incident-status={severity}
      role="alert"
      aria-live="assertive"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-space-2xs">
        <p className="text-sm font-semibold">
          Synthetic monitors flagged {incidentChecks.length}{' '}
          {incidentChecks.length === 1 ? 'regression' : 'regressions'}.
        </p>
        <ul className="list-disc space-y-space-3xs pl-6 text-xs text-white/90">
          {incidentChecks.map((check) => (
            <li key={check.check}>
              <span className="font-semibold uppercase tracking-wide">{check.check}</span> responded
              with status {check.responseStatus} in {formatLatency(check.latencyMs)}.
              {check.failureReason ? ` ${check.failureReason}` : ''}
              {check.auditId ? (
                <span className="ml-1 text-white/80">(Audit ID: {check.auditId})</span>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="text-[11px] uppercase tracking-wide text-white/70">
          Synthetic run {payload.runId ?? 'n/a'} updated {payload.generatedAt ?? 'recently'}.
        </p>
      </div>
    </div>
  );
};

export default IncidentBanner;
