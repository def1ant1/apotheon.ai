import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

import { trackAnalyticsEvent } from '../../utils/analytics';

type BlogAnalyticsEventType = 'article_view' | 'interaction' | 'conversion';

type BlogListPost = {
  slug: string;
  title: string;
  description: string;
  publishDate: string;
  tags: string[];
  estimatedReadingMinutes: number;
  author: {
    name: string;
  };
};

type Props = {
  posts: BlogListPost[];
  tags: string[];
};

const dateFormatter = new Intl.DateTimeFormat('en', {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
});

function sortByDate(posts: BlogListPost[], order: 'asc' | 'desc'): BlogListPost[] {
  const modifier = order === 'asc' ? 1 : -1;
  return [...posts].sort((a, b) => {
    const aTime = new Date(a.publishDate).valueOf();
    const bTime = new Date(b.publishDate).valueOf();
    return (aTime - bTime) * modifier;
  });
}

function filterByTag(posts: BlogListPost[], tag: string): BlogListPost[] {
  if (tag === 'all') {
    return posts;
  }
  const normalized = tag.toLowerCase();
  return posts.filter((post) => post.tags.some((value) => value.toLowerCase() === normalized));
}

const BlogIndex = ({ posts, tags }: Props) => {
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [isHydrated, setIsHydrated] = useState(false);
  const sessionIdRef = useRef<string | null>(null);
  const tagSelectId = useId();
  const sortSelectId = useId();

  const generateSessionId = useCallback(() => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }, []);

  // Persist a deterministic session identifier so Worker-side rollups can
  // approximate unique visitors. Session storage keeps it confined to the
  // current tab while remaining resilient to SPA navigations.
  const resolveSessionId = useCallback(() => {
    if (sessionIdRef.current) return sessionIdRef.current;
    if (typeof window === 'undefined') return null;

    try {
      const STORAGE_KEY = 'apotheon.blog.session';
      const existing = window.sessionStorage.getItem(STORAGE_KEY);
      if (existing) {
        sessionIdRef.current = existing;
        return existing;
      }
      const fresh = generateSessionId();
      window.sessionStorage.setItem(STORAGE_KEY, fresh);
      sessionIdRef.current = fresh;
      return fresh;
    } catch (error) {
      console.warn('[blog-analytics] unable to persist session id', error);
      const fallback = generateSessionId();
      sessionIdRef.current = fallback;
      return fallback;
    }
  }, [generateSessionId]);

  // Centralized analytics helper mirrors the patterns used by the contact +
  // whitepaper islands. By pushing to `dataLayer` and the Worker simultaneously
  // we keep marketing's GTM recipes intact while unlocking richer D1 datasets.
  const dispatchAnalytics = useCallback(
    (eventType: BlogAnalyticsEventType, detail: Record<string, unknown>) => {
      if (typeof window === 'undefined') return;

      const sessionId = resolveSessionId();
      if (!sessionId) return;

      const payload = {
        dataset: 'blog',
        events: [
          {
            type: eventType,
            slug: typeof detail.slug === 'string' ? detail.slug : (detail.currentSlug ?? 'index'),
            sessionId,
            occurredAt: new Date().toISOString(),
            identity: {
              domain: detail.domain?.toString(),
            },
            metadata: detail,
          },
        ],
      };

      window.dataLayer = Array.isArray(window.dataLayer) ? window.dataLayer : [];
      window.dataLayer.push({ event: `blog_${eventType}`, ...detail });

      const endpoint = import.meta.env.PUBLIC_BLOG_ANALYTICS_ENDPOINT ?? '/api/blog/analytics';
      void fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch((error) => {
        console.warn('[blog-analytics] beacon failed', error);
      });

      if (eventType === 'interaction' && detail.action === 'index_article_click') {
        void trackAnalyticsEvent({
          event: 'blog_read',
          payload: {
            slug: detail.slug,
            title: detail.title,
          },
          consentService: 'umami-telemetry',
          onOptOut: () => {
            console.info('[blog-index] analytics_skipped_due_to_consent', {
              slug: detail.slug,
            });
          },
        });
      }
    },
    [resolveSessionId],
  );

  useEffect(() => {
    setIsHydrated(true);
    dispatchAnalytics('interaction', {
      action: 'index_view',
      visibleCount: posts.length,
      slug: 'index',
    });
  }, [dispatchAnalytics, posts.length]);

  const sortedPosts = useMemo(() => sortByDate(posts, sortOrder), [posts, sortOrder]);
  const visiblePosts = useMemo(
    () => filterByTag(sortedPosts, selectedTag),
    [sortedPosts, selectedTag],
  );

  const totalLabel = useMemo(() => {
    if (visiblePosts.length === posts.length && selectedTag === 'all') {
      return `${visiblePosts.length} posts`;
    }
    if (visiblePosts.length === 1) {
      return '1 post';
    }
    return `${visiblePosts.length} posts`;
  }, [visiblePosts.length, posts.length, selectedTag]);

  return (
    <div
      className="flex flex-col gap-10"
      data-hydrated={isHydrated ? 'true' : 'false'}
      data-testid="blog-index-root"
    >
      <form
        aria-label="Blog filters"
        className="flex flex-col gap-6 rounded-2xl border border-slate-800 bg-slate-950/40 p-6 text-sm text-slate-300 md:flex-row md:items-center md:justify-between"
      >
        <div className="flex flex-col gap-2">
          <label
            className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-300"
            htmlFor={tagSelectId}
          >
            Filter by tag
          </label>
          <select
            className="min-w-[12rem] rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/40"
            id={tagSelectId}
            name="tag"
            onChange={(event) => {
              const value = event.target.value;
              setSelectedTag(value);
              dispatchAnalytics('interaction', {
                action: 'filter_change',
                tag: value,
                slug: 'index',
              });
            }}
            value={selectedTag}
          >
            <option value="all">All tags</option>
            {tags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label
            className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-300"
            htmlFor={sortSelectId}
          >
            Sort by publish date
          </label>
          <select
            className="min-w-[12rem] rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/40"
            id={sortSelectId}
            name="sort"
            onChange={(event) => {
              const value = event.target.value as 'asc' | 'desc';
              setSortOrder(value);
              dispatchAnalytics('interaction', {
                action: 'sort_change',
                direction: value,
                slug: 'index',
              });
            }}
            value={sortOrder}
          >
            <option value="desc">Newest first</option>
            <option value="asc">Oldest first</option>
          </select>
        </div>
        <p className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-2 text-xs uppercase tracking-[0.3em] text-slate-400">
          {totalLabel}
        </p>
      </form>

      {visiblePosts.length === 0 ? (
        <p className="rounded-2xl border border-slate-800 bg-slate-950/40 p-6 text-center text-base text-slate-300">
          No posts match this filter yet. Try another tag while the editorial team expands the
          backlog.
        </p>
      ) : (
        <div className="grid gap-8 md:grid-cols-2" role="list">
          {visiblePosts.map((post) => {
            const publishDate = new Date(post.publishDate);
            return (
              <article
                className="flex h-full flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-900/40 p-6 transition hover:border-sky-400/60"
                data-pagefind-body
                key={post.slug}
                role="listitem"
              >
                <span className="sr-only" data-pagefind-meta="publishDate">
                  {publishDate.toISOString()}
                </span>
                <span className="sr-only" data-pagefind-meta="readingTime">
                  {post.estimatedReadingMinutes}
                </span>
                <span className="sr-only" data-pagefind-meta="author">
                  {post.author.name}
                </span>
                <header className="flex flex-col gap-2">
                  <time
                    className="text-xs font-semibold uppercase tracking-wide text-sky-300"
                    dateTime={publishDate.toISOString()}
                  >
                    {dateFormatter.format(publishDate)}
                  </time>
                  <h2 className="text-2xl font-semibold text-white">
                    <a
                      className="hover:text-sky-200"
                      href={`/blog/${post.slug}`}
                      onClick={() =>
                        dispatchAnalytics('interaction', {
                          action: 'index_article_click',
                          slug: post.slug,
                          title: post.title,
                        })
                      }
                    >
                      {post.title}
                    </a>
                  </h2>
                  <p className="text-sm text-slate-400">{post.description}</p>
                </header>
                <div className="flex flex-wrap gap-2" aria-label="Tags">
                  {post.tags.map((tag) => (
                    <span
                      className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs uppercase tracking-wide text-slate-400"
                      data-pagefind-filter="tag"
                      key={`${post.slug}-${tag}`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <footer className="mt-auto flex items-center justify-between text-sm text-slate-400">
                  <span>{post.author.name}</span>
                  <span>{post.estimatedReadingMinutes} min read</span>
                </footer>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BlogIndex;
