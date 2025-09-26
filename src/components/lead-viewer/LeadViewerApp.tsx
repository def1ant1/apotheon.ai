import { useEffect, useMemo, useState, type FormEvent } from 'react';

const API_BASE = import.meta.env.PUBLIC_LEAD_VIEWER_API_BASE ?? '/api/lead-viewer';
const STORAGE_KEY = 'apotheon:lead-viewer:auth';

interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

interface ContactEntry {
  id: string;
  name: string;
  email: string;
  company: string;
  intent: string;
  message: string;
  domain: string;
  domainClassification: string;
  domainFlags: string;
  domainRationale: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  sourceUrl: string | null;
  utm: string | null;
}

interface WhitepaperEntry {
  id: string;
  whitepaperSlug: string;
  whitepaperTitle: string;
  name: string;
  email: string;
  company: string;
  role: string;
  justification: string;
  domain: string;
  domainClassification: string;
  domainFlags: string;
  domainRationale: string;
  ipAddress: string | null;
  userAgent: string | null;
  marketingOptIn: boolean;
  signedUrlExpiresAt: string;
  assetObjectKey: string;
  sourceUrl: string | null;
  utm: string | null;
  createdAt: string;
}

interface LeadViewerResponse {
  contact: { entries: ContactEntry[]; pagination: PaginationMeta };
  whitepapers: { entries: WhitepaperEntry[]; pagination: PaginationMeta };
  audit: { actor: string; ip: string | null; userAgent: string | null; requestId: string };
}

