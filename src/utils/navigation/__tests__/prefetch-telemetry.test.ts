import { describe, expect, it, vi } from 'vitest';

import {
  PrefetchNavigationTelemetry,
  __internal,
  type PrefetchTelemetryController,
  type StorageLike,
} from '../prefetch-telemetry';

class MemoryStorage implements StorageLike {
  private readonly store = new Map<string, string>();

  getItem(key: string): string | null {
    const value = this.store.get(key);
    return typeof value === 'string' ? value : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }
}

describe('prefetch telemetry controller', () => {
  const origin = 'https://apotheon.ai';

  function createController(
    nowRef: { value: number } = { value: Date.now() },
  ): PrefetchTelemetryController {
    const local = new MemoryStorage();
    const session = new MemoryStorage();
    const now = () => nowRef.value;
    return new PrefetchNavigationTelemetry({
      localStorage: local,
      sessionStorage: session,
      now,
      origin,
      setupObserver: false,
    });
  }

  it('records prefetched navigations into histogram buckets', () => {
    const nowRef = { value: Date.now() };
    const telemetry = createController(nowRef);

    telemetry.markPrefetched(`${origin}/docs/intro?utm=campaign`);
    telemetry.recordNavigationTiming(
      {
        name: `${origin}/docs/intro`,
        startTime: 0,
        responseStart: 150,
        type: 'navigate',
      },
      {},
    );

    const aggregates = telemetry.getAggregates();
    expect(aggregates).toHaveLength(1);
    expect(aggregates[0]?.route).toBe('/docs/intro');
    expect(aggregates[0]?.prefetched.visits).toBe(1);
    expect(aggregates[0]?.prefetched.buckets['100-200ms']).toBe(1);
  });

  it('anonymises sensitive route segments before persisting', () => {
    const telemetry = createController();

    telemetry.recordNavigationTiming(
      {
        name: `${origin}/customers/9876543210/orders/abcdef0123456789`,
        startTime: 0,
        responseStart: 220,
        type: 'navigate',
      },
      { prefetched: false },
    );

    const aggregates = telemetry.getAggregates();
    expect(aggregates[0]?.route).toBe('/customers/:int/orders/:hash');
    expect(aggregates[0]?.nonPrefetched.visits).toBe(1);
  });

  it('expires prefetched hints after the TTL window', () => {
    const nowRef = { value: Date.now() };
    const telemetry = createController(nowRef);

    telemetry.markPrefetched(`${origin}/docs/patterns`);
    nowRef.value += 30 * 60 * 1000; // advance well beyond the 15 minute TTL
    telemetry.recordNavigationTiming(
      {
        name: `${origin}/docs/patterns`,
        startTime: 0,
        responseStart: 340,
        type: 'navigate',
      },
      {},
    );

    const aggregates = telemetry.getAggregates();
    expect(aggregates[0]?.prefetched.visits).toBe(0);
    expect(aggregates[0]?.nonPrefetched.visits).toBe(1);
  });

  it('submits aggregates and clears storage when delivery succeeds', async () => {
    const telemetry = createController();
    telemetry.recordNavigationTiming(
      {
        name: `${origin}/docs/performance`,
        startTime: 0,
        responseStart: 95,
        type: 'navigate',
      },
      { prefetched: false },
    );

    const send = vi
      .fn()
      .mockResolvedValue({ delivered: true, requestId: 'demo', reason: undefined });

    const result = await telemetry.submitPending(
      send as unknown as typeof import('../../analytics').trackAnalyticsEvent,
    );

    expect(send).toHaveBeenCalledTimes(1);
    const call = send.mock.calls[0]?.[0];
    expect(call?.event).toBe('prefetch_navigation_metrics');
    expect(result?.delivered).toBe(true);
    expect(telemetry.hasPendingSamples()).toBe(false);
  });

  it('provides reusable anonymisation helpers for regression testing', () => {
    expect(__internal.anonymisePath('/people/12345/account/ABCDEF0123456789')).toBe(
      '/people/:int/account/:hash',
    );
  });
});
