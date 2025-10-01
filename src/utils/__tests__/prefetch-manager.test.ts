import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../navigation/prefetch-telemetry', () => {
  return {
    prefetchTelemetry: {
      markPrefetched: vi.fn(),
    },
  };
});

const { createPrefetchManager } = await import('../navigation/prefetch-manager');
const { prefetchTelemetry } = await import('../navigation/prefetch-telemetry');

type ViMock = ReturnType<typeof vi.fn>;

interface MockObserver {
  observe: ViMock;
  unobserve: ViMock;
  disconnect: ViMock;
  trigger(entries: IntersectionObserverEntry[]): void;
}

class MockIntersectionObserver implements MockObserver {
  public observe = vi.fn();
  public unobserve = vi.fn();
  public disconnect = vi.fn();

  constructor(private readonly callback: IntersectionObserverCallback) {
    observers.push(this);
  }

  trigger(entries: IntersectionObserverEntry[]): void {
    this.callback(entries, this as unknown as IntersectionObserver);
  }
}

const observers: MockObserver[] = [];

const telemetry = prefetchTelemetry as unknown as { markPrefetched: ViMock };

function createIntersectionEntry(target: HTMLAnchorElement): IntersectionObserverEntry {
  const rect = {
    bottom: 0,
    height: 0,
    left: 0,
    right: 0,
    top: 0,
    width: 0,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } satisfies DOMRectReadOnly;

  return {
    boundingClientRect: rect,
    intersectionRatio: 1,
    intersectionRect: rect,
    isIntersecting: true,
    rootBounds: rect,
    target,
    time: Date.now(),
  };
}

beforeEach(() => {
  observers.length = 0;
  telemetry.markPrefetched.mockClear();

  Object.defineProperty(window, 'IntersectionObserver', {
    configurable: true,
    writable: true,
    value: MockIntersectionObserver as unknown as typeof IntersectionObserver,
  });

  const matchMediaMock = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: matchMediaMock,
  });

  let idleHandle = 0;
  const idleWindow = window as Window & {
    requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
    cancelIdleCallback?: (handle: number) => void;
  };

  idleWindow.requestIdleCallback = vi.fn((callback: IdleRequestCallback) => {
    callback({ didTimeout: false, timeRemaining: () => 50 });
    idleHandle += 1;
    return idleHandle;
  });

  idleWindow.cancelIdleCallback = vi.fn();

  Object.defineProperty(navigator, 'connection', {
    configurable: true,
    writable: true,
    value: undefined,
  });

  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    get: () => true,
  });

  document.body.innerHTML = '';
});

