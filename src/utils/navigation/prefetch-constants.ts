/**
 * Shared constants for the client-side prefetch orchestration layer. Centralising the attribute
 * names means every component (Astro or React) can opt into speculative navigation without
 * hardcoding magic strings or duplicating selectors across templates.
 */
export const PREFETCH_ATTRIBUTE = 'data-prefetch' as const;

/**
 * We stamp a semantic value onto the attribute so analytics tooling can introspect intent if the DOM
 * snapshot gets exported (e.g., in synthetic monitoring). Presence is all the controller requires,
 * but a value of `intent` gives humans additional context when debugging.
 */
export const PREFETCH_ATTRIBUTE_VALUE = 'intent' as const;

/**
 * Convenience payload that can be spread directly into JSX/Astro elements, ensuring the attribute is
 * rendered consistently everywhere without constructing new objects at each call-site.
 */
export const PREFETCH_ATTRIBUTE_PAYLOAD = {
  [PREFETCH_ATTRIBUTE]: PREFETCH_ATTRIBUTE_VALUE,
} as const;

/**
 * Selector consumed by the runtime controller + mutation observer. Exported for test hooks or other
 * automation surfaces that need to mirror the same query without retyping it.
 */
export const PREFETCH_ANCHOR_SELECTOR = `a[${PREFETCH_ATTRIBUTE}]` as const;

/**
 * Custom event channel the controller listens to for manual refresh requests. Surfaces that perform
 * large DOM swaps (e.g., client-side routing experiments) can dispatch this event instead of
 * reimplementing prefetch bookkeeping logic.
 */
export const PREFETCH_REFRESH_EVENT = 'apotheon:prefetch:refresh' as const;
