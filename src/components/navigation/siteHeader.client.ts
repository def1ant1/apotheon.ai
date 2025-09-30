/**
 * Client bootstrap for the SiteHeader. The skip link lives in the static Astro markup, so we attach
 * a tiny listener at runtime to guarantee the anchor scrolls smoothly (or instantly when reduced
 * motion is requested) and then hands focus to the `#main` landmark.
 */
import {
  installAnchorFocusManager,
  type AnchorFocusManagerConfig,
} from '../../utils/accessibility/anchorFocus';

const SKIP_LINK_SELECTOR = '[data-skip-link]';

export interface SiteHeaderAnchorFocusOptions
  extends Pick<AnchorFocusManagerConfig, 'smoothDelayMs' | 'motionQuery'> {}

export function initSiteHeaderAnchorFocus(options: SiteHeaderAnchorFocusOptions = {}): void {
  if (typeof document === 'undefined') {
    return;
  }

  const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>(SKIP_LINK_SELECTOR));

  const declaredTargets = new Set<string>();
  anchors.forEach((anchor) => {
    const candidate = anchor.dataset.skipLinkTarget?.trim();
    if (candidate) {
      declaredTargets.add(candidate);
    }
  });

  installAnchorFocusManager({
    anchorSelector: SKIP_LINK_SELECTOR,
    allowedTargetIds: declaredTargets.size > 0 ? declaredTargets : undefined,
    smoothDelayMs: options.smoothDelayMs,
    motionQuery: options.motionQuery ?? null,
  });
}
