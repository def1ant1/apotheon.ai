import { evaluateAnchorEligibility, type LinkEligibilityOptions } from './link-eligibility';

export type PrefetchStrategy = 'link' | 'fetch';

/**
 * Configuration blueprint that allows teams to fine-tune how aggressively the
 * prefetch manager speculates navigation. Reasonable defaults keep casual usage
 * simple, while the knobs expose enterprise-grade control for performance
 * engineers to dial in per surface.
 */
export interface PrefetchManagerConfig {
  concurrency?: number;
  idleTimeoutMs?: number;
  pointerIntentDelayMs?: number;
  observerRootMargin?: string;
  observerThreshold?: number | number[];
  strategy?: PrefetchStrategy;
  fetchImplementation?: typeof fetch;
  documentHead?: Document['head'] | HTMLElement | null;
  eligibility?: LinkEligibilityOptions;
  respectReducedMotion?: boolean;
  respectSaveData?: boolean;
  currentOrigin?: string;
}

interface PrefetchTask {
  url: string;
  anchor: HTMLAnchorElement;
}

interface AnchorListeners {
  pointerEnter?: (event: PointerEvent) => void;
  pointerLeave?: (event: PointerEvent) => void;
  focus?: (event: FocusEvent) => void;
}

const DEFAULTS: Required<
  Pick<
    PrefetchManagerConfig,
    'concurrency' | 'idleTimeoutMs' | 'pointerIntentDelayMs' | 'observerRootMargin' | 'strategy'
  >
> = {
  concurrency: 4,
  idleTimeoutMs: 150,
  pointerIntentDelayMs: 65,
  observerRootMargin: '200px',
  strategy: 'link',
};

export interface PrefetchManager {
  registerAnchor(anchor: HTMLAnchorElement): void;
  unregisterAnchor(anchor: HTMLAnchorElement): void;
  registerAnchorsWithin(container: ParentNode): void;
  flushQueue(): Promise<void>;
  destroy(): void;
}

/**
 * Factory wrapper that shields downstream callers from the underlying
 * implementation. Returning an interface enables us to swap in a no-op manager
 * for environments like SSR without leaking private implementation details.
 */
export function createPrefetchManager(config: PrefetchManagerConfig = {}): PrefetchManager {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return createNoopManager();
  }

  return new IntersectionObserverPrefetchManager(config);
}

class IntersectionObserverPrefetchManager implements PrefetchManager {
  private readonly config: Required<PrefetchManagerConfig> & PrefetchManagerConfig;
  private readonly queue: PrefetchTask[] = [];
  private readonly inFlight = new Set<string>();
  private readonly completed = new Set<string>();
  private readonly pointerTimers = new WeakMap<HTMLAnchorElement, number>();
  private readonly anchorListeners = new Map<HTMLAnchorElement, AnchorListeners>();
  private observer: IntersectionObserver | null = null;
  private idleHandle: number | null = null;
  private idleCallbackId: number | null = null;
  private processingScheduled = false;
  private readonly onlineHandler = () => this.scheduleProcessing();
  private readonly reduceMotionQuery: MediaQueryList | null;

  constructor(config: PrefetchManagerConfig) {
    this.config = {
      ...config,
      concurrency: config.concurrency ?? DEFAULTS.concurrency,
      idleTimeoutMs: config.idleTimeoutMs ?? DEFAULTS.idleTimeoutMs,
      pointerIntentDelayMs: config.pointerIntentDelayMs ?? DEFAULTS.pointerIntentDelayMs,
      observerRootMargin: config.observerRootMargin ?? DEFAULTS.observerRootMargin,
      strategy: config.strategy ?? DEFAULTS.strategy,
    } as Required<PrefetchManagerConfig> & PrefetchManagerConfig;

    this.reduceMotionQuery =
      this.config.respectReducedMotion !== false && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;

    if ('IntersectionObserver' in window) {
      this.observer = new IntersectionObserver(this.handleIntersections, {
        rootMargin: this.config.observerRootMargin,
        threshold: this.config.observerThreshold,
      });
    }

    window.addEventListener('online', this.onlineHandler);
    this.reduceMotionQuery?.addEventListener('change', this.handleReducedMotionChange);
  }