describe('prefetch manager automation contract', () => {
  it('prefetches first-party anchors and records telemetry only after a successful fetch', async () => {
    // Enterprise contract: first-party anchors intersecting the viewport should
    // immediately enqueue prefetch work, resolve through the configured fetch
    // strategy, and only mark telemetry once the speculative navigation
    // succeeds. This mirrors how production surfaces hydrate their navigation
    // cache without double counting failures.
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const manager = createPrefetchManager({
      strategy: 'fetch',
      fetchImplementation: fetchSpy,
      currentOrigin: 'https://apotheon.ai',
      eligibility: { currentOrigin: 'https://apotheon.ai' },
    });

    const anchor = document.createElement('a');
    anchor.href = '/docs/platform';
    document.body.appendChild(anchor);

    manager.registerAnchor(anchor);

    const observer = observers.at(-1) as MockIntersectionObserver | undefined;
    observer?.trigger([createIntersectionEntry(anchor)]);

    await manager.flushQueue();

    expect(fetchSpy).toHaveBeenCalledWith('https://apotheon.ai/docs/platform', {
      credentials: 'same-origin',
      mode: 'same-origin',
    });
    expect(telemetry.markPrefetched).toHaveBeenCalledTimes(1);
    expect(telemetry.markPrefetched).toHaveBeenCalledWith('https://apotheon.ai/docs/platform');
  });

  it('skips external anchors to protect the network from cross-origin speculation', async () => {
    // Defensive posture: external URLs must never be speculatively fetched,
    // regardless of viewport visibility, pointer intent, or any other signal.
    // The manager should refuse to observe the anchor entirely which keeps the
    // queue and telemetry perfectly quiet.
    const fetchSpy = vi.fn();
    const manager = createPrefetchManager({
      strategy: 'fetch',
      fetchImplementation: fetchSpy,
      currentOrigin: 'https://apotheon.ai',
      eligibility: { currentOrigin: 'https://apotheon.ai' },
    });

    const anchor = document.createElement('a');
    anchor.href = 'https://external.invalid/path';
    document.body.appendChild(anchor);

    manager.registerAnchor(anchor);

    const observer = observers.at(-1) as MockIntersectionObserver | undefined;
    expect(observer?.observe).not.toHaveBeenCalled();

    anchor.dispatchEvent(new Event('pointerenter'));
    await manager.flushQueue();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(telemetry.markPrefetched).not.toHaveBeenCalled();
  });

  it('respects custom allow predicate overrides when evaluating anchors', async () => {
    // Automation guardrail: integrators can inject bespoke allow/deny logic via
    // the eligibility contract. Returning false must veto prefetching while a
    // positive signal should allow the standard flow to proceed.
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

    const denyManager = createPrefetchManager({
      strategy: 'fetch',
      fetchImplementation: fetchSpy,
      currentOrigin: 'https://apotheon.ai',
      eligibility: {
        currentOrigin: 'https://apotheon.ai',
        customAllowPredicate: () => false,
      },
    });

    const deniedAnchor = document.createElement('a');
    deniedAnchor.href = '/security';
    document.body.appendChild(deniedAnchor);

    denyManager.registerAnchor(deniedAnchor);
    const denyObserver = observers.at(-1) as MockIntersectionObserver | undefined;
    expect(denyObserver?.observe).not.toHaveBeenCalled();

    const allowManager = createPrefetchManager({
      strategy: 'fetch',
      fetchImplementation: fetchSpy,
      currentOrigin: 'https://apotheon.ai',
      eligibility: {
        currentOrigin: 'https://apotheon.ai',
        customAllowPredicate: () => true,
      },
    });

    const approvedAnchor = document.createElement('a');
    approvedAnchor.href = '/platform/automation';
    document.body.appendChild(approvedAnchor);

    allowManager.registerAnchor(approvedAnchor);
    const allowObserver = observers.at(-1) as MockIntersectionObserver | undefined;
    allowObserver?.trigger([createIntersectionEntry(approvedAnchor)]);

    await allowManager.flushQueue();

    expect(fetchSpy).toHaveBeenCalledWith('https://apotheon.ai/platform/automation', {
      credentials: 'same-origin',
      mode: 'same-origin',
    });
  });

  it('disables pointer driven speculation for reduced-motion audiences', async () => {
    // Accessibility contract: when a user opts into reduced motion the pointer
    // hover listeners should be removed so that intent is respected and the
    // network remains quiet until a more explicit trigger (focus or viewport)
    // occurs.
    vi.useFakeTimers();

    const matchMediaMock = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: matchMediaMock,
    });

    const fetchSpy = vi.fn();
    const manager = createPrefetchManager({
      strategy: 'fetch',
      fetchImplementation: fetchSpy,
      currentOrigin: 'https://apotheon.ai',
      eligibility: { currentOrigin: 'https://apotheon.ai' },
    });

    const anchor = document.createElement('a');
    anchor.href = '/platform/insights';
    document.body.appendChild(anchor);

    manager.registerAnchor(anchor);

    anchor.dispatchEvent(new Event('pointerenter'));
    await vi.runAllTimersAsync();
    await manager.flushQueue();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(telemetry.markPrefetched).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('defers queued work while offline and resumes when connectivity returns', async () => {
    // Resiliency contract: offline sessions may continue interacting with the
    // UI. Prefetch tasks should queue quietly until connectivity is restored
    // and only then should the manager execute the backlog and mark telemetry.
    let online = false;
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => online,
    });

    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const manager = createPrefetchManager({
      strategy: 'fetch',
      fetchImplementation: fetchSpy,
      currentOrigin: 'https://apotheon.ai',
      eligibility: { currentOrigin: 'https://apotheon.ai' },
    });

    const anchor = document.createElement('a');
    anchor.href = '/platform/resilience';
    document.body.appendChild(anchor);

    manager.registerAnchor(anchor);
    const observer = observers.at(-1) as MockIntersectionObserver | undefined;
    observer?.trigger([createIntersectionEntry(anchor)]);

    await manager.flushQueue();
    expect(fetchSpy).not.toHaveBeenCalled();

    online = true;
    window.dispatchEvent(new Event('online'));
    await manager.flushQueue();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(telemetry.markPrefetched).toHaveBeenCalledWith(
      'https://apotheon.ai/platform/resilience',
    );
  });

  it('ignores telemetry when the prefetch request fails', async () => {
    // Observability contract: downstream analytics should never record failed
    // prefetch attempts. The manager swallows network errors but it must avoid
    // incrementing the telemetry counters for those failures.
    const fetchSpy = vi.fn().mockRejectedValue(new Error('network-error'));
    const manager = createPrefetchManager({
      strategy: 'fetch',
      fetchImplementation: fetchSpy,
      currentOrigin: 'https://apotheon.ai',
      eligibility: { currentOrigin: 'https://apotheon.ai' },
    });

    const anchor = document.createElement('a');
    anchor.href = '/platform/observability';
    document.body.appendChild(anchor);

    manager.registerAnchor(anchor);
    const observer = observers.at(-1) as MockIntersectionObserver | undefined;
    observer?.trigger([createIntersectionEntry(anchor)]);

    await manager.flushQueue();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(telemetry.markPrefetched).not.toHaveBeenCalled();
  });
});
