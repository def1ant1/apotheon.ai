#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';

const modulePath = fileURLToPath(import.meta.url);
const projectRoot = fileURLToPath(new URL('../..', import.meta.url));
const distDir = join(projectRoot, 'dist');

function resolvePagefindBinary() {
  const binName = process.platform === 'win32' ? 'pagefind.cmd' : 'pagefind';
  return join(projectRoot, 'node_modules', '.bin', binName);
}

async function main() {
  await fs.access(distDir).catch((error) => {
    throw new Error(`Pagefind cannot index missing directory: ${distDir}`, { cause: error });
  });

  const pagefindBin = resolvePagefindBinary();
  const args = ['--site', distDir];
  const bannerStart = process.env.CI ? '::group::pagefind::index' : '[search] ▶ Pagefind indexing start';
  const bannerEnd = process.env.CI ? '::endgroup::' : '[search] ◀ Pagefind indexing complete';

  console.log(bannerStart);
  console.log(`[search] Executing ${pagefindBin} ${args.join(' ')}`);
  const started = performance.now();

  await new Promise((resolve, reject) => {
    const child = spawn(pagefindBin, args, {
      stdio: 'inherit',
      env: {
        ...process.env,
        PAGEFIND_OUTPUT: join(distDir, 'pagefind')
      }
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Pagefind exited with status ${code}`));
      } else {
        resolve();
      }
    });
  });

  const durationSeconds = ((performance.now() - started) / 1000).toFixed(2);
  console.log(`[search] Index created in ${durationSeconds}s at ${join(distDir, 'pagefind')}`);
  console.log(bannerEnd);
}

const invokedDirectly = process.argv[1] ? resolve(process.argv[1]) === modulePath : false;

if (invokedDirectly) {
  main().catch((error) => {
    console.error('[search] Pagefind indexing failed:', error);
    process.exitCode = 1;
  });
}
