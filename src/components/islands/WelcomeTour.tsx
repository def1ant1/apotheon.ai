import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import { createPortal } from 'react-dom';

import PrefetchController from './PrefetchController';
import { WELCOME_TOUR_EVENT_CHANNEL, WELCOME_TOUR_STORAGE_KEY } from './welcomeTour.constants';

/**
 * WelcomeTour React island
 * ------------------------
 *
 * This island ships the guided onboarding surface that activates on a visitor's
 * first session. It balances a11y, analytics, and progressive enhancement:
 * - The overlay only hydrates client-side and bails immediately when JavaScript
 *   or `window` objects are unavailable (SSR, crawlers).
 * - Highlight targets are resolved dynamically so page templates can evolve
 *   without rewriting the onboarding logic—drop a `data-welcome-tour-target`
 *   attribute on any element and the tour can spotlight it.
 * - Analytics hooks fan out through `CustomEvent`, optional `dataLayer`
 *   push integration, and an escape hatch prop for future React consumers.
 *
 * Copious comments call out the rationale behind each branch so teams can scale
 * the onboarding system without reverse engineering subtle behaviours.
 */

/** Radius + padding make the highlight halo feel intentional instead of cramped. */
const HIGHLIGHT_BORDER_RADIUS_PX = 16;
const HIGHLIGHT_PADDING_PX = 12;

/** Centralised representation of a step's viewport coordinates. */
interface SpotlightDimensions {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
}

interface LegacyMediaQueryList {
  addListener: (listener: (event: MediaQueryListEvent) => void) => void;
  removeListener: (listener: (event: MediaQueryListEvent) => void) => void;
}

export interface WelcomeTourStep {
  /** Unique identifier so analytics + QA runs can assert deterministic order. */
  readonly id: string;
  /** CSS selector used to find the DOM node we need to highlight. */
  readonly targetSelector: string;
  /** Localisable heading surfaced inside the dialog shell. */
  readonly title: string;
  /** Supporting narrative explaining why the highlighted area matters. */
  readonly description: string;
}

export interface WelcomeTourLabels {
  readonly close: string;
  readonly next: string;
  readonly previous: string;
  readonly skip: string;
  readonly finish: string;
  /**
   * Template string used to announce progress. We replace `{{current}}` and
   * `{{total}}` with the actual values so translations stay declarative.
   */
  readonly progress: string;
  /** Prefix announced to assistive tech before each step description. */
  readonly srLandmarkPrefix: string;
  /** Text read to screen readers when the dialog first opens. */
  readonly srDialogAnnouncement: string;
}

export interface WelcomeTourEventPayload {
  readonly type:
    | 'open'
    | 'dismiss'
    | 'complete'
    | 'step:next'
    | 'step:previous'
    | 'step:auto-skip'
    | 'target-missing';
  readonly stepId?: string;
  readonly stepIndex?: number;
  readonly totalSteps: number;
  readonly reason?: string;
  readonly source?: 'click' | 'keyboard' | 'auto';
}

export interface WelcomeTourProps {
  /** Headline rendered at the top of the dialog shell. */
  readonly title: string;
  /** Supporting copy setting context for the guided experience. */
  readonly description: string;
  /** Ordered array of steps—empty arrays short-circuit the island entirely. */
  readonly steps: ReadonlyArray<WelcomeTourStep>;
  /** Button labels + screen reader announcements sourced from i18n bundles. */
  readonly labels: WelcomeTourLabels;
  /**
   * Optional override for the storage key. Defaults to the shared constant so
   * the same preference applies across every page that hydrates the island.
   */
  readonly storageKey?: string;
  /**
   * Optional custom event channel. Consumers can subscribe once at runtime to
   * mirror analytics into data warehouses without editing the component.
   */
  readonly eventChannel?: string;
  /**
   * When defined, the component pushes `{ event: dataLayerEventName, ... }`
   * objects into the global `dataLayer` array (if present) for GTM parity.
   */
  readonly dataLayerEventName?: string;
  /**
   * Pass `false` to suppress automatic opening (useful for QA toggles). We keep
   * the prop serialisable so Astro can pipe it through hydration payloads.
   */
  readonly openOnLoad?: boolean;
  /** Escape hatch for other React surfaces embedding the island. */
  readonly onEvent?: (payload: WelcomeTourEventPayload) => void;
}

