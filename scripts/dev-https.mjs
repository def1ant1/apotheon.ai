#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const CERT_PATH = resolve('certs/localhost-cert.pem');
const KEY_PATH = resolve('certs/localhost-key.pem');

const hasCustomCertificates = existsSync(CERT_PATH) && existsSync(KEY_PATH);

const cliArgs = ['astro', 'dev', '--host'];

if (hasCustomCertificates) {
  cliArgs.push('--https', '--cert', CERT_PATH, '--key', KEY_PATH);
} else {
  cliArgs.push('--https');
  console.warn(
    '\n⚠️  No mkcert certificates detected. Falling back to Vite\'s ephemeral self-signed cert.\n' +
      `   Generate certs with ./scripts/security/mkcert-localhost.sh for trust-store integration.\n`
  );
}

const userArgs = process.argv.slice(2);

if (userArgs.length) {
  cliArgs.push(...userArgs);
}

const runner = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const child = spawn(runner, cliArgs, {
  stdio: 'inherit',
  env: {
    ...process.env,
    ASTRO_DEV_HTTPS: 'true',
    ASTRO_CSP_REPORT_ONLY: process.env.ASTRO_CSP_REPORT_ONLY ?? 'true'
  }
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
