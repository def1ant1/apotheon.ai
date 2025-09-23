import React, { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

import {
  WHITEPAPER_MANIFEST,
  type WhitepaperManifestEntry,
} from '../../generated/whitepapers.manifest';
import { trackAnalyticsEvent } from '../../utils/analytics';
import { analyzeDomain } from '../../utils/domain-allowlist';
import { whitepaperRequestSchema } from '../../utils/whitepaper-request';

type SubmissionState = 'idle' | 'submitting' | 'success' | 'error';

type FieldErrors = Record<string, string>;

type TurnstileHandle = {
  render(
    container: string | HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      'error-callback'?: () => void;
      'expired-callback'?: () => void;
      appearance?: 'always' | 'execute' | 'interaction-only';
    },
  ): string;
  reset(widgetId?: string): void;
};

const DEFAULT_ENDPOINT = import.meta.env.PUBLIC_WHITEPAPER_ENDPOINT ?? '/api/whitepapers';
const DEFAULT_SITE_KEY = import.meta.env.PUBLIC_TURNSTILE_SITE_KEY ?? 'test-site-key';

function logEvent(event: string, payload: Record<string, unknown>) {
  if (typeof window !== 'undefined') {
    const { dataLayer } = window;
    if (Array.isArray(dataLayer)) {
      dataLayer.push({ event, ...payload });
    }
  }
  console.info(`[whitepaper-form] ${event}`, payload);
}

function isErrorResponse(candidate: unknown): candidate is { error: string } {
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    'error' in candidate &&
    typeof (candidate as { error?: unknown }).error === 'string'
  );
}

function getString(value: FormDataEntryValue | null | undefined): string {
  return typeof value === 'string' ? value : '';
}

function filterManifest(entries: ReadonlyArray<WhitepaperManifestEntry>) {
  const now = Date.now();
  return entries.filter((entry) => {
    if (entry.lifecycle.draft || entry.lifecycle.archived) return false;
    if (!entry.lifecycle.embargoedUntil) return true;
    const embargo = new Date(entry.lifecycle.embargoedUntil);
    return !Number.isFinite(embargo.valueOf()) || embargo.getTime() <= now;
  });
}

export interface WhitepaperRequestFormProps {
  readonly endpoint?: string;
  readonly siteKey?: string;
}

