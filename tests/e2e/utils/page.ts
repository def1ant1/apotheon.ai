import { expect, type Page } from '@playwright/test';

const reducedMotionConfigured = new WeakSet<Page>();

/**
 * Forces Playwright to respect our accessibility-first motion contract by disabling animations and
 * transitions as early as possible. We register an init script before navigation so the virtual DOM
 * never observes intermediate transition states, and we still patch the live document to cover any
 * already-loaded routes (e.g., `about:blank` navigations inside the same page object).
 */
export async function forceReducedMotion(page: Page): Promise<void> {
  if (!reducedMotionConfigured.has(page)) {
    await page.addInitScript(() => {
      const styleId = '__apotheon-reduced-motion-style__';
      if (document.getElementById(styleId)) {
        return;
      }

      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        *, *::before, *::after {
          transition-duration: 0ms !important;
          animation-duration: 0ms !important;
          animation-delay: 0ms !important;
        }
      `;
      document.head.appendChild(style);
    });

    reducedMotionConfigured.add(page);
  }

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => {
    const styleId = '__apotheon-reduced-motion-style__';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        *, *::before, *::after {
          transition-duration: 0ms !important;
          animation-duration: 0ms !important;
          animation-delay: 0ms !important;
        }
      `;
      document.head.appendChild(style);
    }
  });
}

/**
 * Synchronises the application theme tokens with Playwright by writing the canonical `data-theme`
 * attribute to both `<html>` and `<body>`. Astro sets a default "night" theme during SSR, so tests
 * explicitly override it to keep CSS variables and global tokens aligned with visual expectations.
 */
export async function setTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  await page.emulateMedia({ colorScheme: theme });
  await page.evaluate(({ theme: desiredTheme }) => {
    const root = document.documentElement;
    root.dataset.theme = desiredTheme;
    if (document.body) {
      document.body.dataset.theme = desiredTheme;
    }
  }, { theme });
}

/**
 * Removes Astro's development toolbar overlay if it was injected into the DOM. The toolbar can
 * intercept pointer events during Playwright sessions which makes deterministic keyboard flows
 * brittle. Nuking it at runtime keeps the test viewport aligned with production markup.
 */
export async function neutralizeAstroDevToolbar(page: Page): Promise<void> {
  await page.evaluate(() => {
    const globalWindow = window as typeof window & {
      __APOTHEON_TOOLBAR_OBSERVER__?: MutationObserver;
    };
    const removeToolbar = () => {
      const toolbar = document.querySelector('astro-dev-toolbar');
      if (toolbar && typeof (toolbar as HTMLElement).remove === 'function') {
        (toolbar as HTMLElement).remove();
      }

      document.querySelectorAll('[data-astro-dev-toolbar]').forEach((element) => {
        if (element instanceof HTMLElement) {
          element.remove();
        }
      });
    };

    removeToolbar();

    const existingObserver = globalWindow.__APOTHEON_TOOLBAR_OBSERVER__;
    if (existingObserver) {
      return;
    }

    const observer = new MutationObserver(() => {
      removeToolbar();
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });
    globalWindow.__APOTHEON_TOOLBAR_OBSERVER__ = observer;
  });
}

/**
 * Waits for an Astro/React island to hydrate by polling a `data-js-ready="true"` attribute. Islands
 * render SSR markup immediately, so relying on event listeners alone races with keyboard-driven
 * submissions (forms) or menu triggers. Marking readiness in the DOM gives the tests a resilient
 * signal without leaking Playwright-specific hacks into production bundles.
 */
export async function waitForIslandHydration(
  page: Page,
  selector: string,
  readyAttribute = 'data-js-ready',
): Promise<void> {
  await page.waitForSelector(selector, { state: 'attached' });
  await page.waitForFunction(
    ({ selector: nodeSelector, attribute }: { selector: string; attribute: string }) => {
      const element = document.querySelector(nodeSelector);
      return element instanceof HTMLElement && element.getAttribute(attribute) === 'true';
    },
    { selector, attribute: readyAttribute },
  );
}

export async function dismissConsentModal(page: Page): Promise<void> {
  await page.waitForFunction(() => typeof window.__APOTHEON_CONSENT__ !== 'undefined');
  const modal = page.getByTestId('consent-modal');
  try {
    await modal.waitFor({ state: 'visible', timeout: 3000 });
  } catch {
    return;
  }

  await page.getByTestId('consent-deny-all').click();
  await page.getByTestId('consent-save').click();
  await expect(modal).toBeHidden();
}

