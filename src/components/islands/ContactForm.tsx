import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

import { trackAnalyticsEvent } from '../../utils/analytics';
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

const DEFAULT_ENDPOINT = import.meta.env.PUBLIC_CONTACT_ENDPOINT ?? '/api/contact';
const DEFAULT_SITE_KEY = import.meta.env.PUBLIC_TURNSTILE_SITE_KEY ?? 'test-site-key';

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

  const domainAssessment = useMemo(() => {
    if (!email) return null;
    return analyzeDomain(email);
  }, [email]);

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

    const normalizedPayload: Record<string, unknown> = {
      name: getStringValue(payloadEntries.name),
      email: getStringValue(payloadEntries.email),
      company: getStringValue(payloadEntries.company),
      intent: getStringValue(payloadEntries.intent) || 'demo',
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
        logEvent('contact_form_submission_failed', { message, status: response.status });
        return;
      }

      setStatus('success');
      setGlobalMessage('Request received. Our RevOps team will follow up shortly.');
      logEvent('contact_form_submission_succeeded', { intent: validation.data.intent });
      const analyticsEvent = validation.data.intent === 'investor' ? 'lead_investor' : 'lead_demo';
      const emailDomain = validation.data.email.split('@')[1]?.toLowerCase() ?? 'unknown';
      void trackAnalyticsEvent({
        event: analyticsEvent,
        payload: {
          intent: validation.data.intent,
          company: validation.data.company,
          domain: emailDomain,
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
      logEvent('contact_form_submission_failed', { message: 'network_error' });
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
      aria-describedby="contact-form-status"
    >
      <input type="hidden" name="turnstileToken" value={token} />
      <fieldset className="grid gap-4">
        <legend className="text-lg font-semibold text-white">Share how we can help</legend>

        {globalMessage && (
          <p
            id="contact-form-status"
            role="status"
            className={`rounded-md border p-3 text-sm ${
              status === 'success'
                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-200'
                : 'border-amber-500 bg-amber-500/10 text-amber-200'
            }`}
          >
            {globalMessage}
          </p>
        )}

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
          />
          {fieldErrors.name && <p className="text-sm text-amber-300">{fieldErrors.name}</p>}
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
            aria-describedby="email-help"
          />
          <p id="email-help" className="text-sm text-slate-400">
            {emailHelpText}
          </p>
          {fieldErrors.email && <p className="text-sm text-amber-300">{fieldErrors.email}</p>}
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
          />
          {fieldErrors.company && <p className="text-sm text-amber-300">{fieldErrors.company}</p>}
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium text-slate-200" htmlFor="intent">
            What brings you to Apotheon?
          </label>
          <select
            id="intent"
            name="intent"
            defaultValue="demo"
            className="rounded-md border border-slate-700 bg-slate-800/80 px-3 py-2 text-white focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="demo">Product demo</option>
            <option value="partnership">Partner with us</option>
            <option value="media">Media inquiry</option>
            <option value="careers">Careers</option>
            <option value="investor">Investor relations</option>
            <option value="support">Customer support</option>
          </select>
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
          />
          {fieldErrors.message && <p className="text-sm text-amber-300">{fieldErrors.message}</p>}
        </div>

        <div aria-hidden="true" className="hidden">
          <label htmlFor="contact-honeypot">Leave blank</label>
          <input id="contact-honeypot" name="honeypot" tabIndex={-1} autoComplete="off" />
        </div>

        <div className="grid gap-2">
          <span className="text-sm font-medium text-slate-200">Verification</span>
          <div ref={turnstileRef} className="min-h-[65px]" />
          {fieldErrors.turnstileToken && (
            <p className="text-sm text-amber-300">{fieldErrors.turnstileToken}</p>
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
