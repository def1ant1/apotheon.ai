#!/usr/bin/env node
/**
 * Vitest compatibility runner that strips Jest-style flags (e.g. --runInBand)
 * from forwarded npm arguments while preserving the ability to target specific
 * specs. The automation suite fans out through a single entry point so every
 * task stays deterministic even when developers pass extra flags during local
 * drills.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const vitestBin = require.resolve('vitest/vitest.mjs');

const ROOT_DIR = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const MANIFEST_PATH = path.join(DIST_DIR, '.compressed-manifest.json');

function runCommand(command, args, options = {}) {
  const { windowsShell = true, ...spawnOptions } = options;
  const executable = process.platform === 'win32' && windowsShell ? `${command}.cmd` : command;
  const result = spawnSync(executable, args, { stdio: 'inherit', ...spawnOptions });

  if (result.error) {
    throw result.error;
  }

  return result.status ?? 0;
}

function ensureBuildArtifacts() {
  const hasDist = existsSync(DIST_DIR);
  const hasManifest = existsSync(MANIFEST_PATH);

  if (hasDist && hasManifest) {
    return;
  }

  const seedScript = path.join(ROOT_DIR, 'tests', 'fixtures', 'compression', 'seed-dist.mjs');
  const shouldRunFullBuild = process.env.APOTHEON_BUILD_FOR_TESTS === '1';

  if (shouldRunFullBuild) {
    console.log('[vitest] dist/ output missing; running build:static for authentic compression coverage.');
    const buildStatus = runCommand('npm', ['run', 'build:static']);

    if (buildStatus !== 0) {
      console.warn(
        '[vitest] build:static failed; falling back to seeded fixture dist so compression tests can execute deterministically.',
      );
      const seedStatus = runCommand(process.execPath, [seedScript], { windowsShell: false });
      if (seedStatus !== 0) {
        throw new Error('Failed to seed fixture dist/ directory for compression manifest tests.');
      }
    }
  } else {
    console.log(
      '[vitest] dist/ output missing; seeding fixture dist (set APOTHEON_BUILD_FOR_TESTS=1 to exercise the full Astro build).',
    );
    const seedStatus = runCommand(process.execPath, [seedScript], { windowsShell: false });
    if (seedStatus !== 0) {
      throw new Error('Failed to seed fixture dist/ directory for compression manifest tests.');
    }
  }

  const compressStatus = runCommand('npm', ['run', 'postbuild:compress']);
  if (compressStatus !== 0) {
    throw new Error('postbuild:compress failed; compression manifest assertions cannot run.');
  }
}

const passthroughArgs = process.argv.slice(2);
const lifecycle = process.env.npm_lifecycle_event ?? '';
const defaultPattern = process.env.VITEST_DEFAULT_PATTERN;

if (lifecycle !== 'test:synthetic') {
  ensureBuildArtifacts();
}

const sanitizedArgs = passthroughArgs.filter((arg) => {
  if (arg === '--runInBand' || arg === '--run-in-band') {
    return false;
  }
  return true;
});

const finalArgs = [];

if (defaultPattern) {
  finalArgs.push(defaultPattern);
}

if (lifecycle !== 'test:synthetic') {
  finalArgs.push(...sanitizedArgs);
}

const result = spawnSync(process.execPath, [vitestBin, 'run', ...finalArgs], {
  stdio: 'inherit',
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
