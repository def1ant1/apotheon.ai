import { beforeEach, describe, expect, it, vi } from 'vitest';

import { trackAnalyticsEvent } from '../analytics';

declare global {
  interface Navigator {
    msDoNotTrack?: string;
  }
}

let fetchMock: ReturnType<typeof vi.fn>;

describe('analytics helper', () => {
  function allowTelemetryConsent(): void {
    window.__APOTHEON_CONSENT__ = {
      get: () => ({ 'umami-telemetry': true }),
      isGranted: (service: string) => service === 'umami-telemetry',
      subscribe: () => () => undefined,
      update: () => undefined,
    };
  }

  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
    delete window.__APOTHEON_CONSENT__;
    Object.defineProperty(navigator, 'doNotTrack', {
      configurable: true,
      value: undefined,
      writable: true,
    });
    Object.defineProperty(navigator, 'msDoNotTrack', {
      configurable: true,
      value: undefined,
      writable: true,
    });
    Object.defineProperty(navigator, 'sendBeacon', {
      configurable: true,
      value: undefined,
      writable: true,
    });
    fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);
  });

  it('respects the Do-Not-Track header and short-circuits delivery', async () => {
    Object.defineProperty(navigator, 'doNotTrack', { configurable: true, value: '1' });
    const onOptOut = vi.fn();
    const result = await trackAnalyticsEvent({ event: 'blog_read', onOptOut });
    expect(result.delivered).toBe(false);
    expect(result.reason).toBe('do-not-track');
    expect(onOptOut).toHaveBeenCalledTimes(1);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('falls back to fetch when sendBeacon is unavailable', async () => {
    allowTelemetryConsent();
    Object.defineProperty(navigator, 'sendBeacon', {
      configurable: true,
      value: undefined,
      writable: true,
    });
    const response = await trackAnalyticsEvent({ event: 'blog_read' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response.delivered).toBe(true);
  });

  it('prefers sendBeacon when it succeeds', async () => {
    allowTelemetryConsent();
    const sendBeacon = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, 'sendBeacon', {
      configurable: true,
      value: sendBeacon,
      writable: true,
    });
    const response = await trackAnalyticsEvent({ event: 'blog_read' });
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.delivered).toBe(true);
  });

  it('invokes onOptOut when consent is withheld', async () => {
    window.__APOTHEON_CONSENT__ = {
      get: () => ({ 'umami-telemetry': false }),
      isGranted: () => false,
      subscribe: () => () => undefined,
      update: () => undefined,
    };
    const onOptOut = vi.fn();
    const outcome = await trackAnalyticsEvent({
      event: 'blog_read',
      consentService: 'umami-telemetry',
      onOptOut,
    });
    expect(outcome.delivered).toBe(false);
    expect(outcome.reason).toBe('consent-denied');
    expect(onOptOut).toHaveBeenCalledWith();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
