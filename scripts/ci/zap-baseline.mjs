/**
 * Spins up an Astro preview server and executes the OWASP ZAP baseline scan
 * against the generated static site.  The script keeps the logic hermetic so it
 * can run locally and in CI without additional orchestration glue.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

import { ensureDockerAvailable, runDockerCommand, toDockerPath } from './docker.mjs';

const PREVIEW_PORT = Number.parseInt(process.env.ZAP_PREVIEW_PORT ?? '4321', 10);
const PREVIEW_HOST = '0.0.0.0';
const TARGET_URL = process.platform === 'linux'
  ? `http://127.0.0.1:${PREVIEW_PORT}`
  : `http://host.docker.internal:${PREVIEW_PORT}`;
const SERVER_READY_URL = `http://127.0.0.1:${PREVIEW_PORT}`;
const SERVER_READY_TIMEOUT_MS = 60_000;

async function waitForServer(url, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { method: 'GET' });
      if (response.status >= 200 && response.status < 500) {
        return;
      }
    } catch (error) {
      // Ignore connection failures while the server warms up.
      await sleep(1_000);
      continue;
    }

    await sleep(1_000);
  }

  throw new Error(`Preview server did not become ready within ${timeoutMs}ms.`);
}

async function stopProcess(child) {
  if (!child) return;

  child.kill('SIGINT');
  try {
    await Promise.race([
      once(child, 'exit'),
      sleep(5_000),
    ]);
  } catch (error) {
    // Swallow errors – we attempt a hard kill next.
  }

  if (!child.killed) {
    child.kill('SIGKILL');
  }
}

async function main() {
  const workspaceDir = process.cwd();
  const reportDir = path.resolve(workspaceDir, 'artifacts/security/zap');
  await fs.mkdir(reportDir, { recursive: true });

  try {
    await ensureDockerAvailable();
  } catch (error) {
    console.error('\nZAP baseline scan failed. Docker is not available in this environment.');
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exitCode = 1;
    return;
  }

  const preview = spawn('npm', ['run', 'preview', '--', '--host', PREVIEW_HOST, '--port', String(PREVIEW_PORT)], {
    cwd: workspaceDir,
    env: {
      ...process.env,
      NODE_ENV: 'production',
    },
    stdio: 'inherit',
  });

  try {
    await waitForServer(SERVER_READY_URL, SERVER_READY_TIMEOUT_MS);

    const dockerArgs = [
      'run',
      '--rm',
      ...(process.platform === 'linux'
        ? ['--network', 'host']
        : ['--add-host', 'host.docker.internal:host-gateway']),
      '-v', `${toDockerPath(workspaceDir)}:/zap/wrk`,
      '-w', '/zap/wrk',
      'owasp/zap2docker-stable',
      'zap-baseline.py',
      '-t', TARGET_URL,
      '-c', 'zap-baseline.conf',
      '-J', 'artifacts/security/zap/report.json',
      '-r', 'artifacts/security/zap/report.html',
      '-w', 'artifacts/security/zap/warnings.md',
      '-x', 'artifacts/security/zap/report.xml',
      '-I',
      '-m', '5',
    ];

    await runDockerCommand(dockerArgs);
  } catch (error) {
    console.error('\nZAP baseline scan failed. Inspect the generated artifacts for detail.');
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exitCode = 1;
  } finally {
    await stopProcess(preview);
  }
}

main();
