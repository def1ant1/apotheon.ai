import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

import {
  klaroConfig,
  type KlaroService,
  getDefaultConsentState,
} from '../../../config/privacy/klaro.config';

type ConsentState = Record<string, boolean>;

type ConsentApi = {
  get: () => ConsentState;
  isGranted: (service: string) => boolean;
  subscribe: (listener: (state: ConsentState) => void) => () => void;
  update: (next: ConsentState) => void;
};

declare global {
  interface Window {
    __APOTHEON_CONSENT__?: ConsentApi;
  }
}

const CONSENT_STORAGE_KEY = 'apotheon_privacy_consent';

const REQUIRED_SERVICES = new Set(
  klaroConfig.services.filter((service) => service.required).map((service) => service.name),
);

function loadStoredConsent(): ConsentState {
  if (typeof window === 'undefined') return getDefaultConsentState();
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return getDefaultConsentState();
    const parsed = JSON.parse(raw) as ConsentState;
    return { ...getDefaultConsentState(), ...parsed };
  } catch (error) {
    console.warn('[consent-manager] unable to parse stored consent', error);
    return getDefaultConsentState();
  }
}

function persistConsent(state: ConsentState): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(state));
}

function enforceRequiredServices(state: ConsentState): ConsentState {
  const next: ConsentState = { ...state };
  for (const required of REQUIRED_SERVICES) {
    next[required] = true;
  }
  return next;
}

interface ConsentManagerProps {
  autoOpen?: boolean;
}

export default function ConsentManager({ autoOpen = true }: ConsentManagerProps) {
  const [open, setOpen] = useState(() => {
    if (typeof window === 'undefined') return autoOpen;
    return autoOpen && !window.localStorage.getItem(CONSENT_STORAGE_KEY);
  });
  const [state, setState] = useState<ConsentState>(() =>
    enforceRequiredServices(loadStoredConsent()),
  );
  const [pendingState, setPendingState] = useState<ConsentState>(state);
  const listenersRef = useRef(new Set<(state: ConsentState) => void>());
  const stateRef = useRef(state);

  /**
   * Pairing explicit identifiers with the dialog container lets us wire the
   * accessible name and description without depending on inner text heuristics.
   * This keeps axe happy while documenting the narration structure for future
   * engineers running screen reader smoke tests.
   */
  const dialogTitleId = useId();
  const dialogDescriptionId = useId();

  useEffect(() => {
    setPendingState(state);
  }, [state]);

  const consentApi = useMemo<ConsentApi>(() => {
    return {
      get: () => ({ ...stateRef.current }),
      isGranted: (service: string) => Boolean(stateRef.current[service]),
      subscribe: (listener) => {
        listenersRef.current.add(listener);
        return () => listenersRef.current.delete(listener);
      },
      update: (next) => {
        setState(enforceRequiredServices(next));
      },
    } satisfies ConsentApi;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.__APOTHEON_CONSENT__ = consentApi;
    return () => {
      if (window.__APOTHEON_CONSENT__ === consentApi) {
        delete window.__APOTHEON_CONSENT__;
      }
    };
  }, [consentApi]);

  useEffect(() => {
    stateRef.current = state;
    persistConsent(state);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('apotheon:consent:updated', { detail: state }));
    }
    const snapshot = { ...state };
    for (const listener of listenersRef.current) {
      try {
        listener(snapshot);
      } catch (error) {
        console.error('[consent-manager] listener failed', error);
      }
    }
  }, [state]);

  const groupedServices = useMemo(() => {
    const index = new Map<string, KlaroService>();
    for (const service of klaroConfig.services) {
      index.set(service.name, service);
    }

    return klaroConfig.categories.map((category) => ({
      ...category,
      services: category.services
        .map((name) => index.get(name))
        .filter((service): service is KlaroService => Boolean(service)),
    }));
  }, []);

  const applyAll = useCallback(
    (value: boolean) => {
      const next: ConsentState = { ...pendingState };
      for (const service of klaroConfig.services) {
        next[service.name] = service.required ? true : value;
      }
      setPendingState(enforceRequiredServices(next));
    },
    [pendingState],
  );

  const toggleService = useCallback((service: KlaroService) => {
    setPendingState((previous) => {
      const next = { ...previous };
      next[service.name] = service.required ? true : !previous[service.name];
      return enforceRequiredServices(next);
    });
  }, []);

  const save = useCallback(() => {
    setState(pendingState);
    setOpen(false);
  }, [pendingState]);

  if (!open) {
    return (
      <button
        type="button"
        className="rounded-md border border-slate-400 px-3 py-2 text-sm font-medium shadow-sm transition hover:bg-slate-100"
        onClick={() => setOpen(true)}
        data-testid="consent-open-trigger"
      >
        Privacy controls
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={dialogTitleId}
      aria-describedby={dialogDescriptionId}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
      data-testid="consent-modal"
    >
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-6 space-y-2">
          <h2 id={dialogTitleId} className="text-2xl font-bold">
            Privacy preferences
          </h2>
          <p id={dialogDescriptionId} className="text-sm text-slate-600">
            We only collect telemetry when you explicitly grant consent. Use the toggles below to
            tailor your experience.
          </p>
        </div>

        <section className="space-y-6">
          {groupedServices.map((category) => (
            <article key={category.id} className="rounded-lg border border-slate-200 p-4 shadow-sm">
              <header className="mb-4">
                <h3 className="text-lg font-semibold">{category.title}</h3>
                <p className="text-sm text-slate-600">{category.description}</p>
              </header>
              <ul className="space-y-3">
                {category.services.map((service) => (
                  <li key={service.name} className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium">{service.title}</p>
                      <p className="text-sm text-slate-600">{service.description}</p>
                      {service.privacyPolicyUrl ? (
                        <a
                          className="text-sm text-indigo-600 underline"
                          href={service.privacyPolicyUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          Read policy
                        </a>
                      ) : null}
                    </div>
                    <label className="inline-flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-5 w-5"
                        checked={Boolean(pendingState[service.name])}
                        onChange={() => toggleService(service)}
                        disabled={Boolean(service.required)}
                        data-testid={`consent-toggle-${service.name}`}
                      />
                      <span className="text-sm text-slate-600">
                        {service.required
                          ? 'Required'
                          : pendingState[service.name]
                            ? 'Enabled'
                            : 'Disabled'}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </section>

        <div
          className="mt-8 flex flex-wrap items-center justify-between gap-3"
          role="group"
          aria-label="Consent actions"
        >
          <div className="space-x-2">
            <button
              type="button"
              className="rounded-md border border-slate-400 px-3 py-2 text-sm font-medium shadow-sm transition hover:bg-slate-100"
              onClick={() => applyAll(false)}
              data-testid="consent-deny-all"
            >
              Deny optional
            </button>
            <button
              type="button"
              className="rounded-md border border-indigo-500 px-3 py-2 text-sm font-medium text-indigo-600 shadow-sm transition hover:bg-indigo-50"
              onClick={() => applyAll(true)}
              data-testid="consent-accept-all"
            >
              Accept all
            </button>
          </div>
          <div className="space-x-2">
            <button
              type="button"
              className="rounded-md border border-slate-400 px-3 py-2 text-sm font-medium shadow-sm transition hover:bg-slate-100"
              onClick={() => setOpen(false)}
              data-testid="consent-close"
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
              onClick={save}
              data-testid="consent-save"
            >
              Save preferences
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
