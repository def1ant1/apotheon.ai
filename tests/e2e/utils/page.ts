import { expect, type Page } from '@playwright/test';

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
