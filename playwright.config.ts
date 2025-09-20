import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  retries: process.env.CI ? 2 : 0,
  fullyParallel: false,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:43210',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium-mobile',
      use: {
        ...devices['Pixel 5'],
      },
    },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 43210',
    url: 'http://127.0.0.1:43210',
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
