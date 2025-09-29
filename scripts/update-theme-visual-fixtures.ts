#!/usr/bin/env tsx

import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

import { THEME_VISUAL_ROUTES, THEME_VISUAL_THEMES } from '../tests/e2e/theme-visual.contract';
import {
  PLAYWRIGHT_SNAPSHOT_UPDATE_ENV,
  isSnapshotUpdateEnabled,
  updateThemeSnapshots,
} from '../tests/e2e/utils/snapshot';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const fixturesDir = join(repoRoot, 'tests/e2e/fixtures/theme-visual');
const defaultBaseURL = 'http://127.0.0.1:43210';

const DEV_SERVER_COMMAND = [
  'run',
  'dev',
  '--',
  '--host',
  '127.0.0.1',
  '--port',
  '43210',
  '--no-dev-toolbar',
];

async function waitForServerReady(baseURL: string, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseURL, { method: 'HEAD' });
      if (response.ok || (response.status >= 200 && response.status < 500)) {
        return;
      }
    } catch {
      // Swallow connection errors until the retry budget expires.
    }
    await delay(500);
  }

  throw new Error(`Timed out waiting for Astro dev server at ${baseURL}.`);
}

async function ensureDevServer(baseURL: string): Promise<() => Promise<void>> {
  try {
    await waitForServerReady(baseURL, 3_000);
    console.info(`[theme-visual] Reusing existing dev server at ${baseURL}.`);
    return async () => {};
  } catch {
    // Fall through to boot a dedicated dev server instance.
  }

  console.info('[theme-visual] Booting Astro dev server for snapshot refresh.');

  const devProcess = spawn('npm', DEV_SERVER_COMMAND, {
    cwd: repoRoot,
    env: { ...process.env, TAILWIND_DISABLE_OXIDE: process.env.TAILWIND_DISABLE_OXIDE ?? '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  devProcess.stdout?.on('data', (chunk) => {
    process.stdout.write(`[astro-dev] ${chunk}`);
  });

  devProcess.stderr?.on('data', (chunk) => {
    process.stderr.write(`[astro-dev] ${chunk}`);
  });

  const startup = waitForServerReady(baseURL);
  const earlyExit = once(devProcess, 'exit').then(([code, signal]) => {
    throw new Error(
      `Astro dev server exited before becoming ready (code=${code ?? 'null'}, signal=${signal ?? 'null'}).`,
    );
  });

  await Promise.race([startup, earlyExit]);

  return async () => {
    devProcess.kill('SIGINT');
    try {
      await once(devProcess, 'exit');
    } catch {
      // Ignore teardown races when the process is already closed.
    }
  };
}

async function main(): Promise<void> {
  process.env[PLAYWRIGHT_SNAPSHOT_UPDATE_ENV] = '1';
  process.env.UPDATE_SNAPSHOTS = '1';

  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? defaultBaseURL;
  const stopServer = await ensureDevServer(baseURL);

  console.info('[theme-visual] Refresh starting.');
  console.info(`[theme-visual] Targeting base URL: ${baseURL}`);

  try {
    await updateThemeSnapshots({
      baseURL,
      fixtureDir: fixturesDir,
      routes: THEME_VISUAL_ROUTES,
      themes: THEME_VISUAL_THEMES,
      onUpdate: ({ slug, theme }) => {
        console.info(`[theme-visual] Updated ${slug} (${theme}).`);
      },
    });
  } finally {
    await stopServer();
  }

  if (isSnapshotUpdateEnabled()) {
    console.info('[theme-visual] Refresh complete.');
  } else {
    console.warn(
      '[theme-visual] Snapshot update flags were cleared during execution. Verify fixture integrity before committing.',
    );
  }
}

await main().catch((error: unknown) => {
  console.error('[theme-visual] Refresh failed.', error);
  process.exitCode = 1;
});
