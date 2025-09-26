import { type Page } from '@playwright/test';

/**
 * Astro-i18next respects the same cookie across server-rendered and client-side
 * routing. Centralising the cookie metadata here keeps Playwright specs honest
 * about the host/flags they rely on while avoiding copy-pasted literals.
 */
export const I18NEXT_COOKIE_NAME = 'i18next' as const;
export const QA_LOCALE_SWITCHER_ENV = 'PUBLIC_ENABLE_LOCALE_QA_SWITCHER' as const;

const PLAYWRIGHT_HOST = '127.0.0.1';

/**
 * Persist a locale hint prior to navigation so the dev server immediately
 * renders the requested translation bundle. Without this helper each spec would
 * need to duplicate the domain/path metadata, increasing the risk of drift as
 * we add staging hosts or tighten cookie policies.
 */
export async function primeLocaleCookie(page: Page, locale: string): Promise<void> {
  await page.context().addCookies([
    {
      name: I18NEXT_COOKIE_NAME,
      value: locale,
      domain: PLAYWRIGHT_HOST,
      path: '/',
      sameSite: 'Lax',
      expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
    },
  ]);
}
