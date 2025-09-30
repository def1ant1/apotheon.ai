/**
 * Accessibility-first navigation utilities centralize scroll + focus hand-offs for enterprise skip
 * links. We keep everything framework-agnostic so Astro, React islands, and server-rendered workers
 * can share the same behaviour without diverging in audits.
 */

export interface FocusAfterScrollOptions {
  /** Override the scroll behaviour. Typically derived from `prefers-reduced-motion`. */
  behavior?: ScrollBehavior;
  /** Optional matchMedia reference for deterministic testing. */
  motionQuery?: MediaQueryList | null;
  /**
   * Buffer in milliseconds between invoking `scrollIntoView` and performing the programmatic focus.
   * Smooth scrolling requires a slight delay so we do not yank the viewport mid-animation.
   */
  smoothDelayMs?: number;
  /** Additional focus options applied when calling `HTMLElement.focus`. */
  focusOptions?: FocusOptions;
}

export interface AnchorFocusManagerConfig {
  /** CSS selector that scopes which anchors receive the managed behaviour. */
  anchorSelector: string;
  /**
   * Optional allowlist of IDs to defend against typos in `href="#id"` attributes. Passing an empty
   * set disables the check so multi-target menus can opt-in gradually.
   */
  allowedTargetIds?: ReadonlySet<string>;
  /** Inject a deterministic delay for smooth scrolling; defaults to `280ms`. */
  smoothDelayMs?: number;
  /** Optional `matchMedia` result used to respect reduced-motion preferences in tests. */
  motionQuery?: MediaQueryList | null;
  /** Logger interface used to surface configuration mistakes without crashing hydration. */
  logger?: Pick<Console, 'error' | 'warn'>;
}

const DEFAULT_SMOOTH_DELAY_MS = 280;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Determine which scroll behaviour to request when driving anchor navigation.
 */
export function getPreferredScrollBehavior(
  motionQuery: MediaQueryList | null = typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function'
    ? window.matchMedia(REDUCED_MOTION_QUERY)
    : null,
): ScrollBehavior {
  return motionQuery?.matches ? 'auto' : 'smooth';
}

/**
 * Scroll to the supplied element and move keyboard focus once the viewport settles. This mimics the
 * behaviour screen readers expect when activating skip links while still honouring smooth scrolling
 * for sighted keyboard users.
 */
export function focusElementAfterScroll(
  target: HTMLElement,
  options: FocusAfterScrollOptions = {},
): number | null {
  const behavior = options.behavior ?? getPreferredScrollBehavior(options.motionQuery ?? null);
  const smoothDelay = options.smoothDelayMs ?? DEFAULT_SMOOTH_DELAY_MS;

  target.scrollIntoView({ behavior, block: 'start', inline: 'nearest' });

  const focusAction = () => target.focus({ preventScroll: true, ...(options.focusOptions ?? {}) });

  if (behavior === 'smooth') {
    return window.setTimeout(focusAction, smoothDelay);
  }

  focusAction();
  return null;
}

/** Extract the hash/ID target declared on an anchor element. */
export function resolveAnchorTargetId(anchor: HTMLAnchorElement): string | null {
  const explicitTarget = anchor.dataset.skipLinkTarget?.trim();
  if (explicitTarget) {
    return explicitTarget;
  }

  const href = anchor.getAttribute('href') ?? '';
  if (!href.startsWith('#') || href.length <= 1) {
    return null;
  }

  try {
    return decodeURIComponent(href.slice(1));
  } catch {
    return href.slice(1);
  }
}

/**
 * Wire click listeners on matching anchors so we can focus the associated target once scrolling
 * concludes. The manager is idempotent and will warn (without throwing) when configuration issues are
 * detected so regressions surface quickly in staging.
 */
export function installAnchorFocusManager(config: AnchorFocusManagerConfig): void {
  if (typeof document === 'undefined') {
    return;
  }

  const {
    anchorSelector,
    allowedTargetIds,
    smoothDelayMs = DEFAULT_SMOOTH_DELAY_MS,
    motionQuery = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(REDUCED_MOTION_QUERY)
      : null,
    logger = console,
  } = config;

  const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>(anchorSelector));

  anchors.forEach((anchor) => {
    if (anchor.dataset.focusManaged === 'true') {
      return;
    }

    const targetId = resolveAnchorTargetId(anchor);
    if (!targetId) {
      logger.error('[navigation] Anchor missing a valid hash target.', { anchor });
      return;
    }

    if (allowedTargetIds && allowedTargetIds.size > 0 && !allowedTargetIds.has(targetId)) {
      logger.error('[navigation] Anchor target not included in allowlist.', {
        anchor,
        targetId,
        allowed: Array.from(allowedTargetIds.values()),
      });
      return;
    }

    const domTarget = document.getElementById(targetId);
    if (!domTarget) {
      logger.error('[navigation] Anchor target not found in DOM.', { anchor, targetId });
      return;
    }

    anchor.dataset.focusManaged = 'true';

    anchor.addEventListener('click', (event) => {
      const href = anchor.getAttribute('href') ?? '';
      if (!href.startsWith('#')) {
        return;
      }

      event.preventDefault();

      focusElementAfterScroll(domTarget, {
        smoothDelayMs,
        motionQuery,
      });

      const hash = `#${targetId}`;
      if (typeof history?.replaceState === 'function') {
        history.replaceState(history.state, '', hash);
      } else {
        window.location.hash = hash;
      }
    });
  });
}
