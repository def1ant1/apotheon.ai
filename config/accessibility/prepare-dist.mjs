#!/usr/bin/env node
import { access, mkdir, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const distDir = path.join(root, 'dist');
const ladleDistDir = path.join(distDir, 'ladle');
const accessibilityReportDir = path.join(root, 'reports', 'accessibility');
const axeReportDir = path.join(accessibilityReportDir, 'axe');
const pa11yReportDir = path.join(accessibilityReportDir, 'pa11y');

async function ensureDirectory(targetPath) {
  await mkdir(targetPath, { recursive: true });
}

async function directoryExists(target) {
  try {
    const stats = await stat(target);
    return stats.isDirectory();
  } catch (error) {
    if ((error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') || error === null) {
      return false;
    }
    throw error;
  }
}

async function fileExists(target) {
  try {
    await access(target);
    return true;
  } catch (error) {
    if ((error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') || error === null) {
      return false;
    }
    throw error;
  }
}

async function runNpmScript(scriptName) {
  const skipBuild = process.env.A11Y_SKIP_BUILD === '1';
  if (skipBuild) {
    console.warn(`[accessibility] Skipping ${scriptName} because A11Y_SKIP_BUILD=1`);
    return;
  }

  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  await new Promise((resolve, reject) => {
    const subprocess = spawn(npmCommand, ['run', scriptName], {
      cwd: root,
      stdio: 'inherit',
    });
    subprocess.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${scriptName} exited with code ${code}`));
      }
    });
    subprocess.on('error', (error) => {
      reject(error);
    });
  });
}

async function main() {
  await Promise.all([
    ensureDirectory(accessibilityReportDir),
    ensureDirectory(axeReportDir),
    ensureDirectory(pa11yReportDir),
  ]);

  const hasDist = await directoryExists(distDir);
  if (!hasDist) {
    console.info('[accessibility] dist/ missing. Building static bundle before audits.');
    await runNpmScript('build:static');
  } else {
    const distIndexExists = await fileExists(path.join(distDir, 'index.html'));
    if (!distIndexExists) {
      console.info('[accessibility] dist/ exists but lacks index.html. Rebuilding static bundle.');
      await runNpmScript('build:static');
    }
  }

  const hasLadleDist = await directoryExists(ladleDistDir);
  if (!hasLadleDist) {
    console.info('[accessibility] dist/ladle missing. Building Ladle stories for island audits.');
    await runNpmScript('ladle:build');
  } else {
    const ladleIndexExists = await fileExists(path.join(ladleDistDir, 'index.html'));
    if (!ladleIndexExists) {
      console.info('[accessibility] dist/ladle exists but lacks index.html. Rebuilding Ladle stories.');
      await runNpmScript('ladle:build');
    }
  }
}

void main().catch((error) => {
  console.error('[accessibility] Failed to prepare static build', error);
  process.exitCode = 1;
});
