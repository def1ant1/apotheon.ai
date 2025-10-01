import React, { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

import { trackAnalyticsEvent, type AnalyticsEvent } from '../../utils/analytics';
import {
  DEFAULT_INTENT,
  INTENT_ANALYTICS_EVENT,
  resolveIntentPresetFromSearch,
  type ContactIntent,
  type IntentPresetResolution,
  type RoleExperiencePreset,
} from '../../utils/audience-resolver';
import { contactFormSchema } from '../../utils/contact-validation';
import { analyzeDomain } from '../../utils/domain-allowlist';

type SubmissionState = 'idle' | 'submitting' | 'success' | 'error';

interface ContactFormProps {
  endpoint?: string;
  siteKey?: string;
}

interface FieldErrors {
  [key: string]: string;
}

/**
 * Centralize the mapping between validation keys and deterministic DOM identifiers so both JSX
 * attributes and error paragraphs can reference the same ids without risking drift across
 * refactors.
 */
const FIELD_ERROR_IDS = {
  name: 'contact-error-name',
  email: 'contact-error-email',
  company: 'contact-error-company',
  intent: 'contact-error-intent',
  message: 'contact-error-message',
  turnstileToken: 'contact-error-turnstile',
} as const;

const DEFAULT_ENDPOINT = import.meta.env.PUBLIC_CONTACT_ENDPOINT ?? '/api/contact';
const DEFAULT_SITE_KEY = import.meta.env.PUBLIC_TURNSTILE_SITE_KEY ?? 'test-site-key';

function resolveAnalyticsEventForIntent(intent: ContactIntent): AnalyticsEvent {
  return INTENT_ANALYTICS_EVENT[intent] ?? 'lead_demo';
}

function logEvent(event: string, payload: Record<string, unknown>) {
  if (typeof window !== 'undefined') {
    const { dataLayer } = window;
    if (Array.isArray(dataLayer)) {
      dataLayer.push({ event, ...payload });
    }
  }

  console.info(`[contact-form] ${event}`, payload);
}

function getStringValue(value: FormDataEntryValue | null | undefined): string {
  return typeof value === 'string' ? value : '';
}

function isErrorResponse(payload: unknown): payload is { error: string } {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'error' in payload &&
    typeof (payload as { error?: unknown }).error === 'string'
  );
}