export default function WhitepaperRequestForm({
  endpoint = DEFAULT_ENDPOINT,
  siteKey = DEFAULT_SITE_KEY,
}: WhitepaperRequestFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const turnstileRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [status, setStatus] = useState<SubmissionState>('idle');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [globalMessage, setGlobalMessage] = useState('');
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const manifest = useMemo(() => filterManifest(WHITEPAPER_MANIFEST), []);

  const domainAssessment = useMemo(() => {
    if (!email) return null;
    return analyzeDomain(email);
  }, [email]);

  /**
   * Hook validation messaging into a dedicated status element so announcements remain stable whether
   * users trigger inline errors or a success confirmation.
   */
  const statusRegionId = 'whitepaper-form-status';

  useEffect(() => {
    if (!siteKey || typeof window === 'undefined') return;

    const scriptId = 'cf-turnstile-script';
    const initialize = () => {
      const turnstile = window.turnstile as TurnstileHandle | undefined;
      const container = turnstileRef.current;
      if (!turnstile || !container || widgetIdRef.current) return;

      const id = turnstile.render(container, {
        sitekey: siteKey,
        appearance: 'interaction-only',
        callback(value) {
          setToken(value);
          setFieldErrors((previous) => ({ ...previous, turnstileToken: '' }));
          logEvent('whitepaper_turnstile_token_received', { widgetId: id });
        },
        'error-callback': () => {
          setFieldErrors((previous) => ({
            ...previous,
            turnstileToken: 'Verification failed. Please retry the challenge.',
          }));
        },
        'expired-callback': () => {
          setToken('');
          const turnstileHandle = window.turnstile as TurnstileHandle | undefined;
          if (turnstileHandle && widgetIdRef.current) {
            turnstileHandle.reset(widgetIdRef.current);
          }
          setFieldErrors((previous) => ({
            ...previous,
            turnstileToken: 'Challenge expired. Complete verification again.',
          }));
        },
      });

      widgetIdRef.current = id;
      logEvent('whitepaper_turnstile_initialized', { widgetId: id });
    };

    const existing = document.getElementById(scriptId);
    if (existing instanceof HTMLScriptElement) {
      if (existing.dataset.loaded === 'true') {
        initialize();
      } else {
        existing.addEventListener('load', initialize, { once: true });
      }
      return () => existing.removeEventListener('load', initialize);
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

    if (window.turnstile) {
      initialize();
    }

    return () => {
      script.removeEventListener('load', initialize);
    };
  }, [siteKey]);

  useEffect(() => {
    if (typeof window === 'undefined' || !import.meta.env.DEV) return;

    window.__WHITEPAPER_FORM_SET_TOKEN__ = (value: string) => {
      setToken(value);
      setFieldErrors((previous) => ({ ...previous, turnstileToken: '' }));
      logEvent('whitepaper_turnstile_test_token_applied', { value });
    };

    return () => {
      delete window.__WHITEPAPER_FORM_SET_TOKEN__;
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('submitting');
    setFieldErrors({});
    setGlobalMessage('');
    setDownloadUrl(null);

    const form = formRef.current;
    if (!form) {
      setStatus('error');
      setGlobalMessage('Form reference unavailable. Refresh and try again.');
      return;
    }

    const formData = new FormData(form);
    const payloadEntries = Object.fromEntries(formData.entries());
    const normalized = {
      name: getString(payloadEntries.name),
      email: getString(payloadEntries.email),
      company: getString(payloadEntries.company),
      role: getString(payloadEntries.role),
      justification: getString(payloadEntries.justification),
      whitepaperSlug: getString(payloadEntries.whitepaperSlug),
      marketingOptIn: payloadEntries.marketingOptIn === 'on',
      sourceUrl: typeof window !== 'undefined' ? window.location.href : undefined,
      honeypot: getString(payloadEntries.honeypot) || undefined,
      turnstileToken: token,
    };

    if (!token) {
      setFieldErrors((previous) => ({
        ...previous,
        turnstileToken: 'Complete the verification challenge before submitting.',
      }));
      setStatus('error');
      setGlobalMessage('Complete the verification challenge to continue.');
      logEvent('whitepaper_request_validation_failed', { issues: { turnstileToken: 'missing' } });
      return;
    }

    const validation = whitepaperRequestSchema.safeParse(normalized);
    if (!validation.success) {
      const flattened = validation.error.flatten();
      const issues: FieldErrors = {};
      for (const [key, messages] of Object.entries(flattened.fieldErrors)) {
        if (messages && messages.length > 0) {
          issues[key] = messages[0];
        }
      }
      setFieldErrors(issues);
      setStatus('error');
      setGlobalMessage('Review the highlighted fields to continue.');
      logEvent('whitepaper_request_validation_failed', { issues });
      return;
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ ...validation.data, turnstileToken: token }),
      });

      const raw = await response.json().catch(() => null);
      if (!response.ok || !raw || typeof raw !== 'object') {
        const message = isErrorResponse(raw)
          ? raw.error
          : 'Unable to process your request right now. Please retry soon.';
        setStatus('error');
        setGlobalMessage(message);
        logEvent('whitepaper_request_submission_failed', { status: response.status, message });
        return;
      }

      if ('downloadUrl' in raw && typeof raw.downloadUrl === 'string') {
        setDownloadUrl(raw.downloadUrl);
      }

      setStatus('success');
      setGlobalMessage('Request approved. Your download link is ready below.');
      logEvent('whitepaper_request_submission_succeeded', {
        slug: validation.data.whitepaperSlug,
        marketingOptIn: validation.data.marketingOptIn,
      });
      void trackAnalyticsEvent({
        event: 'whitepaper_download',
        payload: {
          slug: validation.data.whitepaperSlug,
          marketingOptIn: validation.data.marketingOptIn,
          company: validation.data.company,
        },
        consentService: validation.data.marketingOptIn ? 'pipeline-alerts' : 'umami-telemetry',
        onOptOut: () => {
          console.info('[whitepaper-form] analytics_skipped_due_to_consent', {
            slug: validation.data.whitepaperSlug,
          });
        },
      });
      form.reset();
      setEmail('');
      setToken('');
      const turnstileHandle = window.turnstile as TurnstileHandle | undefined;
      if (turnstileHandle && widgetIdRef.current) {
        turnstileHandle.reset(widgetIdRef.current);
      }
    } catch (error) {
      console.error('[whitepaper-form] submission_error', error);
      setStatus('error');
      setGlobalMessage('Network error submitting the request. Try again momentarily.');
      logEvent('whitepaper_request_submission_failed', { message: 'network_error' });
    }
  };

  const emailHelpText = useMemo(() => {
    if (!domainAssessment) {
      return 'Use a corporate email address. Security filters block disposable domains automatically.';
    }

    if (domainAssessment.classification === 'block') {
      return 'Disposable or personal domains are blocked. Provide a corporate email to continue.';
    }

    if (domainAssessment.classification === 'review') {
      return 'We will run additional verification checks for this domain before releasing the asset.';
    }

    return 'Recognized corporate domain detected. Expect prioritized delivery.';
  }, [domainAssessment]);

  return (
    <form
      ref={formRef}
      action={endpoint}
      method="post"
      noValidate
      className="grid gap-6 rounded-xl border border-indigo-900/60 bg-slate-900/70 p-6 shadow-lg shadow-indigo-500/20"
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
      aria-describedby={statusRegionId}
    >
      <input type="hidden" name="turnstileToken" value={token} />
      <fieldset className="grid gap-4">
        <legend className="text-lg font-semibold text-white">Request enterprise whitepapers</legend>

        {globalMessage && (
          <p
            id={statusRegionId}
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
          <label className="text-sm font-medium text-slate-200" htmlFor="whitepaperSlug">
            Which guide do you need?
          </label>
          <select
            id="whitepaperSlug"
            name="whitepaperSlug"
            required
            className="rounded-md border border-slate-700 bg-slate-800/80 px-3 py-2 text-white focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Select a whitepaper</option>
            {manifest.map((entry) => (
              <option key={entry.slug} value={entry.slug}>
                {entry.title}
              </option>
            ))}
          </select>
          {fieldErrors.whitepaperSlug && (
            <p className="text-sm text-amber-300">{fieldErrors.whitepaperSlug}</p>
          )}
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium text-slate-200" htmlFor="name">
            Full name
          </label>
          <input
            id="name"
            name="name"
            required
            className="rounded-md border border-slate-700 bg-slate-800/80 px-3 py-2 text-white focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            onChange={() => setFieldErrors((previous) => ({ ...previous, name: '' }))}
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
            type="email"
            required
            className="rounded-md border border-slate-700 bg-slate-800/80 px-3 py-2 text-white focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            onChange={(event) => {
              setEmail(event.currentTarget.value);
              setFieldErrors((previous) => ({ ...previous, email: '' }));
            }}
            aria-describedby="whitepaper-email-help"
          />
          <p id="whitepaper-email-help" className="text-sm text-slate-400">
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
            className="rounded-md border border-slate-700 bg-slate-800/80 px-3 py-2 text-white focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            onChange={() => setFieldErrors((previous) => ({ ...previous, company: '' }))}
          />
          {fieldErrors.company && <p className="text-sm text-amber-300">{fieldErrors.company}</p>}
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium text-slate-200" htmlFor="role">
            Role or team
          </label>
          <input
            id="role"
            name="role"
            required
            className="rounded-md border border-slate-700 bg-slate-800/80 px-3 py-2 text-white focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            onChange={() => setFieldErrors((previous) => ({ ...previous, role: '' }))}
          />
          {fieldErrors.role && <p className="text-sm text-amber-300">{fieldErrors.role}</p>}
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium text-slate-200" htmlFor="justification">
            How will your team apply this guidance?
          </label>
          <textarea
            id="justification"
            name="justification"
            required
            minLength={40}
            className="min-h-[150px] rounded-md border border-slate-700 bg-slate-800/80 px-3 py-2 text-white shadow-inner focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            onChange={() => setFieldErrors((previous) => ({ ...previous, justification: '' }))}
          />
          <p className="text-sm text-slate-400">
            {/* Marketing + compliance teams read justifications to confirm the request aligns with the asset's intended audience. */}
            Be specific—references to in-flight programs or regulatory mandates accelerate
            approvals.
          </p>
          {fieldErrors.justification && (
            <p className="text-sm text-amber-300">{fieldErrors.justification}</p>
          )}
        </div>

        <label className="inline-flex items-start gap-3 text-sm text-slate-300">
          <input
            type="checkbox"
            name="marketingOptIn"
            className="mt-1 h-4 w-4 rounded border border-slate-600 bg-slate-800 text-indigo-500 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <span>
            Keep me informed about future research, benchmarks, and compliance updates.
            <span className="block text-slate-500">
              We route opt-ins through the RevOps automation stack with documented unsubscribe
              flows.
            </span>
          </span>
        </label>

        <div aria-hidden="true" className="hidden">
          <label htmlFor="whitepaper-honeypot">Leave blank</label>
          <input id="whitepaper-honeypot" name="honeypot" tabIndex={-1} autoComplete="off" />
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
              research@apotheon.ai for manual review.
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
        {status === 'submitting' ? 'Submitting…' : 'Request download'}
      </button>

      {downloadUrl && (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-100">
          <p className="font-semibold">Download link</p>
          <p className="mt-1">
            {/* Compliance reminder: Links expire quickly; encourage teams to store the PDF in approved knowledge bases. */}
            The signed URL below expires shortly. Save the PDF in your approved repository after
            download.
          </p>
          <a
            href={downloadUrl}
            rel="nofollow noopener"
            className="mt-2 inline-flex items-center gap-2 text-emerald-200 underline decoration-emerald-400 decoration-dashed hover:text-emerald-100"
          >
            Access the whitepaper
          </a>
        </div>
      )}
    </form>
  );
}