function encodeCredentials(username: string, password: string): string {
  return typeof window === 'undefined' ? '' : btoa(`${username}:${password}`);
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function buildCsvRow(values: Array<string | number | null | undefined>): string {
  return values
    .map((value) => {
      if (value === null || value === undefined) return '""';
      const stringValue = String(value);
      const escaped = stringValue.replace(/"/g, '""');
      return `"${escaped}"`;
    })
    .join(',');
}

function downloadCsv(filename: string, rows: string[][]): void {
  const csvContent = rows.map((row) => buildCsvRow(row)).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function renderContactCsv(entries: ContactEntry[]): string[][] {
  return [
    [
      'Submission ID',
      'Name',
      'Email',
      'Company',
      'Intent',
      'Message',
      'Domain',
      'Domain Classification',
      'Domain Flags',
      'Domain Rationale',
      'IP Address',
      'User Agent',
      'Created At',
      'Source URL',
      'UTM',
    ],
    ...entries.map((entry) => [
      entry.id,
      entry.name,
      entry.email,
      entry.company,
      entry.intent,
      entry.message,
      entry.domain,
      entry.domainClassification,
      entry.domainFlags,
      entry.domainRationale,
      entry.ipAddress ?? '',
      entry.userAgent ?? '',
      entry.createdAt,
      entry.sourceUrl ?? '',
      entry.utm ?? '',
    ]),
  ];
}

function renderWhitepaperCsv(entries: WhitepaperEntry[]): string[][] {
  return [
    [
      'Request ID',
      'Whitepaper Slug',
      'Whitepaper Title',
      'Name',
      'Email',
      'Company',
      'Role',
      'Justification',
      'Domain',
      'Domain Classification',
      'Domain Flags',
      'Domain Rationale',
      'Marketing Opt-In',
      'Signed URL Expires At',
      'Asset Object Key',
      'IP Address',
      'User Agent',
      'Source URL',
      'UTM',
      'Created At',
    ],
    ...entries.map((entry) => [
      entry.id,
      entry.whitepaperSlug,
      entry.whitepaperTitle,
      entry.name,
      entry.email,
      entry.company,
      entry.role,
      entry.justification,
      entry.domain,
      entry.domainClassification,
      entry.domainFlags,
      entry.domainRationale,
      entry.marketingOptIn ? 'yes' : 'no',
      entry.signedUrlExpiresAt,
      entry.assetObjectKey,
      entry.ipAddress ?? '',
      entry.userAgent ?? '',
      entry.sourceUrl ?? '',
      entry.utm ?? '',
      entry.createdAt,
    ]),
  ];
}

function persistCredentials(encoded: string | null) {
  if (typeof window === 'undefined') return;
  if (encoded) {
    sessionStorage.setItem(STORAGE_KEY, encoded);
  } else {
    sessionStorage.removeItem(STORAGE_KEY);
  }
}

function readStoredCredentials(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(STORAGE_KEY);
}

async function requestLeadData(
  authToken: string,
  params: { page: number; perPage: number; search: string },
  signal: AbortSignal,
): Promise<LeadViewerResponse> {
  const searchParams = new URLSearchParams();
  searchParams.set('page', String(params.page));
  searchParams.set('perPage', String(params.perPage));
  if (params.search.length > 0) {
    searchParams.set('search', params.search);
  }

  const response = await fetch(`${API_BASE}?${searchParams.toString()}`, {
    method: 'GET',
    headers: {
      Authorization: `Basic ${authToken}`,
      Accept: 'application/json',
    },
    credentials: 'include',
    signal,
  });

  if (!response.ok) {
    const payload = await response.text();
    try {
      const parsed = JSON.parse(payload) as { error?: string };
      throw new Error(parsed.error ?? `Request failed with status ${response.status}`);
    } catch {
      throw new Error(payload || `Request failed with status ${response.status}`);
    }
  }

  const body: LeadViewerResponse = await response.json();
  return body;
}

export default function LeadViewerApp() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authToken, setAuthToken] = useState<string | null>(() => readStoredCredentials());
  const [data, setData] = useState<LeadViewerResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);

  // Debounce search input so we do not spam the Worker with requests on every keystroke.
  useEffect(() => {
    const handle = window.setTimeout(() => {
      setSearchTerm(searchInput.trim());
      setPage(1);
    }, 400);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    if (!authToken) {
      setData(null);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    requestLeadData(authToken, { page, perPage, search: searchTerm }, controller.signal)
      .then((result) => {
        setData(result);
      })
      .catch((cause) => {
        if (controller.signal.aborted) return;
        setData(null);
        setError(cause instanceof Error ? cause.message : 'Failed to load leads');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [authToken, page, perPage, searchTerm]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const encoded = encodeCredentials(username, password);
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    try {
      const result = await requestLeadData(
        encoded,
        { page: 1, perPage, search: searchTerm },
        controller.signal,
      );
      setData(result);
      setAuthToken(encoded);
      persistCredentials(encoded);
      setPage(1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Authentication failed');
      setAuthToken(null);
      persistCredentials(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setAuthToken(null);
    persistCredentials(null);
    setUsername('');
    setPassword('');
    setData(null);
  };

  const contactRows = data?.contact.entries ?? [];
  const whitepaperRows = data?.whitepapers.entries ?? [];

  const summary = useMemo(() => {
    if (!data) return null;
    return `Viewing page ${data.contact.pagination.page} of ${data.contact.pagination.totalPages}`;
  }, [data]);

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-100">Lead Viewer</h1>
        <p className="max-w-3xl text-sm text-slate-300">
          Read-only dashboard backed by the Cloudflare Worker. Credentials are validated against the
          Basic Auth allowlist and every request is logged server-side for compliance.
        </p>
        {summary && (
          <p className="text-xs text-emerald-300" role="status">
            {summary}
          </p>
        )}
      </header>

      <form
        className="grid gap-4 md:grid-cols-3"
        onSubmit={(event) => {
          void handleLogin(event);
        }}
        aria-describedby="lead-viewer-login-help"
      >
        <div className="flex flex-col">
          <label htmlFor="lead-viewer-username" className="text-sm font-medium text-slate-200">
            Username
          </label>
          <input
            id="lead-viewer-username"
            className="rounded border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            required
          />
        </div>
        <div className="flex flex-col">
          <label htmlFor="lead-viewer-password" className="text-sm font-medium text-slate-200">
            Password
          </label>
          <input
            id="lead-viewer-password"
            className="rounded border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        <div className="flex items-end gap-3">
          <button
            type="submit"
            className="rounded bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-400 focus:outline-none focus-visible:ring focus-visible:ring-indigo-300"
          >
            Authenticate
          </button>
          <button
            type="button"
            className="rounded border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 focus:outline-none focus-visible:ring focus-visible:ring-indigo-300"
            onClick={handleLogout}
          >
            Clear session
          </button>
        </div>
        <p id="lead-viewer-login-help" className="text-xs text-slate-400 md:col-span-3">
          Credentials are stored in sessionStorage only so browsers forget them when the tab closes.
          Use the Clear session button when stepping away from a shared device.
        </p>
      </form>

      <div className="grid gap-4 md:grid-cols-[2fr,1fr]">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-slate-200">Search leads</span>
          <input
            className="rounded border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
            placeholder="Search name, email, company, or asset"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            disabled={!authToken}
          />
        </label>
        <div className="flex items-end justify-end gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-200">
            Rows per page
            <select
              className="rounded border border-slate-600 bg-slate-900 px-2 py-1 text-slate-100"
              value={perPage}
              onChange={(event) => setPerPage(Number(event.target.value))}
              disabled={!authToken}
            >
              {[10, 25, 50, 100].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded border border-rose-500 bg-rose-950/60 p-4 text-sm text-rose-100"
        >
          {error}
        </div>
      )}

      <div aria-live="polite" className="text-sm text-slate-300">
        {loading && <span>Loading lead datasets…</span>}
      </div>

      {authToken && data && (
        <div className="space-y-10">
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-slate-100">Contact submissions</h2>
              <button
                type="button"
                onClick={() =>
                  downloadCsv('contact-submissions.csv', renderContactCsv(contactRows))
                }
                className="rounded bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-700 focus:outline-none focus-visible:ring focus-visible:ring-indigo-300"
              >
                Export CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-700">
                <caption className="sr-only">Contact submissions</caption>
                <thead className="bg-slate-900">
                  <tr>
                    {[
                      'Name',
                      'Email',
                      'Company',
                      'Intent',
                      'Message',
                      'Domain',
                      'Created',
                      'Source',
                    ].map((heading) => (
                      <th
                        key={heading}
                        scope="col"
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-950">
                  {contactRows.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-900/60">
                      <td className="px-4 py-3 align-top text-sm text-slate-100">{entry.name}</td>
                      <td className="px-4 py-3 align-top text-sm text-indigo-200">
                        <a
                          href={`mailto:${entry.email}`}
                          className="underline hover:text-indigo-100"
                        >
                          {entry.email}
                        </a>
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-slate-100">
                        {entry.company}
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-slate-100">{entry.intent}</td>
                      <td className="whitespace-pre-wrap px-4 py-3 align-top text-sm text-slate-200">
                        {entry.message}
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-slate-200">{entry.domain}</td>
                      <td className="px-4 py-3 align-top text-sm text-slate-300">
                        {formatDate(entry.createdAt)}
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-indigo-200">
                        {entry.sourceUrl ? (
                          <a href={entry.sourceUrl} className="underline hover:text-indigo-100">
                            Source
                          </a>
                        ) : (
                          <span aria-hidden="true">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {contactRows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-center text-sm text-slate-400">
                        No contact submissions match the filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-slate-100">Whitepaper requests</h2>
              <button
                type="button"
                onClick={() =>
                  downloadCsv('whitepaper-requests.csv', renderWhitepaperCsv(whitepaperRows))
                }
                className="rounded bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-700 focus:outline-none focus-visible:ring focus-visible:ring-indigo-300"
              >
                Export CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-700">
                <caption className="sr-only">Whitepaper requests</caption>
                <thead className="bg-slate-900">
                  <tr>
                    {[
                      'Title',
                      'Requester',
                      'Company',
                      'Role',
                      'Justification',
                      'Domain',
                      'Opt-in',
                      'Created',
                    ].map((heading) => (
                      <th
                        key={heading}
                        scope="col"
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-950">
                  {whitepaperRows.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-900/60">
                      <td className="px-4 py-3 align-top text-sm text-slate-100">
                        {entry.whitepaperTitle}
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-slate-100">{entry.name}</td>
                      <td className="px-4 py-3 align-top text-sm text-slate-100">
                        {entry.company}
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-slate-200">{entry.role}</td>
                      <td className="whitespace-pre-wrap px-4 py-3 align-top text-sm text-slate-200">
                        {entry.justification}
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-slate-200">{entry.domain}</td>
                      <td className="px-4 py-3 align-top text-sm text-slate-100">
                        {entry.marketingOptIn ? 'Yes' : 'No'}
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-slate-300">
                        {formatDate(entry.createdAt)}
                      </td>
                    </tr>
                  ))}
                  {whitepaperRows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-center text-sm text-slate-400">
                        No whitepaper requests match the filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <nav
            className="flex flex-wrap items-center justify-between gap-4"
            aria-label="Pagination controls"
          >
            <button
              type="button"
              className="rounded border border-slate-600 px-3 py-2 text-sm font-medium text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1}
            >
              Previous
            </button>
            <p className="text-sm text-slate-300">
              Page {page} of {data.contact.pagination.totalPages}
            </p>
            <button
              type="button"
              className="rounded border border-slate-600 px-3 py-2 text-sm font-medium text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => setPage((current) => current + 1)}
              disabled={page >= data.contact.pagination.totalPages}
            >
              Next
            </button>
          </nav>
        </div>
      )}
    </section>
  );
}
