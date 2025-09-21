/**
 * Runs Lighthouse CI using the Chromium bundled with Puppeteer. This avoids
 * reliance on system Chrome installations, delivering deterministic metrics in
 * both local and CI environments.
 */
import path from 'node:path';
import { spawn } from 'node:child_process';

import fs from 'node:fs/promises';
import puppeteer from 'puppeteer';

function resolveBin(name) {
  const bin = process.platform === 'win32' ? `${name}.cmd` : name;
  return path.resolve('node_modules', '.bin', bin);
}

async function pathExists(candidate) {
  try {
    await fs.access(candidate);
    return true;
  } catch (error) {
    return false;
  }
}

async function discoverChromePath() {
  const candidates = [
    process.env.LHCI_CHROME_PATH,
    process.env.CHROME_PATH,
    process.platform === 'linux' ? '/usr/bin/google-chrome' : undefined,
    process.platform === 'linux' ? '/usr/bin/google-chrome-stable' : undefined,
    process.platform === 'linux' ? '/usr/bin/chromium-browser' : undefined,
    process.platform === 'linux' ? '/usr/bin/chromium' : undefined,
    puppeteer.executablePath(),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

async function main() {
  const chromePath = await discoverChromePath();
  if (!chromePath) {
    throw new Error('Unable to locate a Chrome or Chromium executable. Install Chrome locally or ensure Puppeteer finishes downloading.');
  }

  const lhciBin = resolveBin('lhci');

  await new Promise((resolve, reject) => {
    const child = spawn(lhciBin, [
      'autorun',
      '--config=./lighthouserc.json',
      '--skip=healthcheck',
      `--collect.chromePath=${chromePath}`,
      '--collect.chromeFlags=--headless=new',
      '--collect.chromeFlags=--no-sandbox',
      '--collect.chromeFlags=--disable-gpu',
      '--collect.chromeFlags=--disable-dev-shm-usage',
    ], {
      stdio: 'inherit',
      env: {
        ...process.env,
        CHROME_PATH: chromePath,
        LHCI_CHROMIUM_PATH: chromePath,
        LHCI_HEADLESS_CHROME: 'true',
      },
    });

    child.on('close', (code, signal) => {
      if (signal) {
        reject(new Error(`Lighthouse CI terminated via signal: ${signal}`));
        return;
      }

      if (code !== 0) {
        reject(new Error(`Lighthouse CI exited with status ${code}`));
        return;
      }

      resolve();
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

main().catch((error) => {
  console.error('\nLighthouse CI failed to run.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