/**
 * Centralises the deterministic viewport tweaks that every E2E spec relied on individually. The
 * helper removes the Astro toolbar, settles consent state, and (optionally) ensures reduced-motion
 * styles are in effect before we interact with the DOM. Tests can now invoke a single routine
 * immediately after navigation (or before critical interactions) to mirror the production surface
 * area.
 */
export async function stabilizePageChrome(
  page: Page,
  options: { reducedMotion?: boolean } = {},
): Promise<void> {
  const { reducedMotion = true } = options;

  if (reducedMotion) {
    await forceReducedMotion(page);
  }

  try {
    await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
  } catch {
    // Ignore navigation timing noise—some specs intentionally target already-hydrated documents.
  }

  await neutralizeAstroDevToolbar(page);
  await dismissConsentModal(page);

  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    if (document.body) {
      document.body.style.scrollBehavior = 'auto';
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  });
}

/**
 * Routes often publish a manifest of imagery that should be prefetched to keep LCP consistent
 * across CI and developer machines. This helper inspects the BaseLayout metadata, hydrates the
 * declared assets, and waits for any `data-lcp-candidate="true"` nodes to finish loading before the
 * calling spec proceeds.
 */
export async function preloadRouteAssets(page: Page): Promise<void> {
  const { preloadAssets, lcpAssets } = await page.evaluate(() => {
    const parseCsv = (value: string | null | undefined) =>
      value
        ?.split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0) ?? [];

    const preloadMeta = document.querySelector('meta[name="apotheon:preload-assets"]');
    const lcpMeta = document.querySelector('meta[name="apotheon:lcp-candidates"]');

    const preloadList = parseCsv(preloadMeta?.getAttribute('content'));
    const lcpKeys = parseCsv(lcpMeta?.getAttribute('content'));

    type Manifest = {
      assets?: Record<
        string,
        {
          base?: string;
          derivatives?: Record<string, string>;
        }
      >;
    };

    const manifestSource = (window as typeof window & { __APOTHEON_IMAGE_MANIFEST__?: unknown })
      .__APOTHEON_IMAGE_MANIFEST__;
    const manifest: Manifest | undefined =
      typeof manifestSource === 'string'
        ? (JSON.parse(manifestSource) as Manifest)
        : (manifestSource as Manifest | undefined);

    const lcpAssetPaths = lcpKeys.flatMap((key) => {
      const entry = manifest?.assets?.[key];
      if (!entry) {
        return [] as string[];
      }

      const derivatives = entry.derivatives ? Object.values(entry.derivatives) : [];
      return [entry.base, ...derivatives].filter((value): value is string => typeof value === 'string');
    });

    return { preloadAssets: preloadList, lcpAssets: lcpAssetPaths };
  });

  const candidateAssets = [...new Set([...preloadAssets, ...lcpAssets])];

  await Promise.all(
    candidateAssets.map(async (assetPath) => {
      const absoluteUrl = new URL(assetPath, page.url()).toString();

      const [response] = await Promise.all([
        page.waitForResponse(
          (incoming) => incoming.url() === absoluteUrl || incoming.url().startsWith(`${absoluteUrl}?`),
          { timeout: 15000 },
        ),
        page.evaluate(async (targetUrl) => {
          await fetch(targetUrl, { cache: 'reload', credentials: 'include' });
        }, absoluteUrl),
      ]);

      if (!response.ok()) {
        throw new Error(`Failed to preload asset at ${absoluteUrl} (HTTP ${response.status()})`);
      }
    }),
  );

  await page.evaluate(async () => {
    const elements = Array.from(
      document.querySelectorAll<HTMLElement>('[data-lcp-candidate="true"] img, [data-lcp-candidate="true"] source'),
    );

    await Promise.all(
      elements.map((element) => {
        if (element instanceof HTMLImageElement) {
          if (element.complete) {
            return Promise.resolve();
          }

          return new Promise<void>((resolve) => {
            element.addEventListener('load', () => resolve(), { once: true });
            element.addEventListener('error', () => resolve(), { once: true });
          });
        }

        return Promise.resolve();
      }),
    );
  });
}