  registerAnchor = (anchor: HTMLAnchorElement): void => {
    if (this.anchorListeners.has(anchor)) {
      return;
    }

    const eligibility = evaluateAnchorEligibility(anchor, {
      ...this.config.eligibility,
      currentOrigin: this.config.currentOrigin ?? this.config.eligibility?.currentOrigin,
    });

    if (!eligibility.eligible) {
      return;
    }

    this.observer?.observe(anchor);

    const listeners: AnchorListeners = {};
    this.applyPointerListeners(anchor, listeners);

    listeners.focus = () => this.enqueuePrefetch(anchor);
    anchor.addEventListener('focus', listeners.focus, { passive: true, capture: false });

    this.anchorListeners.set(anchor, listeners);
  };

  unregisterAnchor = (anchor: HTMLAnchorElement): void => {
    const listeners = this.anchorListeners.get(anchor);
    if (!listeners) return;

    this.removePointerListeners(anchor, listeners);

    if (listeners.focus) {
      anchor.removeEventListener('focus', listeners.focus);
    }

    this.clearPointerTimer(anchor);
    this.observer?.unobserve(anchor);
    this.anchorListeners.delete(anchor);
  };

  registerAnchorsWithin = (container: ParentNode): void => {
    const anchors = Array.from(container.querySelectorAll<HTMLAnchorElement>('a[href]'));
    anchors.forEach((anchor) => this.registerAnchor(anchor));
  };

  flushQueue = (): Promise<void> => this.drainQueue();

  destroy = (): void => {
    const anchors = Array.from(this.anchorListeners.keys());
    anchors.forEach((anchor) => this.unregisterAnchor(anchor));
    this.observer?.disconnect();
    this.queue.length = 0;
    this.processingScheduled = false;
    this.clearIdleHandles();
    window.removeEventListener('online', this.onlineHandler);
    this.reduceMotionQuery?.removeEventListener('change', this.handleReducedMotionChange);
  };

