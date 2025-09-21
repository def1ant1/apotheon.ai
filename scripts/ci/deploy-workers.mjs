#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const CONFIG_PATH = 'wrangler.toml';

const baseCommand = process.env.CI ? 'wrangler' : 'npx';
const baseArgs = process.env.CI
  ? ['deploy', '--config', CONFIG_PATH]
  : ['wrangler', 'deploy', '--config', CONFIG_PATH];

/**
 * Parse the Wrangler configuration so we can discover every `[env.<name>]`
 * stanza that represents an additional Worker entry point. This keeps the
 * deployment script data-driven; adding a new Worker requires no script edits.
 */
async function discoverWorkerEnvironments() {
  const fileContents = await readFile(CONFIG_PATH, 'utf8');

  const envPattern = /^\[env\.([A-Za-z0-9_-]+)\]/gm;
  const discovered = new Set();

  for (const match of fileContents.matchAll(envPattern)) {
    const [, name] = match;
    if (!name) continue;
    discovered.add(name);
  }

  return Array.from(discovered);
}

/**
 * Spawn Wrangler (directly in CI or via `npx` locally) to deploy a Worker.
 * We stream output to the parent process so the terminal reflects Wrangler's
 * progress exactly and surface a helpful error when deployment fails.
 */
function runWranglerDeploy({ extraArgs = [], label }) {
  return new Promise((resolve, reject) => {
    const commandArgs = [...baseArgs, ...extraArgs];

    console.log(`\n🚀 Deploying ${label} via: ${baseCommand} ${commandArgs.join(' ')}`);

    const child = spawn(baseCommand, commandArgs, {
      stdio: 'inherit',
      env: process.env,
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `Wrangler exited with code ${code}. Review bindings/secrets for ${label} before rerunning the deploy.`,
          ),
        );
      }
    });
  });
}

async function main() {
  const environments = await discoverWorkerEnvironments();

  const deploymentPlan = [
    { label: 'default Worker', extraArgs: [] },
    ...environments.map((name) => ({ label: `env:${name}`, extraArgs: ['--env', name] })),
  ];

  for (const step of deploymentPlan) {
    await runWranglerDeploy(step);
  }
}

main().catch((error) => {
  console.error('\n⚠️  Wrangler deploy failed. Ensure secrets and bindings are configured.');
  console.error(`   ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
