import type { ConsentApi, PlausibleClient } from '../utils/analytics';

/**
 * Consent-aware analytics bootstrapper
 * ------------------------------------
 *
 * This module encapsulates all logic required to lazy-load Plausible (and any
 * adjacent web analytics tooling) only after the user grants consent via the
 * Klaro-backed modal. The script runs inside the browser — Astro injects it
 * globally via `vendor/astrojs-plausible` — so we keep the implementation
 * dependency-free and richly documented for compliance reviewers.
 */
export interface ConsentGateConfig {
  domain: string;
  scriptSrc: string;
  apiHost?: string;
  consentService: string;
}

export type ConsentSnapshot = Record<string, boolean>;

/** Identifier attached to the script tag so tests can locate/remove it easily. */
const SCRIPT_ATTRIBUTE = 'data-apotheon-analytics';
const SCRIPT_VALUE = 'plausible';

/**
 * We store the unsubscribe handler returned by Klaro so we can detach listeners
 * during tests. Production never tears down the consent API, but deterministic
 * cleanup keeps Vitest snapshots predictable.
 */
interface ConsentAwareLoader {
  bootstrap: () => void;
  sync: (state: ConsentSnapshot) => void;
  load: () => void;
  unload: () => void;
  getScript: () => HTMLScriptElement | null;
}

/**
 * Creates a loader instance that knows how to attach/detach the Plausible
 * script element. Exporting this factory lets us unit test the behaviour
 * without executing the global side effects that the integration performs at
 * runtime.
 */
export function createConsentAwarePlausibleLoader(config: ConsentGateConfig): ConsentAwareLoader {
  let script: HTMLScriptElement | null = null;
  let unsubscribe: (() => void) | undefined;

  function ensureStub(): void {
    if (typeof window === 'undefined') return;
    if (typeof window.plausible === 'function') return;

    const queue: Array<readonly [string, Record<string, unknown> | undefined]> = [];
    const stub = (eventName: string, options?: { props?: Record<string, unknown> }) => {
      queue.push([eventName, options?.props]);
      return queue.length;
    };
    (stub as typeof stub & { q: typeof queue }).q = queue;
    window.plausible = stub as unknown as typeof window.plausible;
  }

  function load(): void {
    if (typeof document === 'undefined') return;
    if (script) return;

    const element = document.createElement('script');
    element.setAttribute(SCRIPT_ATTRIBUTE, SCRIPT_VALUE);
    element.setAttribute('data-consent-service', config.consentService);
    element.defer = true;
    element.src = config.scriptSrc;
    element.dataset.domain = config.domain;
    if (config.apiHost) {
      element.dataset.api = config.apiHost;
    }
    document.head.appendChild(element);
    script = element;
    ensureStub();
  }

  function unload(): void {
    if (script) {
      script.remove();
      script = null;
    }
    if (unsubscribe) {
      try {
        unsubscribe();
      } catch (error) {
        console.warn('[consent-aware-analytics] unsubscribe failed', error);
      }
      unsubscribe = undefined;
    }
    if (typeof window !== 'undefined' && typeof window.plausible === 'function') {
      // Only clear the stub we created; production Plausible replaces the stub
      // with its runtime once the script finishes loading.
      const candidate = window.plausible as typeof window.plausible & { q?: unknown };
      if (candidate.q) {
        delete window.plausible;
      }
    }
  }

  function sync(state: ConsentSnapshot): void {
    const granted = Boolean(state?.[config.consentService]);
    if (granted) {
      load();
    } else {
      unload();
    }
  }

  function readInitialState(): ConsentSnapshot {
    if (typeof window === 'undefined') return {};
    try {
      const stored = window.localStorage.getItem('apotheon_privacy_consent');
      if (!stored) return {};
      const parsed = JSON.parse(stored) as ConsentSnapshot;
      return parsed ?? {};
    } catch (error) {
      console.warn('[consent-aware-analytics] unable to parse stored consent', error);
      return {};
    }
  }

  function handleConsentUpdate(event: Event): void {
    const detail = (event as CustomEvent<ConsentSnapshot>).detail;
    if (detail) {
      sync(detail);
    }
  }

  function bootstrap(): void {
    if (typeof window === 'undefined') return;

    const consentApi: ConsentApi | undefined = window.__APOTHEON_CONSENT__;
    if (consentApi) {
      sync(consentApi.get());
      if (typeof consentApi.subscribe === 'function') {
        unsubscribe = consentApi.subscribe(sync);
      }
    } else {
      sync(readInitialState());
    }

    window.addEventListener('apotheon:consent:updated', handleConsentUpdate as EventListener);
  }

  return {
    bootstrap,
    sync,
    load,
    unload,
    getScript: () => script,
  } satisfies ConsentAwareLoader;
}

/**
 * Entry point executed by the Astro integration. The helper instantiates a
 * loader and bootstraps it immediately. Returning the loader simplifies manual
 * QA because engineers can poke at `window.__APOTHEON_ANALYTICS_LOADER__` from
 * DevTools to verify consent toggles in real time.
 */
export function bootstrapConsentAwareAnalytics(
  config: ConsentGateConfig,
): ConsentAwareLoader | void {
  if (typeof window === 'undefined') return undefined;
  const loader = createConsentAwarePlausibleLoader(config);
  loader.bootstrap();
  (
    window as typeof window & { __APOTHEON_ANALYTICS_LOADER__?: ConsentAwareLoader }
  ).__APOTHEON_ANALYTICS_LOADER__ = loader;
  return loader;
}

declare global {
  interface Window {
    plausible?: PlausibleClient;
    __APOTHEON_CONSENT__?: ConsentApi;
    __APOTHEON_ANALYTICS_LOADER__?: ConsentAwareLoader;
  }
}
