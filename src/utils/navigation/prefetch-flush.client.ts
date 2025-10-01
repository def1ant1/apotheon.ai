import { prefetchTelemetry } from './prefetch-telemetry';
import type { ConsentApi, ConsentState } from '../analytics';

/**
 * Prefetch analytics flush orchestrator (client-only)
 * --------------------------------------------------
 *
 * This module centralises when `prefetchTelemetry.submitPending()` can run. The
 * performance runbook (`docs/dev/PERFORMANCE.md`) explicitly calls out that
 * speculative navigation metrics must stay consent-gated; forgetting to wire a
 * caller leaves dashboards dark and erodes the warm-navigation SLAs monitored
 * by Grafana/Looker. Rather than depending on every surface to remember the
 * integration, we expose a singleton orchestrator that:
 *
 * - Waits for the Klaro-backed consent service to report `umami-telemetry`
 *   approval before attempting to flush aggregates. The consent state is read
 *   via `window.__APOTHEON_CONSENT__` and the `apotheon:consent:updated`
 *   broadcast fired by the consent manager.
 * - Falls back gracefully when SSR renders the file or when localStorage /
 *   sessionStorage are unavailable (private browsing, enterprise lockdown
 *   policies, etc.). The telemetry controller already no-ops in those cases but
 *   we short-circuit earlier so no dangling timers remain.
 * - Flushes on an adaptive cadence: immediately after consent is granted,
 *   whenever the page is backgrounded (`visibilitychange` → hidden), and on a
 *   steady interval so long-lived tabs still upload batches without requiring a
 *   navigation.
 *
 * Mounting happens via a zero-UI island in both the site header and footer so
 * every layout inherits the automation without bespoke wiring. Multiple mounts
 * share a single runtime—mirroring `PrefetchController`—which keeps the
 * interval/listener footprint predictable across portals and onboarding flows.
 */

const RUNBOOK_REFERENCE = 'docs/dev/PERFORMANCE.md#telemetry-aggregation-and-monitoring';
const CONSENT_SERVICE = 'umami-telemetry' as const;
const FLUSH_INTERVAL_MS = 60_000;

interface FlushRuntime {
  mountCount: number;
  teardown: (() => void) | null;
}

let runtime: FlushRuntime | null = null;

/**
 * Public entrypoint invoked by the island. The function reference-counts the
 * singleton runtime so multiple mounts across the document reuse the same
 * timers and consent listeners.
 */
export function mountPrefetchFlushOrchestrator(): () => void {
  if (!runtime) {
    runtime = {
      mountCount: 0,
      teardown: null,
    };
  }

  runtime.mountCount += 1;

  if (runtime.mountCount === 1) {
    runtime.teardown = bootstrapOrchestrator();
  }

  return () => {
    if (!runtime) {
      return;
    }

    runtime.mountCount = Math.max(0, runtime.mountCount - 1);
    if (runtime.mountCount === 0) {
      runtime.teardown?.();
      runtime.teardown = null;
      runtime = null;
    }
  };
}

function bootstrapOrchestrator(): (() => void) | null {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return null;
  }

  if (!isStorageOperational('localStorage') || !isStorageOperational('sessionStorage')) {
    return null;
  }

  let consentGranted = resolveInitialConsent();
  let disposed = false;

  const flush = (reason: string) => {
    if (disposed || !consentGranted) {
      return;
    }
    if (typeof console !== 'undefined' && typeof console.debug === 'function') {
      console.debug('[prefetch-flush] evaluating flush trigger', { reason });
    }
    try {
      void prefetchTelemetry.submitPending().catch((error) => {
        console.warn(
          '[prefetch-flush] submitPending rejected',
          error,
          `(see ${RUNBOOK_REFERENCE} for remediation steps)`,
        );
      });
    } catch (error) {
      console.warn(
        '[prefetch-flush] submitPending threw synchronously',
        error,
        `(see ${RUNBOOK_REFERENCE} for remediation steps)`,
      );
    }
  };

  if (consentGranted) {
    flush('initial-consent');
  }

  const intervalId = window.setInterval(() => flush('interval'), FLUSH_INTERVAL_MS);

  const visibilityHandler = () => {
    if (document.visibilityState === 'hidden') {
      flush('visibility-hidden');
    }
  };
  document.addEventListener('visibilitychange', visibilityHandler);

  const consentApi = resolveConsentApi();
  const consentHandler = (state: ConsentState | undefined) => {
    const granted = Boolean(state?.[CONSENT_SERVICE]);
    const changed = granted !== consentGranted;
    consentGranted = granted;
    if (granted && changed) {
      flush('consent-granted');
    }
  };

  let unsubscribe: (() => void) | undefined;
  if (consentApi) {
    try {
      consentHandler(consentApi.get());
      if (typeof consentApi.subscribe === 'function') {
        unsubscribe = consentApi.subscribe(consentHandler);
      }
    } catch (error) {
      console.warn('[prefetch-flush] unable to read consent API state', error);
    }
  }

  const eventHandler = (event: Event) => {
    const detail = (event as CustomEvent<ConsentState | undefined>).detail;
    if (detail) {
      consentHandler(detail);
    }
  };
  window.addEventListener('apotheon:consent:updated', eventHandler as EventListener);

  return () => {
    disposed = true;
    window.clearInterval(intervalId);
    document.removeEventListener('visibilitychange', visibilityHandler);
    window.removeEventListener('apotheon:consent:updated', eventHandler as EventListener);
    try {
      unsubscribe?.();
    } catch (error) {
      console.warn('[prefetch-flush] consent unsubscribe failed', error);
    }
  };
}

function resolveConsentApi(): ConsentApi | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.__APOTHEON_CONSENT__;
}

function resolveInitialConsent(): boolean {
  try {
    const api = resolveConsentApi();
    return Boolean(api?.isGranted(CONSENT_SERVICE));
  } catch (error) {
    console.warn('[prefetch-flush] failed to determine consent state', error);
    return false;
  }
}

function isStorageOperational(kind: 'localStorage' | 'sessionStorage'): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    const storage = kind === 'localStorage' ? window.localStorage : window.sessionStorage;
    if (!storage) {
      return false;
    }
    const probeKey = `__apotheon_prefetch_probe_${kind}`;
    storage.setItem(probeKey, '1');
    storage.removeItem(probeKey);
    return true;
  } catch (error) {
    console.warn('[prefetch-flush] storage unavailable', kind, error);
    return false;
  }
}
