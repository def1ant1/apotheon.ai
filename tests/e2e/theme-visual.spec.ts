import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test } from '@playwright/test';

import { THEME_VISUAL_ROUTES, THEME_VISUAL_THEMES } from './theme-visual.contract';
import {
  forceReducedMotion,
  preloadRouteAssets,
  setTheme,
  stabilizePageChrome,
} from './utils/page';
import { comparePngSnapshot } from './utils/snapshot';

const specDir = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = join(specDir, 'fixtures', 'theme-visual');

// Lock the viewport and device characteristics so screenshots remain stable across developer
// machines, CI runners, and Playwright releases. Avoiding mobile emulation keeps the layout static
// (no responsive breakpoints or touch affordances) which drastically reduces the noise in diffs.
test.use({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
  isMobile: false,
  hasTouch: false,
});

for (const { path, slug } of THEME_VISUAL_ROUTES) {
  for (const theme of THEME_VISUAL_THEMES) {
    test(`${slug} renders correctly in ${theme} theme`, async ({ page }, testInfo) => {
      // Theme baselines double as design review artefacts. When the contract needs to be updated,
      // run `npm run test:e2e:update-theme-visual` (which now leverages the CLI refresher and exports
      // `PLAYWRIGHT_UPDATE_SNAPSHOTS=1`) and commit the refreshed base64 fixtures under
      // `tests/e2e/fixtures/theme-visual/`.
      await forceReducedMotion(page);
      await page.goto(path, { waitUntil: 'networkidle' });
      await stabilizePageChrome(page);
      await setTheme(page, theme);
      await preloadRouteAssets(page);

      // Wait for critical rendering primitives to stabilise so Playwright captures consistent pixels.
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
        fixturePath: join(FIXTURE_DIR, `${slug}__${theme}.base64.txt`),
        testInfo,
      });
    });
  }
}
