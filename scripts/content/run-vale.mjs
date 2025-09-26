import { access, chmod, mkdir } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const VERSION = '3.8.0';
const RELEASE_URL = `https://github.com/errata-ai/vale/releases/download/v${VERSION}/vale_${VERSION}_Linux_64-bit.tar.gz`;

const cacheDir = fileURLToPath(new URL('../../.cache/vale/', import.meta.url));
const binaryPath = join(cacheDir, 'vale');

async function ensureBinary() {
  try {
    await access(binaryPath, fsConstants.X_OK);
    return;
  } catch {
    // fall through to install
  }

  await mkdir(cacheDir, { recursive: true });
  const tempFile = join(tmpdir(), `vale-${VERSION}-${Date.now()}.tar.gz`);
  await new Promise((resolve, reject) => {
    const curl = spawn('curl', ['-fsSL', RELEASE_URL, '-o', tempFile], { stdio: 'inherit' });
    curl.on('error', reject);
    curl.on('close', (code) => {
      if (code === 0) resolve(undefined);
      else reject(new Error(`curl exited with code ${code} while fetching Vale`));
    });
  });

  await new Promise((resolve, reject) => {
    const tar = spawn('tar', ['-xzf', tempFile, '-C', cacheDir], { stdio: 'inherit' });
    tar.on('error', reject);
    tar.on('close', (code) => {
      if (code === 0) resolve(undefined);
      else reject(new Error(`tar extraction failed with exit code ${code}`));
    });
  });

  await chmod(binaryPath, 0o755);
}

async function run() {
  await ensureBinary();
  const targets = ['src/content', 'docs/content', 'docs/dev'];
  await new Promise((resolve, reject) => {
    const child = spawn(binaryPath, targets, { stdio: 'inherit', cwd: fileURLToPath(new URL('../..', import.meta.url)) });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(undefined);
      else reject(new Error(`Vale exited with code ${code}`));
    });
  });
}

run().catch((error) => {
  console.error('[vale] lint failed:', error);
  process.exitCode = 1;
});