  private handleIntersections = (entries: IntersectionObserverEntry[]): void => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) {
        return;
      }

      const anchor = entry.target;
      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }

      this.enqueuePrefetch(anchor);
      this.observer?.unobserve(anchor);
    });
  };

  private handlePointerEnter(anchor: HTMLAnchorElement): void {
    this.clearPointerTimer(anchor);
    const delay = this.config.pointerIntentDelayMs;
    const handle = window.setTimeout(() => {
      this.enqueuePrefetch(anchor);
    }, delay);
    this.pointerTimers.set(anchor, handle);
  }

  private handlePointerLeave(anchor: HTMLAnchorElement): void {
    this.clearPointerTimer(anchor);
  }

  private clearPointerTimer(anchor: HTMLAnchorElement): void {
    const handle = this.pointerTimers.get(anchor);
    if (handle) {
      window.clearTimeout(handle);
      this.pointerTimers.delete(anchor);
    }
  }

  private enqueuePrefetch(anchor: HTMLAnchorElement): void {
    const url = this.resolveUrl(anchor);
    if (!url) return;

    if (
      this.completed.has(url) ||
      this.inFlight.has(url) ||
      this.queue.some((task) => task.url === url)
    ) {
      return;
    }

    if (this.respectBandwidthPreferences()) {
      return;
    }

    this.queue.push({ url, anchor });
    this.scheduleProcessing();
  }

  private resolveUrl(anchor: HTMLAnchorElement): string | null {
    const href = anchor.getAttribute('href');
    if (!href) return null;

    try {
      const base = this.config.currentOrigin ?? window.location.origin;
      return new URL(href, base).toString();
    } catch {
      return null;
    }
  }

  private pointerTriggersEnabled(): boolean {
    if (this.config.respectReducedMotion === false) {
      return true;
    }

    if (!this.reduceMotionQuery) {
      return true;
    }

    return !this.reduceMotionQuery.matches;
  }

  private applyPointerListeners(anchor: HTMLAnchorElement, listeners: AnchorListeners): void {
    if (!this.pointerTriggersEnabled()) {
      this.removePointerListeners(anchor, listeners);
      return;
    }

    if (!listeners.pointerEnter) {
      listeners.pointerEnter = () => this.handlePointerEnter(anchor);
      anchor.addEventListener('pointerenter', listeners.pointerEnter, { passive: true });
    }

    if (!listeners.pointerLeave) {
      listeners.pointerLeave = () => this.handlePointerLeave(anchor);
      anchor.addEventListener('pointerleave', listeners.pointerLeave, { passive: true });
    }
  }

  private removePointerListeners(anchor: HTMLAnchorElement, listeners: AnchorListeners): void {
    if (listeners.pointerEnter) {
      anchor.removeEventListener('pointerenter', listeners.pointerEnter);
      listeners.pointerEnter = undefined;
    }
    if (listeners.pointerLeave) {
      anchor.removeEventListener('pointerleave', listeners.pointerLeave);
      listeners.pointerLeave = undefined;
    }
  }

  private respectBandwidthPreferences(): boolean {
    if (typeof navigator === 'undefined') {
      return false;
    }

    if (this.config.respectSaveData !== false) {
      const connection = (
        navigator as Navigator & {
          connection?: { saveData?: boolean; effectiveType?: string };
        }
      ).connection;
      if (connection?.saveData) {
        return true;
      }

      if (connection?.effectiveType && ['slow-2g', '2g'].includes(connection.effectiveType)) {
        return true;
      }
    }

    return false;
  }

  private isOffline(): boolean {
    if (typeof navigator === 'undefined') {
      return false;
    }

    return 'onLine' in navigator && !navigator.onLine;
  }

  private scheduleProcessing(): void {
    if (this.processingScheduled || !this.queue.length) {
      return;
    }

    const idleWindow = window as typeof window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    const run = () => {
      this.processingScheduled = false;
      this.idleHandle = null;
      this.idleCallbackId = null;
      void this.drainQueue();
    };

    this.processingScheduled = true;

    if (typeof idleWindow.requestIdleCallback === 'function') {
      this.idleCallbackId = idleWindow.requestIdleCallback(run, {
        timeout: this.config.idleTimeoutMs,
      });
    } else {
      this.idleHandle = window.setTimeout(run, this.config.idleTimeoutMs);
    }
  }

  private async drainQueue(): Promise<void> {
    if (this.isOffline()) {
      this.processingScheduled = false;
      return;
    }

    while (this.queue.length && this.inFlight.size < this.config.concurrency) {
      const task = this.queue.shift();
      if (!task) break;

      if (this.completed.has(task.url)) {
        continue;
      }

      this.inFlight.add(task.url);
      try {
        await this.executePrefetch(task);
        this.completed.add(task.url);
      } catch {
        // Intentionally swallow the exception to avoid surfacing network noise
        // to the UI thread. Consumers can still instrument `fetchImplementation`
        // for observability if required.
      } finally {
        this.inFlight.delete(task.url);
      }
    }

    this.processingScheduled = false;

    if (this.queue.length) {
      this.scheduleProcessing();
    }
  }

  private async executePrefetch(task: PrefetchTask): Promise<void> {
    if (this.config.strategy === 'fetch') {
      const fetcher = this.config.fetchImplementation ?? fetch;
      await fetcher(task.url, {
        credentials: 'same-origin',
        mode: 'same-origin',
      });
      return;
    }

    const head = this.resolveHead();
    if (!head) {
      return;
    }

    if (head.querySelector(`link[rel="prefetch"][href="${task.url}"]`)) {
      return;
    }

    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = task.url;
    link.as = 'document';
    head.appendChild(link);
  }

  private resolveHead(): HTMLElement | null {
    if (this.config.documentHead) {
      return this.config.documentHead;
    }
    return document.head;
  }

  private handleReducedMotionChange = (): void => {
    const anchors = Array.from(this.anchorListeners.entries());
    anchors.forEach(([anchor, listeners]) => {
      if (this.pointerTriggersEnabled()) {
        this.applyPointerListeners(anchor, listeners);
      } else {
        this.removePointerListeners(anchor, listeners);
      }
    });
  };

  private clearIdleHandles(): void {
    if (this.idleHandle) {
      window.clearTimeout(this.idleHandle);
      this.idleHandle = null;
    }
    if (this.idleCallbackId) {
      const idleWindow = window as typeof window & {
        cancelIdleCallback?: (handle: number) => void;
      };
      idleWindow.cancelIdleCallback?.(this.idleCallbackId);
      this.idleCallbackId = null;
    }
  }
}

function createNoopManager(): PrefetchManager {
  return {
    registerAnchor: () => undefined,
    unregisterAnchor: () => undefined,
    registerAnchorsWithin: () => undefined,
    flushQueue: () => Promise.resolve(),
    destroy: () => undefined,
  };
}
