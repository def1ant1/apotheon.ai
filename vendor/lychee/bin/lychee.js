#!/usr/bin/env node
/**
 * Thin wrapper that proxies CLI invocations to the downloaded lychee binary.
 */
const { spawn } = require('node:child_process');
const path = require('node:path');

const binary = path.join(
  __dirname,
  '..',
  'vendor',
  process.platform === 'win32' ? 'lychee.exe' : 'lychee',
);

const subprocess = spawn(binary, process.argv.slice(2), { stdio: 'inherit' });
subprocess.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
