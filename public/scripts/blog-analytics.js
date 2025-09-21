const configElement = document.querySelector('[data-blog-analytics-config]');
if (!configElement) {
  console.warn('[blog-analytics] unable to locate analytics configuration node');
} else {
  const dataset = configElement.dataset;
  const endpoint = dataset.endpoint || '/api/blog/analytics';
  const slug = dataset.slug || 'unknown';
  const title = dataset.title || 'Untitled';
  const tags = (() => {
    try {
      return JSON.parse(dataset.tags || '[]');
    } catch (error) {
      console.warn('[blog-analytics] failed to parse tags payload', error);
      return [];
    }
  })();
  const publishDate = dataset.publishDate || new Date().toISOString();

  const sessionKey = 'apotheon.blog.session';
  const randomId = () =>
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : [Date.now().toString(36), Math.random().toString(36).slice(2, 10)].join('-');

  const resolveSessionId = () => {
    try {
      const existing = window.sessionStorage.getItem(sessionKey);
      if (existing) return existing;
      const fresh = randomId();
      window.sessionStorage.setItem(sessionKey, fresh);
      return fresh;
    } catch (error) {
      console.warn('[blog-analytics] session bootstrap failed', error);
      return randomId();
    }
  };

  const dispatchEvent = (type, metadata) => {
    const sessionId = resolveSessionId();
    const details = { slug, title, ...(metadata || {}) };
    const payload = {
      dataset: 'blog',
      events: [
        {
          type,
          slug,
          sessionId,
          occurredAt: new Date().toISOString(),
          metadata: details,
        },
      ],
    };

    window.dataLayer = Array.isArray(window.dataLayer) ? window.dataLayer : [];
    window.dataLayer.push({ event: `blog_${type}`, ...details });

    fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch((error) => console.warn('[blog-analytics] beacon failed', error));
  };

  dispatchEvent('article_view', { publishDate, tags });

  const sentinel = document.querySelector('[data-blog-analytics="read-depth"]');
  let conversionTracked = false;
  const markConversion = () => {
    if (conversionTracked) return;
    conversionTracked = true;
    dispatchEvent('conversion', { action: 'read_depth', milestone: 'complete' });
    window.removeEventListener('scroll', onScroll);
  };

  const onScroll = () => {
    if (conversionTracked) return;
    const target = sentinel ?? document.body;
    const targetBottom = target.getBoundingClientRect().bottom;
    if (targetBottom <= window.innerHeight) {
      markConversion();
    }
  };

  if ('IntersectionObserver' in window && sentinel) {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          markConversion();
        }
      },
      { threshold: 0.4, rootMargin: '0px 0px -40%' }
    );
    observer.observe(sentinel);
  } else {
    onScroll();
  }

  window.addEventListener('scroll', onScroll, { passive: true });

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('[data-blog-related-link]') : null;
    if (target) {
      const relatedSlug = target.getAttribute('data-blog-related-slug');
      const relatedTitle = target.getAttribute('data-blog-related-title');
      dispatchEvent('interaction', {
        action: 'related_post_click',
        relatedSlug,
        relatedTitle,
      });
    }
  });
}
