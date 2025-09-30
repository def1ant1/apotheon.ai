import { defineConfig, devices, type Project } from '@playwright/test';

/**
 * Enterprise Playwright guardrails
 * ---------------------------------
 * Our E2E layer doubles as the contract test harness for production. The
 * configuration intentionally documents every runtime toggle so reproducible
 * builds stay trivial for both humans and automation. Keep the following env
 * variables in mind when invoking the suite locally or in CI:
 *
 * - `PLAYWRIGHT_BASE_URL`: Overrides the default dev-server target. CI injects
 *   this when the preview server runs on a non-standard port.
 * - `UPDATE_SNAPSHOTS` / `PLAYWRIGHT_UPDATE_SNAPSHOTS`: When either flag is set
 *   to `1`, Playwright (and our bespoke visual harness) rewrite screenshot
 *   baselines instead of diffing. The pair remains in sync with
 *   `scripts/update-theme-visual-fixtures.ts` so pipeline tooling never drifts
 *   from local developer workflows.
 * - `APOTHEON_PREFETCH_IMAGE_MANIFEST`: Optional escape hatch that forces the
 *   Astro dev server to emit the global image manifest even when running in a
 *   mocked content state. We default this to `1` for desktop projects below so
 *   theme snapshots keep LCP deterministic.
 */
const isSnapshotUpdateEnabled =
  process.env.UPDATE_SNAPSHOTS === '1' || process.env.PLAYWRIGHT_UPDATE_SNAPSHOTS === '1';

const OUTPUT_ROOT = 'artifacts/playwright';
const SNAPSHOT_ROOT = 'tests/e2e/__screenshots__';
const DESKTOP_VIEWPORT = { width: 1440, height: 900 } as const;
const PREFETCH_HEADER = 'x-apotheon-preload-image-manifest';

type DeviceAugmentations = {
  contextOptions?: { extraHTTPHeaders?: Record<string, string> };
  launchOptions?: { args?: string[] };
};

const DESKTOP_DEVICE = devices['Desktop Chrome'];
const MOBILE_DEVICE = devices['Pixel 5'];

function buildDesktopProject(theme: 'light' | 'dark'): Project {
  const threshold = theme === 'dark' ? 0.05 : 0.02;
  const maxDiffPixelRatio = theme === 'dark' ? 0.03 : 0.015;
  const desktopExtras = DESKTOP_DEVICE as unknown as DeviceAugmentations;

  return {
    name: `chromium-desktop-${theme}`,
    metadata: {
      theme,
      manifestPreloaded: true,
    },
    use: {
      ...DESKTOP_DEVICE,
      colorScheme: theme,
      viewport: DESKTOP_VIEWPORT,
      reducedMotion: 'reduce',
      deviceScaleFactor: 1,
      extraHTTPHeaders: {
        ...(desktopExtras.contextOptions?.extraHTTPHeaders ?? {}),
        [PREFETCH_HEADER]: '1',
      },
      launchOptions: {
        ...(desktopExtras.launchOptions ?? {}),
        args: [...(desktopExtras.launchOptions?.args ?? []), '--force-device-scale-factor=1'],
      },
    } as Parameters<typeof defineConfig>[0]['use'],
    expect: {
      toMatchSnapshot: {
        threshold,
        maxDiffPixelRatio,
      },
    },
  };
}

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  retries: process.env.CI ? 2 : 0,
  fullyParallel: false,
  updateSnapshots: isSnapshotUpdateEnabled ? 'all' : 'missing',
  snapshotPathTemplate: `${SNAPSHOT_ROOT}/{projectName}/{testFileDir}/{testName}-{arg}{ext}`,
  outputDir: `${OUTPUT_ROOT}/test-results`,
  reporter: [
    ['list'],
    ['html', { outputFolder: `${OUTPUT_ROOT}/html-report`, open: 'never' }],
    ['json', { outputFile: `${OUTPUT_ROOT}/report.json` }],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:43210',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
    extraHTTPHeaders: {
      [PREFETCH_HEADER]: '1',
    },
    reducedMotion: 'reduce',
  } as Parameters<typeof defineConfig>[0]['use'],
  projects: [
    {
      name: 'chromium-mobile',
      use: {
        ...MOBILE_DEVICE,
        reducedMotion: 'reduce',
        extraHTTPHeaders: {
          ...((MOBILE_DEVICE as unknown as DeviceAugmentations).contextOptions?.extraHTTPHeaders ??
            {}),
          [PREFETCH_HEADER]: '1',
        },
      } as Parameters<typeof defineConfig>[0]['use'],
    },
    buildDesktopProject('light'),
    buildDesktopProject('dark'),
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 43210 --no-dev-toolbar',
    url: 'http://127.0.0.1:43210',
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      PUBLIC_ENABLE_LOCALE_QA_SWITCHER: 'true',
      APOTHEON_PREFETCH_IMAGE_MANIFEST: '1',
    },
  },
});
