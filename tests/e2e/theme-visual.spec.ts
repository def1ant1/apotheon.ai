import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

import {
  applyTheme,
  awaitManifestMedia,
  dismissConsentModal,
  enforceReducedMotion,
  neutralizeAstroDevToolbar,
  type ThemePreference,
} from './utils/page';
import { assertBase64Snapshot } from './utils/snapshots';

const specDir = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = join(specDir, 'fixtures', 'theme-visual');
const UPDATE_COMMAND =
  'UPDATE_THEME_VISUAL_BASELINES=1 npm run test:e2e -- tests/e2e/theme-visual.spec.ts';

interface RouteTarget {
  readonly path: string;
  readonly slug: string;
  readonly rationale: string;
}

const TARGET_ROUTES: readonly RouteTarget[] = [
  {
    path: '/', // Regression risk: Homepage hero + marquee drive the top-of-funnel pipeline, so any drift undermines executive demos.
    slug: 'root',
    rationale:
      'Homepage hero storytelling underpins campaign landing experiences; pixel drift risks funnel drop-off during exec demos.',
  },
  {
    path: '/docs/', // Regression risk: Developer docs signal product maturity; regressions erode trust with security + platform teams.
    slug: 'docs',
    rationale:
      'Docs index must remain legible for security reviews and procurement diligence; regressions block onboarding checklists.',
  },
  {
    path: '/lead-viewer/', // Regression risk: Lead viewer is used by RevOps daily; visual drift risks misreads during live incident escalations.
    slug: 'lead-viewer',
    rationale:
      'RevOps relies on the lead viewer UI during live escalations; breaking contrast/layout here directly impacts response SLAs.',
  },
];

const THEMES: readonly { name: ThemePreference; annotation: string }[] = [
  {
    name: 'light',
    annotation:
      'Light theme guards against regression for daytime buyers reviewing security collateral on calibrated office monitors.',
  },
  {
    name: 'dark',
    annotation:
      'Dark theme protects overnight SOC analysts using the product in low-light war rooms where glare is unacceptable.',
  },
];

function fixturePathFor(route: RouteTarget, theme: ThemePreference): string {
  return join(FIXTURE_DIR, `${route.slug}-${theme}.base64.txt`);
}

test.describe('enterprise theme visual baselines', () => {
  for (const route of TARGET_ROUTES) {
    test.describe(`${route.path} visual parity`, () => {
      for (const theme of THEMES) {
        test(`${route.path} renders ${theme.name} theme without regressions`, async ({ page }, testInfo) => {
          await enforceReducedMotion(page);
          await page.goto(route.path, { waitUntil: 'domcontentloaded' });
          await neutralizeAstroDevToolbar(page);
          await dismissConsentModal(page);

          const { pathname } = new URL(page.url());
          const actualPath = pathname.endsWith('/') ? pathname : `${pathname}/`;
          const expectedPath = route.path.endsWith('/') ? route.path : `${route.path}/`;
          expect(actualPath).toBe(expectedPath);

          await applyTheme(page, theme.name);
          await awaitManifestMedia(page);

          testInfo.annotations.push({
            type: 'business-regression',
            description: `${route.rationale} ${theme.annotation}`,
          });

          await assertBase64Snapshot({
            page,
            fixturePath: fixturePathFor(route, theme.name),
            route: route.path,
            theme: theme.name,
            rationale: route.rationale,
            updateCommand: UPDATE_COMMAND,
            testInfo,
          });
        });
      }
    });
  }
});
