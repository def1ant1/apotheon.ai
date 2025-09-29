import { expect, type Page } from '@playwright/test';

export type ThemePreference = 'light' | 'dark';

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
 * Normalises the Playwright context so every screenshot run honours the same
 * motion preferences. Visual diffing is notoriously sensitive to animation
 * jitter; forcing `prefers-reduced-motion: reduce` means hero marquees or
 * skeleton shimmer effects pause before we capture them which keeps our
 * comparisons deterministic across CI, local workstations, and future
 * headless browsers.
 */
export async function enforceReducedMotion(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
}

/**
 * Centralised theme setter to minimise the number of bespoke DOM pokes our
 * tests have to coordinate. The production runtime toggles the global theme by
 * mutating the `data-theme` attribute on `<html>` (and mirroring it to
 * `<body>`). Doing this work in one helper ensures both the test suite and any
 * future automation (for example, Lighthouse harnesses) stay aligned on the
 * exact mechanism and avoid diverging attribute spellings.
 */
export async function applyTheme(page: Page, theme: ThemePreference): Promise<void> {
  await page.evaluate((nextTheme: ThemePreference) => {
    document.documentElement.setAttribute('data-theme', nextTheme);
    const body = document.body;
    if (body) {
      body.setAttribute('data-theme', nextTheme);
    }

    try {
      localStorage.setItem('apotheon:theme-preference', nextTheme);
    } catch (error) {
      console.warn('Unable to persist theme preference for visual snapshot run.', error);
    }
  }, theme);
}

/**
 * Astro injects preload + largest-contentful-paint metadata into the layout so
 * runtime code can coordinate image loading. When our Playwright flows jump
 * between routes we need to respect that manifest, otherwise screenshots risk
 * capturing placeholder boxes while assets are still streaming. This helper
 * fetches the URLs declared in `<meta name="apotheon:preload-assets">` and
 * `<meta name="apotheon:lcp-candidates">`, waits for them to settle, and only
 * then lets the caller continue. That sequencing mirrors the real browser
 * pipeline which yields stable, flake-free visual baselines.
 */
export async function awaitManifestMedia(page: Page): Promise<void> {
  const manifestUrls = await page.evaluate(() => {
    const parseMeta = (name: string): string[] => {
      const content = document.querySelector(`meta[name="${name}"]`)?.getAttribute('content');
      return (content ?? '')
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
    };

    const toAbsolute = (url: string): string => {
      try {
        return new URL(url, window.location.href).toString();
      } catch {
        return url;
      }
    };

    const preloads = parseMeta('apotheon:preload-assets');
    const lcpCandidates = parseMeta('apotheon:lcp-candidates');
    const urls = [...preloads, ...lcpCandidates].map(toAbsolute);
    return Array.from(new Set(urls));
  });

  if (manifestUrls.length === 0) {
    await page.waitForLoadState('networkidle');
    return;
  }

  await page.evaluate(async (urls: string[]) => {
    await Promise.all(
      urls.map(
        (url) =>
          new Promise<void>((resolve) => {
            const image = new Image();
            image.onload = () => resolve();
            image.onerror = () => resolve();
            image.src = url;
          }),
      ),
    );
  }, manifestUrls);

  await page.waitForLoadState('networkidle');
}
