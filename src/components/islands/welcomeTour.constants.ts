/**
 * Welcome tour constants
 * ----------------------
 *
 * Keeping the storage key + event channel centralized guarantees that the React
 * island, Vitest unit tests, and Playwright coverage all remain in sync. Any
 * change to these identifiers should ship with documentation + analytics
 * updates, so surfacing them in a dedicated module makes the diff impossible to
 * miss.
 */
export const WELCOME_TOUR_STORAGE_KEY = 'apotheon:welcome-tour:v1';

/**
 * Custom event channel fired from the island whenever a lifecycle transition
 * occurs (open, close, step transitions, etc.). Analytics teams can subscribe
 * once at the window level instead of threading callbacks through every Astro
 * entry point.
 */
export const WELCOME_TOUR_EVENT_CHANNEL = 'apotheon:welcome-tour:event';
