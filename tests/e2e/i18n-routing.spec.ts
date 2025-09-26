import { access, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';

import { primeLocaleCookie } from './fixtures/locale-toggle';
import { dismissConsentModal, neutralizeAstroDevToolbar } from './utils/page';

const PAGEFIND_MANIFEST_PATH = new URL('../../dist/pagefind/manifest.json', import.meta.url);
const PAGEFIND_ENTRY_PATH = new URL('../../dist/pagefind/pagefind-entry.json', import.meta.url);

/* eslint-disable security/detect-non-literal-fs-filename */
async function readPagefindManifest(target: URL): Promise<unknown | null> {
  try {
    const manifestPath = fileURLToPath(target);
    await access(manifestPath);
    const raw = await readFile(manifestPath, 'utf8');
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

async function loadPagefindManifest(): Promise<unknown | null> {
  return (
    (await readPagefindManifest(PAGEFIND_MANIFEST_PATH)) ??
    (await readPagefindManifest(PAGEFIND_ENTRY_PATH))
  );
}
/* eslint-enable security/detect-non-literal-fs-filename */

/**
 * The suite validates that locale negotiation works from a QA toggle through to Pagefind indexing.
 * Running everything under one describe block keeps the Playwright report tidy and documents the
 * expected Spanish translations in a single place for future localisation efforts.
 */
test.describe('runtime i18n routing', () => {
  test('redirects via the QA switcher and renders localized metadata', async ({ page }) => {
    await primeLocaleCookie(page, 'es');

    await page.goto('/');
    await neutralizeAstroDevToolbar(page);
    await dismissConsentModal(page);

    const localeSwitcher = page.locator('select[name="qa-locale-switcher"]');
    await expect(localeSwitcher).toBeVisible();

    await localeSwitcher.selectOption('es');
    await page.waitForURL('**/es/**');

    await expect(page.getByRole('link', { name: 'Inicio' })).toBeVisible();

    const heroSectionHeading = page.getByRole('heading', {
      level: 2,
      name: 'Pilares del sistema operativo de IA',
    });
    await expect(heroSectionHeading).toBeVisible();

    await expect(page.locator('html')).toHaveAttribute('lang', 'es-ES');
    await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', 'es_ES');

    const pagefindManifest = await loadPagefindManifest();
    expect(pagefindManifest).not.toBeNull();
    expect(JSON.stringify(pagefindManifest)).toContain('/es/');
  });
});
