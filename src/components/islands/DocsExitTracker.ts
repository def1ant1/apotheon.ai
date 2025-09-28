import { useEffect, useRef } from 'react';

import { trackAnalyticsEvent } from '../../utils/analytics';

interface DocsExitTrackerProps {
  slug: string;
}

/**
 * `DocsExitTracker` island
 * ------------------------
 *
 * Docs content lives behind a static Astro page, so we hydrate a lightweight
 * observer that records exit telemetry without forcing an SPA router. The
 * instrumentation focuses on Pagefind search correlation (query-to-exit) and
 * executive reporting, hence the emphasis on scroll depth and dwell time.
 */
export default function DocsExitTracker({ slug }: DocsExitTrackerProps): null {
  const dispatchedRef = useRef(false);
  const maxScrollRatioRef = useRef(0);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const navigationPath = window.location.pathname;
    const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const computeScrollRatio = () => {
      const docElement = document.documentElement;
      if (!docElement) return;
      const totalHeight = docElement.scrollHeight - window.innerHeight;
      if (totalHeight <= 0) {
        maxScrollRatioRef.current = 1;
        return;
      }
      const viewportBottom = window.scrollY + window.innerHeight;
      const ratio = Math.min(1, viewportBottom / docElement.scrollHeight);
      if (ratio > maxScrollRatioRef.current) {
        maxScrollRatioRef.current = ratio;
      }
    };

    const handleScroll = () => {
      const scheduler =
        typeof window.requestAnimationFrame === 'function'
          ? window.requestAnimationFrame.bind(window)
          : (callback: FrameRequestCallback) =>
              window.setTimeout(() => callback(performance.now()), 0);
      scheduler(computeScrollRatio);
    };

    computeScrollRatio();
    window.addEventListener('scroll', handleScroll, { passive: true });

    const dispatchExit = (reason: string) => {
      if (dispatchedRef.current) return;
      dispatchedRef.current = true;

      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const dwell = Math.max(0, now - startTime);
      const roundedScroll = Math.round(maxScrollRatioRef.current * 100) / 100;

      void trackAnalyticsEvent({
        event: 'docs_exit',
        payload: {
          slug,
          exitPath: navigationPath,
          timeOnPageMs: Math.round(dwell),
          scrollDepth: roundedScroll,
          referrer: document.referrer || null,
          reason,
        },
        transport: 'beacon',
      });
    };

    const visibilityHandler = () => {
      if (document.visibilityState === 'hidden') {
        dispatchExit('visibilitychange');
      }
    };

    const pageHideHandler = (event: Event) => {
      dispatchExit(event.type);
    };

    window.addEventListener('visibilitychange', visibilityHandler);
    window.addEventListener('pagehide', pageHideHandler);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('visibilitychange', visibilityHandler);
      window.removeEventListener('pagehide', pageHideHandler);
    };
  }, [slug]);

  return null;
}