/** Encapsulate template replacement without dragging in a templating runtime. */
function renderProgressLabel(template: string, current: number, total: number): string {
  return template
    .replace(/\{\{\s*current\s*\}\}/gi, String(current))
    .replace(/\{\{\s*total\s*\}\}/gi, String(total));
}

export default function WelcomeTour({
  title,
  description,
  steps,
  labels,
  storageKey = WELCOME_TOUR_STORAGE_KEY,
  eventChannel = WELCOME_TOUR_EVENT_CHANNEL,
  dataLayerEventName,
  openOnLoad = true,
  onEvent,
}: WelcomeTourProps): JSX.Element | null {
  const [hydrated, setHydrated] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [spotlight, setSpotlight] = useState<SpotlightDimensions | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const hasBootstrappedRef = useRef(false);
  const attemptedStepIdsRef = useRef(new Set<string>());

  const dialogTitleId = useId();
  const dialogDescriptionId = useId();
  const srAnnouncementId = useId();

  const previousButtonRef = useRef<HTMLButtonElement | null>(null);
  const nextButtonRef = useRef<HTMLButtonElement | null>(null);
  const skipButtonRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  /**
   * Hydration guard: we never render the dialog server-side. Once the component
   * runs in the browser we set the flag so subsequent effects can safely touch
   * `window` and `document` without try/catch noise.
   */
  useEffect(() => {
    setHydrated(true);
  }, []);

  /** Track `prefers-reduced-motion` so scroll + transition logic respect user settings. */
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncPreference = () => {
      setPrefersReducedMotion(query.matches);
    };

    syncPreference();

    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', syncPreference);
      return () => {
        query.removeEventListener('change', syncPreference);
      };
    }

    const legacyQuery = query as unknown as Partial<LegacyMediaQueryList>;
    if (
      typeof legacyQuery.addListener === 'function' &&
      typeof legacyQuery.removeListener === 'function'
    ) {
      legacyQuery.addListener(syncPreference);
      return () => {
        legacyQuery.removeListener?.(syncPreference);
      };
    }

    return undefined;
  }, []);

  const emitEvent = useCallback(
    (payload: WelcomeTourEventPayload) => {
      onEvent?.(payload);

      if (typeof window !== 'undefined') {
        try {
          const detail: WelcomeTourEventPayload = { ...payload };
          window.dispatchEvent(new CustomEvent(eventChannel, { detail }));

          const potentialDataLayer = (
            window as unknown as {
              dataLayer?: Array<Record<string, unknown>>;
            }
          ).dataLayer;
          if (dataLayerEventName && Array.isArray(potentialDataLayer)) {
            potentialDataLayer.push({
              event: dataLayerEventName,
              ...detail,
            });
          }
        } catch (error) {
          console.warn('[welcome-tour] failed to emit analytics payload', error);
        }
      }
    },
    [dataLayerEventName, eventChannel, onEvent],
  );

  const markDismissed = useCallback(
    (reason: string) => {
      if (typeof window === 'undefined' || !window.localStorage) {
        return;
      }
      try {
        const payload = {
          status: 'dismissed' as const,
          reason,
          timestamp: new Date().toISOString(),
        };
        window.localStorage.setItem(storageKey, JSON.stringify(payload));
      } catch (error) {
        console.warn('[welcome-tour] failed to persist dismissal preference', error);
      }
    },
    [storageKey],
  );

  const totalSteps = steps.length;
  const activeStep = steps[currentStepIndex] ?? null;

  /** Helper for focus trapping—collate refs into a stable list. */
  const focusableRefs = useMemo(
    () =>
      [previousButtonRef, nextButtonRef, skipButtonRef, closeButtonRef].filter(
        (ref): ref is MutableRefObject<HTMLButtonElement | null> => Boolean(ref.current),
      ),
    [closeButtonRef, nextButtonRef, previousButtonRef, skipButtonRef],
  );

  const closeOverlay = useCallback(
    (reason: string, type: 'dismiss' | 'complete') => {
      markDismissed(reason);
      setIsOpen(false);
      setSpotlight(null);
      attemptedStepIdsRef.current.clear();
      emitEvent({
        type,
        stepId: activeStep?.id,
        stepIndex: activeStep ? currentStepIndex : undefined,
        totalSteps,
        reason,
      });
    },
    [activeStep, currentStepIndex, emitEvent, markDismissed, totalSteps],
  );

  const goToStep = useCallback(
    (nextIndex: number, source: 'click' | 'keyboard' | 'auto') => {
      setCurrentStepIndex((previousIndex) => {
        if (nextIndex === previousIndex) {
          return previousIndex;
        }
        const nextStep = steps[nextIndex];
        if (!nextStep) {
          return previousIndex;
        }
        emitEvent({
          type: nextIndex > previousIndex ? 'step:next' : 'step:previous',
          stepId: nextStep.id,
          stepIndex: nextIndex,
          totalSteps,
          source,
        });
        return nextIndex;
      });
    },
    [emitEvent, steps, totalSteps],
  );

  const handleNext = useCallback(
    (source: 'click' | 'keyboard') => {
      const nextIndex = currentStepIndex + 1;
      if (nextIndex >= totalSteps) {
        closeOverlay('completed', 'complete');
        return;
      }
      goToStep(nextIndex, source);
    },
    [closeOverlay, currentStepIndex, goToStep, totalSteps],
  );

  const handlePrevious = useCallback(
    (source: 'click' | 'keyboard') => {
      const prevIndex = Math.max(0, currentStepIndex - 1);
      if (prevIndex === currentStepIndex) {
        return;
      }
      goToStep(prevIndex, source);
    },
    [currentStepIndex, goToStep],
  );

  const handleSkip = useCallback(
    (reason: string) => {
      closeOverlay(reason, 'dismiss');
    },
    [closeOverlay],
  );

  /**
   * Auto-open once when hydration completes. We guard with `hasBootstrappedRef`
   * so prop changes do not retrigger the dialog (e.g., React Fast Refresh).
   */
  useEffect(() => {
    if (!hydrated || hasBootstrappedRef.current) {
      return;
    }
    hasBootstrappedRef.current = true;

    if (!openOnLoad || totalSteps === 0 || typeof window === 'undefined') {
      return;
    }

    try {
      const stored = window.localStorage?.getItem(storageKey);
      if (stored) {
        return;
      }
    } catch (error) {
      console.warn('[welcome-tour] unable to read storage key; continuing anyway', error);
    }

    setIsOpen(true);
    emitEvent({ type: 'open', totalSteps });
  }, [emitEvent, hydrated, openOnLoad, storageKey, totalSteps]);

  /** Body scroll lock ensures keyboard users do not tab into the background. */
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') {
      return undefined;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  /**
   * Whenever the active step changes we resolve the DOM node, compute spotlight
   * geometry, and ensure it is scrolled into view.
   */
  useEffect(() => {
    if (!isOpen || !activeStep || typeof document === 'undefined') {
      return;
    }

    const element = document.querySelector<HTMLElement>(activeStep.targetSelector);
    if (!element) {
      if (!attemptedStepIdsRef.current.has(activeStep.id)) {
        attemptedStepIdsRef.current.add(activeStep.id);
        emitEvent({
          type: 'target-missing',
          stepId: activeStep.id,
          stepIndex: currentStepIndex,
          totalSteps,
        });
      }

      const nextIndex = currentStepIndex + 1;
      if (nextIndex < totalSteps) {
        goToStep(nextIndex, 'auto');
        emitEvent({
          type: 'step:auto-skip',
          stepId: activeStep.id,
          stepIndex: currentStepIndex,
          totalSteps,
          reason: 'missing-target',
          source: 'auto',
        });
        return;
      }

      // No more steps—treat as completion so we do not trap the user.
      closeOverlay('auto-complete', 'complete');
      return;
    }

    attemptedStepIdsRef.current.delete(activeStep.id);
    const updateSpotlight = () => {
      const rect = element.getBoundingClientRect();
      setSpotlight({
        top: Math.max(rect.top - HIGHLIGHT_PADDING_PX, 0),
        left: Math.max(rect.left - HIGHLIGHT_PADDING_PX, 0),
        width: rect.width + HIGHLIGHT_PADDING_PX * 2,
        height: rect.height + HIGHLIGHT_PADDING_PX * 2,
      });
    };

    updateSpotlight();

    if (!prefersReducedMotion) {
      try {
        element.scrollIntoView({ block: 'center', behavior: 'smooth' });
      } catch (error) {
        console.warn('[welcome-tour] failed to scroll highlighted element into view', error);
      }
    }

    const handleResize = () => updateSpotlight();
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
    };
  }, [
    activeStep,
    closeOverlay,
    currentStepIndex,
    emitEvent,
    goToStep,
    isOpen,
    prefersReducedMotion,
    totalSteps,
  ]);

  /** Focus the primary CTA when the dialog appears so keyboard users can continue instantly. */
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const timeout = window.setTimeout(() => {
      nextButtonRef.current?.focus({ preventScroll: true });
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [isOpen]);

  /** Basic focus trap + keyboard shortcuts. */
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) {
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        handleSkip('escaped');
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        handleNext('keyboard');
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        handlePrevious('keyboard');
        return;
      }

      if (event.key === 'Tab' && focusableRefs.length > 0) {
        const focusable = focusableRefs.map((ref) => ref.current).filter(Boolean) as HTMLElement[];
        if (focusable.length === 0) {
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey) {
          if (document.activeElement === first) {
            event.preventDefault();
            last.focus();
          }
        } else if (document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [focusableRefs, handleNext, handlePrevious, handleSkip, isOpen]);

  if (!hydrated) {
    return null;
  }

  if (!isOpen || !activeStep) {
    return <PrefetchController />;
  }

  const progressLabel = renderProgressLabel(labels.progress, currentStepIndex + 1, totalSteps);

  const dialog = (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center px-4 pt-12 pb-6 sm:items-center sm:pb-12"
      data-testid="welcome-tour-overlay"
    >
      <div aria-hidden className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm" />

      {spotlight ? (
        <div
          className="pointer-events-none fixed z-[61] box-border shadow-[0_0_0_200vmax_rgba(15,23,42,0.72)] transition-[top,left,width,height] duration-300 ease-out"
          data-testid="welcome-tour-spotlight"
          style={{
            top: `${spotlight.top}px`,
            left: `${spotlight.left}px`,
            width: `${spotlight.width}px`,
            height: `${spotlight.height}px`,
            borderRadius: `${HIGHLIGHT_BORDER_RADIUS_PX}px`,
          }}
        />
      ) : null}

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
        aria-describedby={dialogDescriptionId}
        data-testid="welcome-tour-dialog"
        className="relative z-[62] w-full max-w-lg rounded-3xl border border-slate-700/60 bg-slate-900/95 p-6 text-slate-100 shadow-xl"
      >
        <p id={srAnnouncementId} className="sr-only" aria-live="assertive">
          {labels.srDialogAnnouncement}
        </p>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-sm tracking-[0.2em] text-sky-300 uppercase">{progressLabel}</p>
            <h2 id={dialogTitleId} className="text-2xl font-semibold">
              {title}
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="rounded-full border border-transparent p-2 text-slate-400 transition hover:border-slate-600 hover:text-slate-100"
            onClick={() => handleSkip('closed')}
            aria-label={labels.close}
            data-testid="welcome-tour-close"
          >
            ×
          </button>
        </div>

        <p id={dialogDescriptionId} className="mt-4 text-base text-slate-200">
          {description}
        </p>

        <article className="mt-6 space-y-3" data-testid={`welcome-tour-step-${activeStep.id}`}>
          <p className="text-sm font-semibold text-sky-200">
            {labels.srLandmarkPrefix}: {activeStep.title}
          </p>
          <h3 className="text-xl font-semibold text-white">{activeStep.title}</h3>
          <p className="text-base leading-relaxed text-slate-200">{activeStep.description}</p>
        </article>

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              ref={previousButtonRef}
              type="button"
              className="rounded-full border border-slate-600/70 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-sky-400 hover:text-sky-200 disabled:border-slate-700/40 disabled:text-slate-600"
              onClick={() => handlePrevious('click')}
              disabled={currentStepIndex === 0}
              data-testid="welcome-tour-previous"
            >
              {labels.previous}
            </button>
            <button
              ref={nextButtonRef}
              type="button"
              className="rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
              onClick={() => handleNext('click')}
              data-testid="welcome-tour-next"
            >
              {currentStepIndex === totalSteps - 1 ? labels.finish : labels.next}
            </button>
          </div>

          <button
            ref={skipButtonRef}
            type="button"
            className="text-sm font-medium text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
            onClick={() => handleSkip('skipped')}
            data-testid="welcome-tour-skip"
          >
            {labels.skip}
          </button>
        </footer>
      </section>
    </div>
  );

  return (
    <>
      <PrefetchController />
      {createPortal(dialog, document.body)}
    </>
  );
}
