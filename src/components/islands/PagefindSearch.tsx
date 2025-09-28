import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ChangeEvent,
} from 'react';

import { trackAnalyticsEvent } from '../../utils/analytics';

/**
 * `PagefindSearch` React island
 * -----------------------------
 *
 * The header and mobile navigation drawer both hydrate this island so every user, regardless of
 * viewport size, receives the same search semantics. Pagefind's WASM bundle streams results as soon
 * as each hit resolves; to preserve that behaviour we intentionally append to the results array one
 * item at a time instead of waiting for the entire payload.
 */

const MIN_QUERY_LENGTH = 3;
const RESULT_LIMIT = 10;
const PAGEFIND_RUNTIME_ENTRY = '/pagefind/pagefind.js';

/**
 * Curated suggestions provide deterministic fallbacks when the index cannot locate a match. The
 * links lean on cornerstone documentation so both product marketing and investors receive high-value
 * next steps even without live search results.
 */
const SUGGESTED_LINKS: ReadonlyArray<{
  readonly label: string;
  readonly description: string;
  readonly href: string;
}> = [
  {
    label: 'Launch guide',
    description: 'End-to-end GTM automation blueprint with telemetry hooks.',
    href: '/docs/',
  },
  {
    label: 'Platform overview',
    description: 'Executive-ready summary of Apotheon.ai capabilities.',
    href: '/solutions/',
  },
  {
    label: 'Blog insights',
    description: 'Analyst notes on compliance, automation, and AI safety.',
    href: '/blog/',
  },
  {
    label: 'Contact sales',
    description: 'Coordinate a governed pilot with RevOps automation pre-wired.',
    href: '/about/contact/',
  },
];

export interface PagefindResultHandle {
  readonly id: string;
  data: () => Promise<PagefindResultPayload>;
}

export interface PagefindResultPayload {
  readonly url?: string;
  readonly meta?: Record<string, string | undefined>;
  readonly excerpt?: string;
  readonly content?: string;
}

export interface PagefindClient {
  init?: (options?: { readonly baseUrl?: string }) => Promise<unknown>;
  search: (query: string) => Promise<{
    readonly results: ReadonlyArray<PagefindResultHandle>;
  }>;
}

declare global {
  interface Window {
    __APOTHEON_PAGEFIND__?: PagefindClient;
  }
  // eslint-disable-next-line no-var
  var __APOTHEON_PAGEFIND__: PagefindClient | undefined;
}

interface DisplayResult {
  readonly id: string;
  readonly url: string;
  readonly title: string;
  readonly excerpt: string;
}

type SearchStatus = 'idle' | 'loading' | 'results' | 'empty' | 'error';