export default function ContactForm({
  endpoint = DEFAULT_ENDPOINT,
  siteKey = DEFAULT_SITE_KEY,
}: ContactFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const turnstileRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<SubmissionState>('idle');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [globalMessage, setGlobalMessage] = useState<string>('');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const widgetIdRef = useRef<string | null>(null);
  const initialIntentPreset = useMemo(() => {
    if (typeof window === 'undefined') {
      return resolveIntentPresetFromSearch(null);
    }
    return resolveIntentPresetFromSearch(window.location.search);
  }, []);
  const [intent, setIntent] = useState<ContactIntent>(initialIntentPreset.intent);
  const [rolePreset, setRolePreset] = useState<RoleExperiencePreset | null>(
    initialIntentPreset.rolePreset ?? null,
  );
  const intentPresetRef = useRef<IntentPresetResolution>(initialIntentPreset);
  const hasLoggedIntentPrefill = useRef(false);
  const hasLoggedRoleExperience = useRef(false);
  /**
   * `React.useId` keeps the legend identifier deterministic across SSR and hydration so the
   * enclosing form can expose a stable accessible name via `aria-labelledby`.
   */
  const legendId = React.useId();

  /**
   * Re-run the resolver during hydration so querystring targeting coming from server render (or
   * client-side nav) keeps the form intent + messaging synchronized. All analytics fire exactly
   * once thanks to the dedicated refs.
   */
  useEffect(() => {
    const form = formRef.current;
    if (!form) {
      return undefined;
    }

    form.setAttribute('data-js-ready', 'true');
    return () => {
      form.setAttribute('data-js-ready', 'false');
    };
  }, []);

  const domainAssessment = useMemo(() => {
    if (!email) return null;
    return analyzeDomain(email);
  }, [email]);

  const statusFallbackMessage = useMemo(() => {
    if (!rolePreset) {
      return 'Form ready. Provide your project context to request a briefing.';
    }
    return `${rolePreset.contact.headline}: ${rolePreset.contact.message}`;
  }, [rolePreset]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const resolution = resolveIntentPresetFromSearch(window.location.search);
    intentPresetRef.current = resolution;
    setRolePreset(resolution.rolePreset ?? null);
    if (resolution.rolePreset && !hasLoggedRoleExperience.current) {
      hasLoggedRoleExperience.current = true;
      logEvent('contact_form_role_targeting_applied', {
        role: resolution.rolePreset.id,
        source: resolution.source,
      });
      void trackAnalyticsEvent({
        event: resolution.rolePreset.experienceEvent,
        payload: {
          role: resolution.rolePreset.id,
          surface: 'contact-form',
          source: resolution.source,
        },
        consentService: 'pipeline-alerts',
      });
    }
    if (resolution.source === 'team' || resolution.source === 'role') {
      setIntent(resolution.intent);
    }
    if (resolution.source === 'team' && !hasLoggedIntentPrefill.current) {
      hasLoggedIntentPrefill.current = true;
      logEvent('contact_form_intent_prefilled', {
        intent: resolution.intent,
        team: resolution.team,
      });
      void trackAnalyticsEvent({
        event: resolution.analyticsEvent,
        payload: {
          stage: 'prefill',
          source: 'querystring',
          team: resolution.team,
        },
        consentService: 'pipeline-alerts',
      });
    }
  }, []);

  useEffect(() => {
    if (!siteKey || typeof window === 'undefined') return;

    const scriptId = 'cf-turnstile-script';
    const initialize = () => {
      if (typeof window === 'undefined') return;
      const turnstile = window.turnstile;
      const container = turnstileRef.current;
      console.info('[contact-form] turnstile_initialize_attempt', {
        hasTurnstile: Boolean(turnstile),
        hasContainer: Boolean(container),
        widgetId: widgetIdRef.current,
      });
      if (!turnstile || !container || widgetIdRef.current) return;

      const id = turnstile.render(container, {
        sitekey: siteKey,
        appearance: 'interaction-only',
        callback(value) {
          setToken(value);
          setFieldErrors((previous) => ({ ...previous, turnstileToken: '' }));
          console.info('[contact-form] turnstile_token_received', { value });
        },
        'error-callback': () => {
          setFieldErrors((previous) => ({
            ...previous,
            turnstileToken: 'Verification failed. Retry the challenge.',
          }));
        },
        'expired-callback': () => {
          setToken('');
          const widgetId = widgetIdRef.current;
          if (turnstile && widgetId) {
            turnstile.reset(widgetId);
          }
          setFieldErrors((previous) => ({
            ...previous,
            turnstileToken: 'Challenge expired. Please complete it again.',
          }));
        },
      });

      widgetIdRef.current = id;
      console.info('[contact-form] turnstile_initialized', { widgetId: id, siteKey });
    };

    const existing = document.getElementById(scriptId);
    if (existing instanceof HTMLScriptElement) {
      if (existing.dataset.loaded === 'true') {
        initialize();
      } else {
        existing.addEventListener('load', initialize, { once: true });
      }
      return () => {
        existing.removeEventListener('load', initialize);
      };
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.dataset.loaded = 'false';
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      initialize();
    });
    document.head.appendChild(script);

    if (typeof window !== 'undefined' && window.turnstile) {
      initialize();
    }

    return () => {
      script.removeEventListener('load', initialize);
    };
  }, [siteKey]);

  useEffect(() => {
    if (typeof window === 'undefined' || !import.meta.env.DEV) return;

    window.__CONTACT_FORM_SET_TOKEN__ = (value: string) => {
      setToken(value);
      setFieldErrors((previous) => ({ ...previous, turnstileToken: '' }));
      console.info('[contact-form] test_hook_token_applied', { value });
    };

    return () => {
      delete window.__CONTACT_FORM_SET_TOKEN__;
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('submitting');
    setFieldErrors({});
    setGlobalMessage('');

    const form = formRef.current;
    if (!form) {
      setStatus('error');
      setGlobalMessage('Form reference unavailable. Refresh and try again.');
      return;
    }

    const formData = new FormData(form);
    const payloadEntries = Object.fromEntries(formData.entries()) as Record<
      string,
      FormDataEntryValue
    >;

    const rawIntent = getStringValue(payloadEntries.intent);
    const selectedIntent = (rawIntent ? (rawIntent as ContactIntent) : intent) ?? DEFAULT_INTENT;
    const normalizedPayload: Record<string, unknown> = {
      name: getStringValue(payloadEntries.name),
      email: getStringValue(payloadEntries.email),
      company: getStringValue(payloadEntries.company),
      intent: selectedIntent,
      message: getStringValue(payloadEntries.message),
      honeypot: getStringValue(payloadEntries.honeypot) || undefined,
      turnstileToken: token,
    };

    if (!token) {
      setFieldErrors((previous) => ({
        ...previous,
        turnstileToken: 'Complete the verification challenge.',
      }));
      setStatus('error');
      setGlobalMessage('Complete the verification challenge before submitting.');
      logEvent('contact_form_validation_failed', { issues: { turnstileToken: 'missing' } });
      return;
    }

    const validation = contactFormSchema.safeParse(normalizedPayload);

    if (!validation.success) {
      const flattened = validation.error.flatten();
      const fieldIssue: FieldErrors = {};
      for (const [key, messages] of Object.entries(flattened.fieldErrors)) {
        if (messages && messages.length > 0) {
          fieldIssue[key] = messages[0];
        }
      }
      setFieldErrors(fieldIssue);
      setGlobalMessage('Double-check the highlighted fields to continue.');
      setStatus('error');
      logEvent('contact_form_validation_failed', { issues: fieldIssue });
      return;
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          ...validation.data,
          turnstileToken: token,
          sourceUrl: typeof window !== 'undefined' ? window.location.href : undefined,
        }),
      });

      if (!response.ok) {
        const raw = await response.json().catch(() => null);
        const message = isErrorResponse(raw)
          ? raw.error
          : 'Unable to submit your request right now.';
        setStatus('error');
        setGlobalMessage(message);
        logEvent('contact_form_submission_failed', {
          message,
          status: response.status,
          role: rolePreset?.id,
        });
        return;
      }

      setStatus('success');
      setGlobalMessage('Request received. Our RevOps team will follow up shortly.');
      logEvent('contact_form_submission_succeeded', {
        intent: validation.data.intent,
        role: rolePreset?.id,
      });
      const analyticsEvent = resolveAnalyticsEventForIntent(
        validation.data.intent as ContactIntent,
      );
      const emailDomain = validation.data.email.split('@')[1]?.toLowerCase() ?? 'unknown';
      void trackAnalyticsEvent({
        event: analyticsEvent,
        payload: {
          intent: validation.data.intent,
          company: validation.data.company,
          domain: emailDomain,
          role: rolePreset?.id,
        },
        consentService: 'pipeline-alerts',
        onOptOut: () => {
          console.info('[contact-form] analytics_skipped_due_to_consent', {
            event: analyticsEvent,
            intent: validation.data.intent,
          });
        },
      });
      form.reset();
      setEmail('');
      setToken('');
      setIntent(intentPresetRef.current.intent);
      setRolePreset(intentPresetRef.current.rolePreset ?? null);
      if (typeof window !== 'undefined') {
        const turnstile = window.turnstile;
        const widgetId = widgetIdRef.current;
        if (turnstile && widgetId) {
          turnstile.reset(widgetId);
        }
      }
    } catch (error) {
      console.error('Contact form submission error', error);
      setStatus('error');
      setGlobalMessage('Network error submitting the form. Try again in a moment.');
      logEvent('contact_form_submission_failed', {
        message: 'network_error',
        role: rolePreset?.id,
      });
    }
  };

  const emailHelpText = useMemo(() => {
    if (!domainAssessment) {
      return 'We prioritize corporate email addresses to streamline routing.';
    }

    if (domainAssessment.classification === 'block') {
      return 'Disposable or personal domains are blocked. Use a corporate email to continue.';
    }

    if (domainAssessment.classification === 'review') {
      return 'We will run additional checks on this domain before routing to RevOps.';
    }

    return 'Recognized corporate domain. Expect a prioritized follow-up.';
  }, [domainAssessment]);

  /**
   * Tie assistive tech feedback loops to the `role="status"` message so validation errors are
   * announced immediately. We prefer referencing the id via a constant so the JSX stays readable
   * while keeping form + status wiring in sync, and the sr-only fallback keeps the reference valid
   * even before users interact with the form.
   */
  const statusRegionId = 'contact-form-status';

  /**
   * Compose `aria-describedby` values from optional base helper ids and conditional error message
   * ids so screen readers announce the full guidance context when validation issues surface.
   */
  const resolveDescribedBy = (...ids: Array<string | false | null | undefined>) => {
    const filtered = ids.filter(Boolean) as string[];
    return filtered.length > 0 ? filtered.join(' ') : undefined;
  };

  return (
    <form
      ref={formRef}
      action={endpoint}
      method="post"
      noValidate
      className="grid gap-6 rounded-xl border border-slate-700 bg-slate-900/60 p-6 shadow-lg shadow-slate-950/40"
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
      aria-labelledby={legendId}
      aria-describedby={statusRegionId}
      data-js-ready="false"
    >
      <input type="hidden" name="turnstileToken" value={token} />
      <fieldset className="grid gap-4">
        <legend id={legendId} className="text-lg font-semibold text-white">
          Share how we can help
        </legend>

        {rolePreset && (
          <aside
            className="grid gap-3 rounded-lg border border-sky-700/40 bg-sky-900/20 p-4 text-sky-100"
            data-analytics-block="contact-role-preset"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-300">
              Tailored for {rolePreset.label}
            </p>
            <h3 className="text-lg font-semibold text-white">{rolePreset.contact.headline}</h3>
            <p className="text-sm text-slate-200">{rolePreset.contact.message}</p>
            <ul className="grid gap-2 text-sm text-sky-100">
              {rolePreset.contact.bullets.map((bullet) => (
                <li
                  key={bullet}
                  className="flex items-start gap-2 rounded-md border border-sky-800/40 bg-sky-900/30 p-3 text-left"
                  data-analytics-id={`contact-role-${rolePreset.id}-bullet-${bullet
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')}`}
                >
                  <span
                    aria-hidden="true"
                    className="mt-1 inline-flex h-2 w-2 flex-none rounded-full bg-sky-400"
                  />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </aside>
        )}

        <p
          id={statusRegionId}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          data-state={status}
          className={
            globalMessage
              ? `rounded-md border p-3 text-sm ${
                  status === 'success'
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-200'
                    : 'border-amber-500 bg-amber-500/10 text-amber-200'
                }`
              : 'sr-only'
          }
        >
          {globalMessage || statusFallbackMessage}
        </p>

        <div className="grid gap-2">
          <label className="text-sm font-medium text-slate-200" htmlFor="name">
            Full name
          </label>
          <input
            id="name"
            name="name"
            required
            className="rounded-md border border-slate-700 bg-slate-800/80 px-3 py-2 text-white shadow-inner focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            onChange={() => {
              setFieldErrors((previous) => ({ ...previous, name: '' }));
            }}
            aria-invalid={fieldErrors.name ? 'true' : undefined}
            data-error-state={fieldErrors.name ? 'error' : undefined}
            aria-describedby={resolveDescribedBy(fieldErrors.name && FIELD_ERROR_IDS.name)}
          />
          {fieldErrors.name && (
            <p id={FIELD_ERROR_IDS.name} className="text-sm text-amber-300">
              {fieldErrors.name}
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium text-slate-200" htmlFor="email">
            Business email
          </label>
          <input
            id="email"
            name="email"
            required
            type="email"
            className="rounded-md border border-slate-700 bg-slate-800/80 px-3 py-2 text-white shadow-inner focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            onChange={(event) => {
              setEmail(event.currentTarget.value);
              setFieldErrors((previous) => ({ ...previous, email: '' }));
            }}
            aria-invalid={fieldErrors.email ? 'true' : undefined}
            data-error-state={fieldErrors.email ? 'error' : undefined}
            aria-describedby={resolveDescribedBy('email-help', fieldErrors.email && FIELD_ERROR_IDS.email)}
          />
          <p id="email-help" className="text-sm text-slate-400">
            {emailHelpText}
          </p>
          {fieldErrors.email && (
            <p id={FIELD_ERROR_IDS.email} className="text-sm text-amber-300">
              {fieldErrors.email}
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium text-slate-200" htmlFor="company">
            Company
          </label>
          <input
            id="company"
            name="company"
            required
            className="rounded-md border border-slate-700 bg-slate-800/80 px-3 py-2 text-white shadow-inner focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            onChange={() => setFieldErrors((previous) => ({ ...previous, company: '' }))}
            aria-invalid={fieldErrors.company ? 'true' : undefined}
            data-error-state={fieldErrors.company ? 'error' : undefined}
            aria-describedby={resolveDescribedBy(
              fieldErrors.company && FIELD_ERROR_IDS.company,
            )}
          />
          {fieldErrors.company && (
            <p id={FIELD_ERROR_IDS.company} className="text-sm text-amber-300">
              {fieldErrors.company}
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium text-slate-200" htmlFor="intent">
            What brings you to Apotheon?
          </label>
          <select
            id="intent"
            name="intent"
            value={intent}
            className="rounded-md border border-slate-700 bg-slate-800/80 px-3 py-2 text-white focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            onChange={(event) => {
              const nextIntent = event.currentTarget.value as ContactIntent;
              setIntent(nextIntent);
              setFieldErrors((previous) => ({ ...previous, intent: '' }));
              logEvent('contact_form_intent_changed', { intent: nextIntent });
            }}
            aria-invalid={fieldErrors.intent ? 'true' : undefined}
            data-error-state={fieldErrors.intent ? 'error' : undefined}
            aria-describedby={resolveDescribedBy(fieldErrors.intent && FIELD_ERROR_IDS.intent)}
          >
            <option value="demo">Product demo</option>
            <option value="partnership">Partner with us</option>
            <option value="media">Media inquiry</option>
            <option value="careers">Careers</option>
            <option value="investor">Investor relations</option>
            <option value="support">Customer support</option>
          </select>
          {fieldErrors.intent && (
            <p id={FIELD_ERROR_IDS.intent} className="text-sm text-amber-300">
              {fieldErrors.intent}
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium text-slate-200" htmlFor="message">
            How can we accelerate your roadmap?
          </label>
          <textarea
            id="message"
            name="message"
            required
            minLength={40}
            className="min-h-[150px] rounded-md border border-slate-700 bg-slate-800/80 px-3 py-2 text-white shadow-inner focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            onChange={() => setFieldErrors((previous) => ({ ...previous, message: '' }))}
            aria-invalid={fieldErrors.message ? 'true' : undefined}
            data-error-state={fieldErrors.message ? 'error' : undefined}
            aria-describedby={resolveDescribedBy(fieldErrors.message && FIELD_ERROR_IDS.message)}
          />
          {fieldErrors.message && (
            <p id={FIELD_ERROR_IDS.message} className="text-sm text-amber-300">
              {fieldErrors.message}
            </p>
          )}
        </div>

        <div aria-hidden="true" className="hidden">
          <label htmlFor="contact-honeypot">Leave blank</label>
          <input id="contact-honeypot" name="honeypot" tabIndex={-1} autoComplete="off" />
        </div>

        <div className="grid gap-2">
          <span className="text-sm font-medium text-slate-200">Verification</span>
          <div
            ref={turnstileRef}
            className="min-h-[65px]"
            aria-invalid={fieldErrors.turnstileToken ? 'true' : undefined}
            data-error-state={fieldErrors.turnstileToken ? 'error' : undefined}
            aria-describedby={resolveDescribedBy(
              fieldErrors.turnstileToken && FIELD_ERROR_IDS.turnstileToken,
            )}
          />
          {fieldErrors.turnstileToken && (
            <p id={FIELD_ERROR_IDS.turnstileToken} className="text-sm text-amber-300">
              {fieldErrors.turnstileToken}
            </p>
          )}
          <noscript>
            <p className="rounded-md border border-amber-500 bg-amber-500/10 p-3 text-sm text-amber-200">
              JavaScript is required to complete the verification challenge. Email
              security@apotheon.ai for manual intake if scripting is disabled.
            </p>
          </noscript>
        </div>
      </fieldset>

      <button
        type="submit"
        className="inline-flex items-center justify-center rounded-md bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-600"
        disabled={status === 'submitting'}
        aria-live="polite"
      >
        {status === 'submitting' ? 'Submitting…' : 'Send message'}
      </button>
    </form>
  );
}
