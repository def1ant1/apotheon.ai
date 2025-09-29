#!/usr/bin/env tsx

import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

import { THEME_VISUAL_ROUTES, THEME_VISUAL_THEMES } from '../tests/e2e/theme-visual.contract';
import {
  forceReducedMotion,
  preloadRouteAssets,
  setTheme,
  stabilizePageChrome,
} from '../tests/e2e/utils/page';
import {
  PLAYWRIGHT_SNAPSHOT_UPDATE_ENV,
  comparePngSnapshot,
} from '../tests/e2e/utils/snapshot';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const fixturesDir = join(repoRoot, 'tests/e2e/fixtures/theme-visual');
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:43210';

async function main(): Promise<void> {
  // Ensure downstream helpers persist new baselines without raising assertion failures.
  process.env[PLAYWRIGHT_SNAPSHOT_UPDATE_ENV] = '1';

  console.info('[theme-visual] Refresh starting. Ensure the Astro dev server is running.');
  console.info(`[theme-visual] Targeting base URL: ${baseURL}`);

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      baseURL,
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false,
    });

    for (const { path, slug } of THEME_VISUAL_ROUTES) {
      for (const theme of THEME_VISUAL_THEMES) {
        const page = await context.newPage();
        try {
          await forceReducedMotion(page);
          await page.goto(path, { waitUntil: 'networkidle' });
          await stabilizePageChrome(page);
          await setTheme(page, theme);
          await preloadRouteAssets(page);

          await page.waitForFunction(() => {
            const doc = document as Document & { fonts?: FontFaceSet };
            return !doc.fonts || doc.fonts.status === 'loaded';
          });
          await page.waitForTimeout(300);

          await comparePngSnapshot({
            page,
            routePath: path,
            slug,
            theme,
            fixturePath: join(fixturesDir, `${slug}__${theme}.base64.txt`),
          });

          console.info(`[theme-visual] Updated ${slug} (${theme}).`);
        } finally {
          await page.close();
        }
      }
    }
  } finally {
    await browser.close();
  }

  console.info('[theme-visual] Refresh complete.');
}

await main().catch((error: unknown) => {
  console.error('[theme-visual] Refresh failed.', error);
  process.exitCode = 1;
});
