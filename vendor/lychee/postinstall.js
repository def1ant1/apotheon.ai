#!/usr/bin/env node
/* eslint-disable security/detect-non-literal-fs-filename */
/**
 * Postinstall hook that downloads the lychee CLI binary without requiring cargo.
 * We intentionally depend on curl/tar so air-gapped mirrors can prime caches
 * ahead of time and set APOTHEON_LYCHEE_ARCHIVE_URL to an internal mirror.
 */
const { spawn } = require('node:child_process');
const { existsSync, mkdirSync, chmodSync } = require('node:fs');
const { promises: fs } = require('node:fs');
const path = require('node:path');

const VERSION = '0.20.1';
const BASE_URL = `https://github.com/lycheeverse/lychee/releases/download/lychee-v${VERSION}`;
const DEST_DIR = path.join(__dirname, 'vendor');
const BINARY_NAME = process.platform === 'win32' ? 'lychee.exe' : 'lychee';
const TARGET_PATH = path.join(DEST_DIR, BINARY_NAME);
const MIRROR_URL = process.env.APOTHEON_LYCHEE_ARCHIVE_URL;
const LOCAL_ARCHIVE = process.env.APOTHEON_LYCHEE_ARCHIVE_PATH;
const SKIP_DOWNLOAD = process.env.APOTHEON_LYCHEE_SKIP_DOWNLOAD === '1';

function selectArchive() {
  const arch = process.arch;
  const platform = process.platform;

  if (platform === 'linux' && arch === 'x64') {
    return `${BASE_URL}/lychee-x86_64-unknown-linux-gnu.tar.gz`;
  }
  if (platform === 'linux' && arch === 'arm64') {
    return `${BASE_URL}/lychee-aarch64-unknown-linux-gnu.tar.gz`;
  }
  if (platform === 'linux' && arch === 'arm') {
    return `${BASE_URL}/lychee-arm-unknown-linux-gnueabihf.tar.gz`;
  }
  if (platform === 'darwin' && arch === 'arm64') {
    return `${BASE_URL}/lychee-arm64-macos.tar.gz`;
  }
  if (platform === 'win32' && arch === 'x64') {
    return `${BASE_URL}/lychee-x86_64-windows.exe`;
  }

  throw new Error(
    `Unsupported platform (${platform}) or architecture (${arch}) for lychee prebuilt binaries.`,
  );
}

async function ensureDirectory(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

async function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', ...options });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
      }
    });
  });
}

async function extractTarball(archivePath) {
  await run('tar', ['-xzf', archivePath, '-C', DEST_DIR]);
}

async function downloadToFile(url, outputPath) {
  await run('curl', [
    '--fail',
    '--location',
    '--silent',
    '--show-error',
    url,
    '--output',
    outputPath,
  ]);
}

(async () => {
  try {
    if (SKIP_DOWNLOAD) {
      if (!existsSync(TARGET_PATH)) {
        throw new Error(
          'APOTHEON_LYCHEE_SKIP_DOWNLOAD=1 was set but the binary is missing. Place it at vendor/lychee/vendor/.',
        );
      }
      return;
    }

    await ensureDirectory(DEST_DIR);

    if (existsSync(TARGET_PATH)) {
      // Already installed—respect deterministic installs.
      return;
    }

    const archiveSource = MIRROR_URL || selectArchive();
    const isExe = archiveSource.endsWith('.exe');
    const archivePath =
      LOCAL_ARCHIVE || path.join(DEST_DIR, isExe ? BINARY_NAME : `${BINARY_NAME}.tar.gz`);

    if (!LOCAL_ARCHIVE) {
      await downloadToFile(archiveSource, archivePath);
    }

    if (isExe) {
      if (LOCAL_ARCHIVE) {
        await fs.copyFile(archivePath, TARGET_PATH);
      } else {
        await fs.rename(archivePath, TARGET_PATH);
      }
    } else {
      await extractTarball(archivePath);
      if (!LOCAL_ARCHIVE) {
        await fs.unlink(archivePath);
      }
    }

    chmodSync(TARGET_PATH, 0o755);
  } catch (error) {
    console.error('Failed to install the lychee CLI binary.', error);
    process.exitCode = 1;
  }
})();
