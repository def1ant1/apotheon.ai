#!/usr/bin/env node
/**
 * Vitest compatibility runner that strips Jest-style flags (e.g. --runInBand)
 * from forwarded npm arguments while preserving the ability to target specific
 * specs. The automation suite fans out through a single entry point so every
 * task stays deterministic even when developers pass extra flags during local
 * drills.
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const vitestBin = require.resolve('vitest/vitest.mjs');

const passthroughArgs = process.argv.slice(2);
const lifecycle = process.env.npm_lifecycle_event ?? '';
const defaultPattern = process.env.VITEST_DEFAULT_PATTERN;

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
