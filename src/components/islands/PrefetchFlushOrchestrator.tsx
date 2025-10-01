import { useEffect } from 'react';

import { mountPrefetchFlushOrchestrator } from '../../utils/navigation/prefetch-flush.client';

/**
 * PrefetchFlushOrchestrator Island
 * --------------------------------
 *
 * Zero-UI helper that mounts the shared `prefetchTelemetry` flush orchestrator.
 * Hydrating this island alongside `PrefetchController` ensures every layout
 * that renders the global chrome (header/footer) inherits the consent-gated
 * submission loop described in `docs/dev/PERFORMANCE.md`. Multiple instances
 * share a single runtime via reference counting, so onboarding modals or
 * embedded microsites can mount/unmount without duplicating intervals.
 */
export default function PrefetchFlushOrchestrator(): null {
  useEffect(() => {
    const release = mountPrefetchFlushOrchestrator();
    return () => {
      release?.();
    };
  }, []);

  return null;
}
