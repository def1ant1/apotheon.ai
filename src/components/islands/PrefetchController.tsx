import { useEffect } from 'react';

import {
  PREFETCH_ANCHOR_SELECTOR,
  PREFETCH_ATTRIBUTE,
  PREFETCH_ATTRIBUTE_PAYLOAD,
  PREFETCH_REFRESH_EVENT,
} from '../../utils/navigation/prefetch-constants';
import {
  createPrefetchManager,
  type PrefetchManager,
} from '../../utils/navigation/prefetch-manager';

/**
 * PrefetchController Island
 * -------------------------
 *
 * This zero-UI island bootstraps the speculative navigation manager client-side. Key principles:
 * - It instantiates a shared {@link PrefetchManager} once per document, even when multiple
 *   instances of this island mount (header, footer, onboarding overlays, etc.).
 * - It scans for anchors that opt-in via the `data-prefetch="intent"` attribute and hands them to
 *   the central prefetch manager so hover/viewport/focus heuristics fire consistently.
 * - It wires a {@link MutationObserver} plus a manual refresh event so dynamically inserted links or
 *   client-side route swaps can participate without bespoke integration work.
 *
 * Attribute contract for consumers:
 * - Spread {@link PREFETCH_ATTRIBUTE_PAYLOAD} onto any first-party `<a>` elements that should
 *   prefetch their destination when users exhibit intent (viewport entry, hover, focus).
 * - Avoid applying the attribute to downloads, external URLs, or mail/telephone anchors—the
 *   controller defensively revalidates each candidate, but omitting the attribute keeps templates
 *   honest and communicates intent to future contributors.
 */
export default function PrefetchController(): null {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return undefined;
    }

    const runtime = acquireRuntime();
    runtime.mountCount += 1;

    // Initial scan ensures anchors rendered during SSR are registered before observers kick in.
    registerAnchors(runtime, document);

    if (!runtime.observer) {
      const MutationObserverCtor =
        typeof window.MutationObserver === 'function' ? window.MutationObserver : undefined;

      if (MutationObserverCtor) {
        runtime.observer = createRuntimeObserver(runtime, MutationObserverCtor);
        const observationTarget = document.body ?? document.documentElement;
        if (observationTarget) {
          runtime.observer.observe(observationTarget, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: [PREFETCH_ATTRIBUTE],
          });
        }
      }
    }

    window.addEventListener(PREFETCH_REFRESH_EVENT, runtime.refreshHandler);

    return () => {
      window.removeEventListener(PREFETCH_REFRESH_EVENT, runtime.refreshHandler);

      runtime.mountCount -= 1;
      if (runtime.mountCount <= 0) {
        runtime.mountCount = 0;
        runtime.observer?.disconnect();
        runtime.observer = null;
        runtime.manager.destroy();
        runtime.registeredAnchors = new WeakSet();
        releaseRuntime();
      }
    };
  }, []);

  return null;
}

interface PrefetchRuntime {
  manager: PrefetchManager;
  observer: MutationObserver | null;
  registeredAnchors: WeakSet<HTMLAnchorElement>;
  mountCount: number;
  refreshHandler: () => void;
}

let sharedRuntime: PrefetchRuntime | null = null;

function acquireRuntime(): PrefetchRuntime {
  if (sharedRuntime) {
    return sharedRuntime;
  }

  const manager = createPrefetchManager({
    eligibility: {
      customAllowPredicate: (anchor) => anchor.hasAttribute(PREFETCH_ATTRIBUTE),
    },
  });

  sharedRuntime = {
    manager,
    observer: null,
    registeredAnchors: new WeakSet<HTMLAnchorElement>(),
    mountCount: 0,
    refreshHandler: () => {
      if (typeof document === 'undefined') {
        return;
      }
      if (!sharedRuntime) {
        return;
      }
      registerAnchors(sharedRuntime, document);
    },
  };

  return sharedRuntime;
}

function releaseRuntime(): void {
  sharedRuntime = null;
}

function createRuntimeObserver(
  runtime: PrefetchRuntime,
  ObserverCtor: typeof MutationObserver,
): MutationObserver {
  const observer = new ObserverCtor((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        for (const added of mutation.addedNodes) {
          registerAnchorsFromNode(runtime, added);
        }
        for (const removed of mutation.removedNodes) {
          unregisterAnchorsFromNode(runtime, removed);
        }
      } else if (mutation.type === 'attributes') {
        const target = mutation.target;
        if (!(target instanceof HTMLAnchorElement)) {
          continue;
        }

        if (target.hasAttribute(PREFETCH_ATTRIBUTE)) {
          registerAnchor(runtime, target);
        } else {
          unregisterAnchor(runtime, target);
        }
      }
    }
  });

  return observer;
}

function registerAnchors(runtime: PrefetchRuntime, container: ParentNode): void {
  const anchors = container.querySelectorAll<HTMLAnchorElement>(PREFETCH_ANCHOR_SELECTOR);
  anchors.forEach((anchor) => registerAnchor(runtime, anchor));
}

function registerAnchorsFromNode(runtime: PrefetchRuntime, node: Node): void {
  if (node instanceof HTMLAnchorElement) {
    if (node.matches(PREFETCH_ANCHOR_SELECTOR)) {
      registerAnchor(runtime, node);
    }
  }

  if (node instanceof Element || node instanceof DocumentFragment) {
    const anchors = node.querySelectorAll?.(PREFETCH_ANCHOR_SELECTOR) ?? [];
    anchors.forEach((anchor) => registerAnchor(runtime, anchor));
  }
}

function unregisterAnchorsFromNode(runtime: PrefetchRuntime, node: Node): void {
  if (node instanceof HTMLAnchorElement) {
    unregisterAnchor(runtime, node);
  }

  if (node instanceof Element || node instanceof DocumentFragment) {
    const anchors = node.querySelectorAll?.(PREFETCH_ANCHOR_SELECTOR) ?? [];
    anchors.forEach((anchor) => unregisterAnchor(runtime, anchor));
  }
}

function registerAnchor(runtime: PrefetchRuntime, anchor: HTMLAnchorElement): void {
  if (runtime.registeredAnchors.has(anchor)) {
    return;
  }

  runtime.manager.registerAnchor(anchor);
  runtime.registeredAnchors.add(anchor);
}

function unregisterAnchor(runtime: PrefetchRuntime, anchor: HTMLAnchorElement): void {
  if (!runtime.registeredAnchors.has(anchor)) {
    return;
  }

  runtime.manager.unregisterAnchor(anchor);
  runtime.registeredAnchors.delete(anchor);
}

// Re-exporting the payload ensures Astro components can opt-in without importing from two modules.
export { PREFETCH_ATTRIBUTE_PAYLOAD };
