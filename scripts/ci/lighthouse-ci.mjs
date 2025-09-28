/**
 * Runs Lighthouse CI using the Chromium bundled with Puppeteer. This avoids
 * reliance on system Chrome installations, delivering deterministic metrics in
 * both local and CI environments.
 */
import path from 'node:path';
import os from 'node:os';
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

function deepMerge(base = {}, overrides = {}) {
  if (!overrides || typeof overrides !== 'object') {
    return structuredClone(base);
  }

  const result = structuredClone(base ?? {});

  for (const [key, value] of Object.entries(overrides)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      result[key] &&
      typeof result[key] === 'object' &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(result[key], value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

async function runLhciSuite({
  name,
  baseConfig,
  baseCollect,
  baseAssert,
  baseUpload,
  collectOverrides,
  assertOverrides,
  lhciBin,
  chromePath,
}) {
  const suiteCollect = deepMerge(baseCollect, collectOverrides ?? {});
  const suiteAssert = deepMerge(baseAssert, assertOverrides ?? {});

  const uploadRoot = baseUpload?.outputDir ?? './artifacts/lighthouse';
  const suiteUploadDirRelative = path.join(uploadRoot, name).replace(/\\/g, '/');
  const suiteUploadDir = path.resolve(suiteUploadDirRelative);

  await fs.rm(suiteUploadDir, { recursive: true, force: true });
  await fs.mkdir(suiteUploadDir, { recursive: true });

  const suiteConfig = structuredClone(baseConfig);
  suiteConfig.ci = {
    ...suiteConfig.ci,
    collect: suiteCollect,
    assert: suiteAssert,
    upload: {
      ...baseUpload,
      outputDir: suiteUploadDirRelative,
    },
  };
  delete suiteConfig.profiles;

  const tempConfigPath = path.join(
    os.tmpdir(),
    `lighthouserc-${name}-${process.pid}-${Date.now()}.json`,
  );
  await fs.writeFile(tempConfigPath, `${JSON.stringify(suiteConfig, null, 2)}\n`, 'utf8');

  console.log(`\n▶️  Running Lighthouse CI suite: ${name}`);

  await new Promise((resolve, reject) => {
    const child = spawn(
      lhciBin,
      [
        'autorun',
        `--config=${tempConfigPath}`,
        '--skip=healthcheck',
        `--collect.chromePath=${chromePath}`,
        '--collect.chromeFlags=--headless=new',
        '--collect.chromeFlags=--no-sandbox',
        '--collect.chromeFlags=--disable-gpu',
        '--collect.chromeFlags=--disable-dev-shm-usage',
      ],
      {
        stdio: 'inherit',
        env: {
          ...process.env,
          CHROME_PATH: chromePath,
          LHCI_CHROMIUM_PATH: chromePath,
          LHCI_HEADLESS_CHROME: 'true',
        },
      },
    );

    child.on('close', (code, signal) => {
      if (signal) {
        reject(new Error(`Lighthouse CI (${name}) terminated via signal: ${signal}`));
        return;
      }

      if (code !== 0) {
        reject(new Error(`Lighthouse CI (${name}) exited with status ${code}`));
        return;
      }

      resolve();
    });

    child.on('error', (error) => {
      reject(error);
    });
  });

  await fs.rm(tempConfigPath, { force: true });
}

async function main() {
  const chromePath = await discoverChromePath();
  if (!chromePath) {
    throw new Error('Unable to locate a Chrome or Chromium executable. Install Chrome locally or ensure Puppeteer finishes downloading.');
  }

  const lhciBin = resolveBin('lhci');
  const configPath = path.resolve('lighthouserc.json');
  const config = JSON.parse(await fs.readFile(configPath, 'utf8'));

  const baseCollect = config?.ci?.collect ?? {};
  const baseAssert = config?.ci?.assert ?? {};
  const baseUpload = config?.ci?.upload ?? {};

  const profiles = config?.profiles ?? {};

  const suites = [
    {
      name: 'desktop',
      collectOverrides: profiles.desktop?.collect,
      assertOverrides: profiles.desktop?.assert,
    },
    ...Object.entries(profiles)
      .filter(([profileName]) => profileName !== 'desktop')
      .map(([profileName, profileConfig]) => ({
        name: profileName,
        collectOverrides: profileConfig.collect,
        assertOverrides: profileConfig.assert,
      })),
  ];

  for (const suite of suites) {
    await runLhciSuite({
      name: suite.name,
      baseConfig: config,
      baseCollect,
      baseAssert,
      baseUpload,
      collectOverrides: suite.collectOverrides,
      assertOverrides: suite.assertOverrides,
      lhciBin,
      chromePath,
    });
  }
}

main().catch((error) => {
  console.error('\nLighthouse CI failed to run.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
