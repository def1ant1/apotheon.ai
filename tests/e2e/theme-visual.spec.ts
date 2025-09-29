import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test } from '@playwright/test';

import { themeAttributes, type ThemeName } from '../../src/styles/tokens';
import {
  forceReducedMotion,
  preloadRouteAssets,
  setTheme,
  stabilizePageChrome,
} from './utils/page';
import { assertBase64Snapshot } from './utils/assertBase64Snapshot';

const specDir = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = join(specDir, 'fixtures', 'theme-visual');

// The contract intentionally lists high-signal marketing routes so contributors can review
// light/dark deltas for hero modules, dense grids, and long-form content without manual QA.
// Extend this array as new surfaces launch; the snapshot helper automatically creates the
// fixture skeleton when `UPDATE_THEME_VISUAL_BASELINES=1` is supplied.
const ROUTES: Array<{ path: string; slug: string }> = [
  { path: '/', slug: 'homepage' },
  { path: '/solutions/', slug: 'solutions-index' },
  { path: '/industries/', slug: 'industries-index' },
  { path: '/blog/aios-architecture/', slug: 'blog-aios-architecture' },
];

const THEMES = Object.keys(themeAttributes) as ThemeName[];

// Lock the viewport and device characteristics so screenshots remain stable across developer
// machines, CI runners, and Playwright releases. Avoiding mobile emulation keeps the layout static
// (no responsive breakpoints or touch affordances) which drastically reduces the noise in diffs.
test.use({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
  isMobile: false,
  hasTouch: false,
});

for (const { path, slug } of ROUTES) {
  for (const theme of THEMES) {
    test(`${slug} renders correctly in ${theme} theme`, async ({ page }) => {
      // Theme baselines double as design review artefacts. When the contract needs to be updated,
      // run `npm run test:e2e:update-theme-visual` (which exports `UPDATE_THEME_VISUAL_BASELINES=1`)
      // and commit the refreshed base64 fixtures under `tests/e2e/fixtures/theme-visual/`.
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

      const screenshot = await page.screenshot({
        animations: 'disabled',
        fullPage: true,
        caret: 'hide',
        scale: 'css',
      });

      await assertBase64Snapshot({
        pngBuffer: screenshot,
        fixturePath: join(FIXTURE_DIR, `${slug}__${theme}.base64.txt`),
        scenarioLabel: `${path} (${theme})`,
      });
    });
  }
}
