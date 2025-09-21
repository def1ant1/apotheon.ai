#!/usr/bin/env node
import { spawn } from 'node:child_process';

const command = process.env.CI ? 'wrangler' : 'npx';
const args = process.env.CI ? ['deploy', '--config', 'wrangler.toml'] : ['wrangler', 'deploy', '--config', 'wrangler.toml'];

const child = spawn(command, args, {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code) => {
  if (code !== 0) {
    console.error('\n⚠️  Wrangler deploy failed. Ensure secrets and bindings are configured.');
    process.exit(code ?? 1);
  }
});
