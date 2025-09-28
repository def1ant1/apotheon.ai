/**
 * Analytics helper
 * ----------------
 *
 * Centralizes how frontend islands talk to the analytics proxy Worker. The
 * helper wraps consent checks, session handling, and beacon delivery so the rest
 * of the application only needs to pass an event name and payload. Every public
 * method is thoroughly commented because compliance reviewers routinely audit
 * this file when new telemetry ships.
 */
export type AnalyticsEvent =
  | 'lead_investor'
  | 'lead_demo'
  | 'whitepaper_download'
  | 'blog_read'
  | 'search_query'
  | 'docs_exit'
  | 'role_experience_impression';

interface TrackOptions {
  event: AnalyticsEvent;
  payload?: Record<string, unknown>;
  consentService?: 'umami-telemetry' | 'pipeline-alerts';
  transport?: 'fetch' | 'beacon';
  onOptOut?: () => void;
}

interface TrackResult {
  delivered: boolean;
  reason?: string;
  requestId?: string;
}

const SESSION_STORAGE_KEY = 'apotheon_analytics_session';
const ENV_ENDPOINT: string | undefined =
  typeof import.meta !== 'undefined'
    ? (import.meta.env as Record<string, string | undefined>).PUBLIC_ANALYTICS_PROXY_ENDPOINT
    : undefined;
const DEFAULT_ENDPOINT: string = ENV_ENDPOINT ?? 'https://collect.apotheon.ai/beacon';

export type ConsentApi = {
  get: () => ConsentState;
  isGranted: (service: string) => boolean;
  subscribe: (listener: (state: ConsentState) => void) => () => void;
  update: (next: ConsentState) => void;
};

export type PlausibleClient = ((
  eventName: string,
  options?: { props?: Record<string, unknown> },
) => unknown) & {
  q?: Array<readonly [string, Record<string, unknown> | undefined]>;
};

export type ConsentState = Record<string, boolean>;

declare global {
  interface Window {
    __APOTHEON_CONSENT__?: ConsentApi;
    plausible?: PlausibleClient;
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function getConsentApi(): ConsentApi | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.__APOTHEON_CONSENT__;
}

function hasConsent(service: NonNullable<TrackOptions['consentService']>): boolean {
  const api = getConsentApi();
  if (!api) {
    // When the consent manager has not mounted yet we default to the configuration defaults.
    return getDefaultConsent(service);
  }
  return api.isGranted(service);
}

function getDefaultConsent(service: string): boolean {
  if (typeof window === 'undefined') return false;
  const consent: ConsentApi | undefined = getConsentApi();
  if (consent) {
    const defaults = consent.get();
    if (service in defaults) {
      return Boolean(defaults[service]);
    }
  }
  switch (service) {
    case 'pipeline-alerts':
      return false;
    case 'umami-telemetry':
      return false;
    default:
      return false;
  }
}

function ensureSessionId(): string {
  if (typeof window === 'undefined') return 'server-render';
  const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (existing) return existing;
  const created = crypto.randomUUID();
  window.localStorage.setItem(SESSION_STORAGE_KEY, created);
  return created;
}

function buildBeaconPayload(options: TrackOptions, sessionId: string) {
  return {
    event: options.event,
    sessionId,
    occurredAt: new Date().toISOString(),
    payload: {
      ...options.payload,
    },
    meta: {
      href: typeof window !== 'undefined' ? window.location.href : undefined,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    },
  };
}

async function deliverWithFetch(body: string): Promise<Response> {
  return fetch(DEFAULT_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body,
    credentials: 'omit',
    keepalive: true,
  });
}

function deliverWithBeacon(body: string): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') {
    return false;
  }
  try {
    return navigator.sendBeacon(DEFAULT_ENDPOINT, body);
  } catch (error) {
    console.warn('[analytics-helper] sendBeacon failed, falling back to fetch', error);
    return false;
  }
}

function shouldRespectDnt(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    navigator.doNotTrack === '1' ||
    (navigator as unknown as { msDoNotTrack?: string }).msDoNotTrack === '1'
  );
}

export async function trackAnalyticsEvent(options: TrackOptions): Promise<TrackResult> {
  const consentService = options.consentService ?? inferConsentService(options.event);

  if (shouldRespectDnt()) {
    options.onOptOut?.();
    return { delivered: false, reason: 'do-not-track' };
  }

  if (consentService && !hasConsent(consentService)) {
    options.onOptOut?.();
    return { delivered: false, reason: 'consent-denied' };
  }

  const sessionId = ensureSessionId();
  const payload = buildBeaconPayload(options, sessionId);
  const body = JSON.stringify(payload);

  const useBeacon = options.transport === 'beacon' || options.transport === undefined;
  let delivered = false;
  if (useBeacon) {
    delivered = deliverWithBeacon(body);
  }

  let response: Response | null = null;
  if (!delivered) {
    response = await deliverWithFetch(body);
    delivered = response.ok;
  }

  if (delivered) {
    fanoutWebAnalytics(options, consentService, sessionId);
  }

  return {
    delivered,
    reason: delivered ? undefined : response ? `status-${response.status}` : 'beacon-failed',
    requestId: sessionId,
  };
}

function fanoutWebAnalytics(
  options: TrackOptions,
  consentService: TrackOptions['consentService'],
  sessionId: string,
): void {
  if (typeof window === 'undefined') return;
  if (consentService && !hasConsent(consentService)) return;

  const plausible = typeof window.plausible === 'function' ? window.plausible : undefined;
  const gtag = resolveGtag();

  switch (options.event) {
    case 'search_query': {
      const payload = options.payload ?? {};
      const query = payload['query'];
      const status = payload['status'];
      const resultCount = payload['resultCount'];
      const props = {
        query,
        status,
        resultCount,
      };
      plausible?.('pagefind_search', { props });
      gtag?.('event', 'pagefind_search', {
        search_term: query,
        search_status: status,
        search_results: resultCount,
        session_id: sessionId,
      });
      break;
    }
    case 'docs_exit': {
      const payload = options.payload ?? {};
      const slug = payload['slug'];
      const exitPath = payload['exitPath'];
      const timeOnPageMs = payload['timeOnPageMs'];
      const scrollDepth = payload['scrollDepth'];
      const props = {
        slug,
        exitPath,
        timeOnPageMs,
        scrollDepth,
      };
      plausible?.('docs_exit', { props });
      gtag?.('event', 'docs_exit', {
        page_path: slug,
        exit_path: exitPath,
        time_on_page: timeOnPageMs,
        scroll_depth: scrollDepth,
        session_id: sessionId,
      });
      break;
    }
    default:
      break;
  }
}

function resolveGtag(): ((...args: unknown[]) => void) | undefined {
  if (typeof window === 'undefined') return undefined;
  if (typeof window.gtag === 'function') {
    return window.gtag;
  }
  if (Array.isArray(window.dataLayer)) {
    return (...args: unknown[]) => {
      window.dataLayer?.push(args);
    };
  }
  return undefined;
}

function inferConsentService(event: AnalyticsEvent): TrackOptions['consentService'] {
  switch (event) {
    case 'blog_read':
      return 'umami-telemetry';
    case 'search_query':
    case 'docs_exit':
      return 'umami-telemetry';
    case 'lead_demo':
    case 'lead_investor':
    case 'whitepaper_download':
    case 'role_experience_impression':
      return 'pipeline-alerts';
    default:
      return 'umami-telemetry';
  }
}
