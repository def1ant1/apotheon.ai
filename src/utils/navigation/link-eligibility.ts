import { isSameOrigin } from '../url';

/**
 * Describes the outcome of the strict allow/deny evaluation performed before we
 * enqueue prefetch work. External surfaces can piggy-back on the same
 * safeguards to guarantee consistent behaviour across hover, viewport, and
 * programmatic prefetch triggers.
 */
export interface LinkEligibilityResult {
  eligible: boolean;
  reason?: string;
}

/**
 * Configuration contract for {@link evaluateAnchorEligibility}. Future
 * call-sites may opt into custom allow lists or additional heuristics without
 * duplicating the defensive checks that protect the network stack from
 * unintentional speculative traffic.
 */
export interface LinkEligibilityOptions {
  /**
   * Provide a bespoke origin to compare against instead of the active window
   * origin. Handy for tests or isomorphic environments where `window` may not
   * exist.
   */
  currentOrigin?: string;

  /**
   * Permits consumers to apply additional allow-list vetting. Returning `false`
   * short-circuits prefetch scheduling without repeating the standard guard
   * rails provided by this module.
   */
  customAllowPredicate?: (anchor: HTMLAnchorElement) => boolean;
}

/**
 * Enterprise-grade, centralized evaluation routine used to determine whether a
 * given anchor tag is safe to prefetch. By consolidating the logic we avoid a
 * patchwork of subtly different heuristics across components and we earn the
 * ability to unit test the decision tree in isolation.
 */
export function evaluateAnchorEligibility(
  anchor: HTMLAnchorElement,
  options: LinkEligibilityOptions = {},
): LinkEligibilityResult {
  const href = anchor.getAttribute('href');
  if (!href || href.trim().length === 0) {
    return { eligible: false, reason: 'Anchor without href cannot be prefetched.' };
  }

  if (anchor.hasAttribute('download')) {
    return { eligible: false, reason: 'Download links must never be prefetched.' };
  }

  if (anchor.target && anchor.target.toLowerCase() === '_blank') {
    return { eligible: false, reason: 'New tab targets are ignored to respect user intent.' };
  }

  const defaultOrigin =
    options.currentOrigin ?? (typeof window !== 'undefined' ? window.location.origin : undefined);

  let url: URL;
  try {
    url = new URL(href, defaultOrigin);
  } catch {
    return { eligible: false, reason: 'Malformed URLs cannot be resolved for prefetching.' };
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    return { eligible: false, reason: 'Only http(s) destinations are eligible for prefetch.' };
  }

  if (!defaultOrigin || !isSameOrigin(url, defaultOrigin)) {
    return { eligible: false, reason: 'Cross-origin navigation is blocked from prefetching.' };
  }

  if (typeof options.customAllowPredicate === 'function') {
    const approved = options.customAllowPredicate(anchor);
    if (!approved) {
      return { eligible: false, reason: 'Custom allow predicate vetoed the anchor.' };
    }
  }

  return { eligible: true };
}
