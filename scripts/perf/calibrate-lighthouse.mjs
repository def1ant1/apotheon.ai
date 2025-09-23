#!/usr/bin/env node
/* eslint-disable security/detect-non-literal-fs-filename */
import { spawn } from 'node:child_process';
import { mkdir, readdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

import puppeteer from 'puppeteer';

const REPORT_DIR = join(process.cwd(), 'reports', 'lighthouse');
const LHCI_DIR = join(process.cwd(), '.lighthouseci');

async function discoverChromePath() {
  const candidates = [
    process.env.LHCI_CHROME_PATH,
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    puppeteer.executablePath(),
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      await readFile(candidate);
      return candidate;
    } catch {
      // Continue searching other paths when the candidate does not exist.
      continue;
    }
  }

  return undefined;
}

async function runLighthouse(chromePath) {
  await new Promise((resolve, reject) => {
    const args = [
      'autorun',
      '--config=./lighthouserc.json',
      '--skip=upload',
      '--collect.numberOfRuns=1',
      `--collect.chromePath=${chromePath}`,
      '--collect.chromeFlags=--headless=new',
      '--collect.chromeFlags=--no-sandbox',
      '--collect.chromeFlags=--disable-gpu',
      '--collect.chromeFlags=--disable-dev-shm-usage',
    ];

    const child = spawn('node_modules/.bin/lhci', args, {
      stdio: 'inherit',
      env: {
        ...process.env,
        CHROME_PATH: chromePath,
        LHCI_CHROMIUM_PATH: chromePath,
        LHCI_HEADLESS_CHROME: 'true',
      },
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Lighthouse CI exited with status ${code}`));
      }
    });

    child.on('error', reject);
  });
}

async function collectReports() {
  await mkdir(REPORT_DIR, { recursive: true });
  const files = await readdir(LHCI_DIR);
  const manifestEntries = [];

  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const sourcePath = join(LHCI_DIR, file);
    const contents = await readFile(sourcePath, 'utf8');
    await writeFile(join(REPORT_DIR, file), contents, 'utf8');
    try {
      const parsed = JSON.parse(contents);
      manifestEntries.push({
        file,
        url: parsed.finalUrl ?? parsed.requestedUrl,
        fetchTime: parsed.fetchTime,
        performance: parsed.categories?.performance?.score ?? null,
        lcp: parsed.audits?.['largest-contentful-paint']?.numericValue ?? null,
      });
    } catch {
      // Ignore parse errors so we still capture the raw reports.
    }
  }

  const calibrationManifest = {
    generatedAt: new Date().toISOString(),
    entries: manifestEntries,
  };
  await writeFile(
    join(REPORT_DIR, 'calibration-manifest.json'),
    `${JSON.stringify(calibrationManifest, null, 2)}\n`,
    'utf8',
  );
}

async function main() {
  const chromePath = await discoverChromePath();
  if (!chromePath) {
    throw new Error('Unable to locate Chrome/Chromium for Lighthouse calibration.');
  }

  await rm(REPORT_DIR, { recursive: true, force: true });
  await mkdir(REPORT_DIR, { recursive: true });

  await runLighthouse(chromePath);
  await collectReports();
  console.info('[lighthouse] Calibration complete. Reports written to %s', REPORT_DIR);
}

main().catch((error) => {
  console.error('[lighthouse] Calibration failed:', error);
  process.exitCode = 1;
});