export default function PagefindSearch(): JSX.Element {
  const [hydrated, setHydrated] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [status, setStatus] = useState<SearchStatus>('idle');
  const [results, setResults] = useState<DisplayResult[]>([]);
  const [analyticsNotice, setAnalyticsNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /**
   * The symbol stored in `searchTokenRef` lets us bail out of stale async work when the user submits
   * a new query mid-flight. Symbols remain unique across renders, giving us a stable equality check
   * without tracking counters manually.
   */
  const searchTokenRef = useRef<symbol | null>(null);
  const clientRef = useRef<PagefindClient | null>(null);
  const clientInitRef = useRef<Promise<PagefindClient> | null>(null);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const normaliseResult = useCallback(
    (payload: PagefindResultPayload, id: string): DisplayResult => {
      const title = payload.meta?.title?.trim() ?? payload.meta?.Title?.trim();
      const description = payload.meta?.description?.trim() ?? payload.meta?.Description?.trim();

      return {
        id,
        url: payload.url ?? '#',
        title: title && title.length > 0 ? title : (payload.url ?? 'Untitled result'),
        excerpt:
          description && description.length > 0
            ? description
            : (payload.excerpt?.trim() ??
              payload.content?.slice(0, 140)?.trim() ??
              'No preview available.'),
      };
    },
    [],
  );

  const ensureClient = useCallback(async (): Promise<PagefindClient> => {
    if (clientRef.current) {
      return clientRef.current;
    }

    if (typeof window === 'undefined') {
      throw new Error('Pagefind search requires a browser environment.');
    }

    const cached = window.__APOTHEON_PAGEFIND__ ?? globalThis.__APOTHEON_PAGEFIND__;
    if (cached) {
      clientRef.current = cached;
      return cached;
    }

    if (!clientInitRef.current) {
      clientInitRef.current = (async () => {
        try {
          const runtimeEntry = PAGEFIND_RUNTIME_ENTRY;
          const module = (await import(
            /* @vite-ignore */ runtimeEntry
          )) as unknown as PagefindClient;
          if (typeof module.init === 'function') {
            await module.init({ baseUrl: '/pagefind/' });
          }
          window.__APOTHEON_PAGEFIND__ = module;
          globalThis.__APOTHEON_PAGEFIND__ = module;
          clientRef.current = module;
          return module;
        } catch (error) {
          console.error('[pagefind-search] failed to load Pagefind runtime', error);
          throw error;
        }
      })();
    }

    return clientInitRef.current;
  }, []);

  const logAnalytics = useCallback(
    async (resolution: {
      query: string;
      status: Exclude<SearchStatus, 'idle'>;
      resultCount: number;
    }) => {
      setAnalyticsNotice(null);
      try {
        const outcome = await trackAnalyticsEvent({
          event: 'search_query',
          payload: {
            query: resolution.query,
            status: resolution.status,
            resultCount: resolution.resultCount,
          },
          onOptOut: () => {
            console.info('[pagefind-search] analytics_skipped_due_to_consent', resolution);
            setAnalyticsNotice(
              'Telemetry respects your consent settings; analytics logging was skipped.',
            );
          },
        });

        if (!outcome.delivered) {
          console.warn('[pagefind-search] analytics_delivery_failed', outcome);
        }
      } catch (error) {
        console.error('[pagefind-search] analytics_error', error);
      }
    },
    [],
  );

  useEffect(() => {
    const trimmed = inputValue.trim();

    if (trimmed.length === 0) {
      setStatus('idle');
      setActiveQuery('');
      setResults([]);
      setErrorMessage(null);
      return;
    }

    if (trimmed.length < MIN_QUERY_LENGTH) {
      setStatus('idle');
      setActiveQuery(trimmed);
      setResults([]);
      setErrorMessage(null);
      return;
    }

    const token = Symbol(trimmed);
    searchTokenRef.current = token;
    setStatus('loading');
    setActiveQuery(trimmed);
    setResults([]);
    setErrorMessage(null);

    void (async () => {
      try {
        const client = await ensureClient();
        if (!Object.is(searchTokenRef.current, token)) {
          return;
        }

        const response = await client.search(trimmed);
        if (!Object.is(searchTokenRef.current, token)) {
          return;
        }

        const handles = response?.results ?? [];
        if (handles.length === 0) {
          setStatus('empty');
          await logAnalytics({ query: trimmed, status: 'empty', resultCount: 0 });
          return;
        }

        let resolved = 0;
        for (const handle of handles.slice(0, RESULT_LIMIT)) {
          const payload = await handle.data();
          if (!Object.is(searchTokenRef.current, token)) {
            return;
          }
          resolved += 1;
          setResults((current) => [...current, normaliseResult(payload, handle.id)]);
        }

        setStatus('results');
        await logAnalytics({ query: trimmed, status: 'results', resultCount: resolved });
      } catch (error) {
        if (!Object.is(searchTokenRef.current, token)) {
          return;
        }
        const reason = error instanceof Error ? error.message : 'Unknown search failure';
        setStatus('error');
        setErrorMessage(reason);
        await logAnalytics({ query: trimmed, status: 'error', resultCount: 0 });
      }
    })();
  }, [ensureClient, inputValue, logAnalytics, normaliseResult]);

  const handleSubmit = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  }, []);

  const handleInputChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
  }, []);

  const statusDescription = useMemo(() => {
    if (status === 'idle' && activeQuery.length >= MIN_QUERY_LENGTH) {
      return `Searching for “${activeQuery}”…`;
    }
    if (status === 'loading') {
      return `Searching for “${activeQuery}”…`;
    }
    if (status === 'results') {
      return results.length === 1
        ? `Found 1 match for “${activeQuery}”.`
        : `Found ${results.length} matches for “${activeQuery}”.`;
    }
    if (status === 'empty') {
      return `No matches for “${activeQuery}”.`;
    }
    if (status === 'error') {
      return `Search unavailable. ${errorMessage ?? ''}`.trim();
    }
    return 'Type at least three characters to search the knowledge base.';
  }, [activeQuery, errorMessage, results.length, status]);

  return (
    <section
      data-testid="pagefind-search"
      data-hydrated={hydrated ? 'true' : 'false'}
      aria-labelledby="pagefind-search-label"
      className="flex w-full flex-col gap-space-2xs"
    >
      <form role="search" aria-label="Site search" onSubmit={handleSubmit} className="contents">
        <div className="flex flex-col gap-space-3xs">
          <label
            id="pagefind-search-label"
            htmlFor="pagefind-search-input"
            className="text-caption font-semibold uppercase tracking-wide text-ink-muted"
          >
            Search Apotheon.ai
          </label>
          <p className="text-caption text-ink-muted">
            Use Tab to navigate suggestions. Results stream in-place so keyboard focus never jumps.
          </p>
        </div>
        <input
          id="pagefind-search-input"
          name="query"
          type="search"
          value={inputValue}
          onChange={handleInputChange}
          placeholder="Search docs, blog updates, and product overviews"
          autoComplete="off"
          spellCheck="false"
          className="w-full rounded-radius-md border border-border-subtle bg-surface-base px-space-sm py-space-2xs text-body-sm text-ink-primary shadow-elevation-1 placeholder:text-ink-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
          aria-describedby="pagefind-search-status"
          aria-busy={status === 'loading'}
        />
      </form>

      <div
        id="pagefind-search-status"
        role="status"
        aria-live="polite"
        className="text-caption text-ink-muted"
      >
        {statusDescription}
      </div>

      {analyticsNotice ? <p className="text-caption text-ink-muted">{analyticsNotice}</p> : null}

      <ul
        data-testid="pagefind-search-results"
        className="flex flex-col gap-space-2xs"
        aria-label="Search results"
      >
        {results.map((result) => (
          <li
            key={result.id}
            className="rounded-radius-md border border-border-subtle bg-surface-raised/60 p-space-sm"
          >
            <a
              href={result.url}
              className="block text-left text-body-sm text-ink-primary transition hover:text-accent-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
            >
              <span className="block text-body-sm font-semibold text-ink-primary">
                {result.title}
              </span>
              <span className="mt-1 block text-caption text-ink-muted">{result.excerpt}</span>
            </a>
          </li>
        ))}
      </ul>

      {status === 'empty' ? (
        <div
          data-testid="pagefind-search-suggestions"
          className="rounded-radius-md border border-dashed border-border-subtle/70 bg-surface-raised/40 p-space-sm"
        >
          <p className="text-body-sm font-semibold text-ink-primary">
            Try one of these high-signal destinations while the index catches up:
          </p>
          <ul className="mt-space-3xs flex flex-col gap-space-3xs">
            {SUGGESTED_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="block rounded-radius-md px-space-sm py-space-2xs text-body-sm font-medium text-ink-primary transition hover:bg-surface-raised/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
                >
                  <span className="block">{link.label}</span>
                  <span className="block text-caption text-ink-muted">{link.description}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
