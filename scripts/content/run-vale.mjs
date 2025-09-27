import { access, chmod, mkdir, rm } from 'node:fs/promises';
import { constants as fsConstants, createReadStream, createWriteStream } from 'node:fs';
import { tmpdir, arch as osArch } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import { connect as tlsConnect } from 'node:tls';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';

/**
 * Vale releases provide discrete tarballs/zip archives for each supported
 * platform + architecture pairing. We track the mapping here so the download
 * helper can deterministically select the correct artifact without any manual
 * intervention.
 */
const SUPPORTED_TARGETS = {
  linux: {
    x64: {
      asset: 'Linux_64-bit.tar.gz',
      archiveType: 'tar.gz',
      binaryName: 'vale',
    },
    arm64: {
      asset: 'Linux_arm64.tar.gz',
      archiveType: 'tar.gz',
      binaryName: 'vale',
    },
  },
  darwin: {
    x64: {
      asset: 'macOS_64-bit.tar.gz',
      archiveType: 'tar.gz',
      binaryName: 'vale',
    },
    arm64: {
      asset: 'macOS_arm64.tar.gz',
      archiveType: 'tar.gz',
      binaryName: 'vale',
    },
  },
  win32: {
    x64: {
      asset: 'Windows_64-bit.zip',
      archiveType: 'zip',
      binaryName: 'vale.exe',
    },
  },
};

const VERSION = '3.8.0';

/**
 * Resolve the active runtime's platform + architecture to the Vale release
 * asset metadata. The logic is exported for unit testing to guard against
 * regressions as new platforms are added.
 *
 * @param {NodeJS.Platform} platform
 * @param {string} architecture
 */
export function resolveAsset(platform = process.platform, architecture = osArch()) {
  const platformTargets = SUPPORTED_TARGETS[platform];
  if (!platformTargets) {
    throw new Error(
      `Unsupported platform "${platform}". Supported platforms: ${Object.keys(SUPPORTED_TARGETS).join(', ')}`,
    );
  }

  const target = platformTargets[architecture];
  if (!target) {
    throw new Error(
      `Unsupported architecture "${architecture}" for platform "${platform}". Supported architectures: ${Object.keys(platformTargets).join(', ')}`,
    );
  }

  const releaseFile = `vale_${VERSION}_${target.asset}`;
  const releaseUrl = `https://github.com/errata-ai/vale/releases/download/v${VERSION}/${releaseFile}`;

  return {
    ...target,
    releaseFile,
    releaseUrl,
  };
}

/**
 * Follow HTTP(S) redirects when downloading release artifacts. GitHub releases
 * frequently issue 302 responses before serving the binary, so we recurse until
 * we obtain a 200 OK payload or exhaust our redirect budget.
 */
async function fetchStream(url, redirectBudget = 5) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const proxyUrl = getProxyUrl(parsed.protocol);

    const handleResponse = (response) => {
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        const redirectLocation = new URL(response.headers.location, url).toString();
        if (redirectBudget <= 0) {
          reject(new Error(`Exceeded redirect limit while fetching Vale from ${url}`));
          response.resume();
          return;
        }

        fetchStream(redirectLocation, redirectBudget - 1).then(resolve, reject);
        response.resume();
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Unexpected status code ${response.statusCode} while fetching Vale from ${url}`));
        response.resume();
        return;
      }

      resolve(response);
    };

    if (proxyUrl) {
      fetchViaHttpProxy(parsed, proxyUrl, handleResponse, reject);
      return;
    }

    const request = httpsRequest(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port,
        path: `${parsed.pathname}${parsed.search}`,
        family: 4,
        headers: {
          'user-agent': 'apotheon-vale-bootstrap',
          accept: 'application/octet-stream',
        },
      },
      handleResponse,
    );

    request.on('error', reject);
    request.end();
  });
}

function getProxyUrl(protocol) {
  const candidates = protocol === 'https:'
    ? [process.env.HTTPS_PROXY, process.env.https_proxy]
    : [process.env.HTTP_PROXY, process.env.http_proxy];
  const fallback = [process.env.HTTP_PROXY, process.env.http_proxy, process.env.HTTPS_PROXY, process.env.https_proxy];
  return [...candidates, ...fallback].find((value) => typeof value === 'string' && value.length > 0);
}

function fetchViaHttpProxy(parsed, proxyUrl, handleResponse, reject) {
  const proxy = new URL(proxyUrl);
  const proxyPort = Number(proxy.port || (proxy.protocol === 'https:' ? 443 : 80));
  const targetPort = Number(parsed.port || (parsed.protocol === 'https:' ? 443 : 80));
  const authorizationHeader = proxy.username
    ? `Basic ${Buffer.from(`${decodeURIComponent(proxy.username)}:${decodeURIComponent(proxy.password || '')}`).toString('base64')}`
    : undefined;

  const connectRequest = (proxy.protocol === 'https:' ? httpsRequest : httpRequest)(
    {
      host: proxy.hostname,
      port: proxyPort,
      method: 'CONNECT',
      path: `${parsed.hostname}:${targetPort}`,
      headers: {
        host: `${parsed.hostname}:${targetPort}`,
        ...(authorizationHeader ? { 'Proxy-Authorization': authorizationHeader } : {}),
      },
    },
  );

  connectRequest.once('connect', (response, socket) => {
    if (response.statusCode !== 200) {
      reject(new Error(`Proxy CONNECT request failed with status ${response.statusCode}`));
      socket.destroy();
      return;
    }

    const tlsSocket = tlsConnect({
      socket,
      servername: parsed.hostname,
    });
    tlsSocket.once('error', reject);

    const request = httpsRequest(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: targetPort,
        path: `${parsed.pathname}${parsed.search}`,
        family: 4,
        headers: {
          'user-agent': 'apotheon-vale-bootstrap',
          accept: 'application/octet-stream',
        },
        createConnection: () => tlsSocket,
      },
      handleResponse,
    );

    request.on('error', reject);
    request.end();
  });

  connectRequest.on('error', reject);
  connectRequest.end();
}

function resolveCacheDir() {
  if (typeof import.meta.url === 'string') {
    try {
      if (import.meta.url.startsWith('file:')) {
        return fileURLToPath(new URL('../../.cache/vale/', import.meta.url));
      }
    } catch {
      // Vitest transforms the module in-memory; fall back to CWD-based cache.
    }
  }

  return join(process.cwd(), '.cache/vale');
}

const baseCacheDir = resolveCacheDir();

async function ensureBinary() {
  const { releaseFile, releaseUrl, archiveType, binaryName } = resolveAsset();
  const platformCacheDir = join(baseCacheDir, `${process.platform}-${osArch()}`);
  const binaryPath = join(platformCacheDir, binaryName);
  const accessMode = process.platform === 'win32' ? fsConstants.F_OK : fsConstants.X_OK;

  try {
    await access(binaryPath, accessMode);
    return { binaryPath };
  } catch {
    // fall through to install
  }

  await mkdir(platformCacheDir, { recursive: true });
  const archivePath = join(tmpdir(), `${Date.now()}-${releaseFile}`);

  const response = await fetchStream(releaseUrl);
  const archiveWriter = createWriteStream(archivePath);
  await pipeline(response, archiveWriter);

  if (archiveType === 'tar.gz') {
    await extractTarGz(archivePath, platformCacheDir);
  } else if (archiveType === 'zip') {
    await extractZip(archivePath, platformCacheDir);
  } else {
    throw new Error(`Unhandled Vale archive type: ${archiveType}`);
  }

  if (process.platform !== 'win32') {
    await chmod(binaryPath, 0o755);
  }

  await rm(archivePath, { force: true });

  return { binaryPath };
}

async function extractTarGz(archivePath, destination) {
  await mkdir(destination, { recursive: true });

  const tarProcess = spawn('tar', ['-x', '-f', '-', '-C', destination], { stdio: ['pipe', 'inherit', 'inherit'] });

  const extraction = new Promise((resolve, reject) => {
    tarProcess.on('error', reject);
    tarProcess.on('close', (code) => {
      if (code === 0) resolve(undefined);
      else reject(new Error(`tar extraction failed with exit code ${code}`));
    });
  });

  const archiveStream = createReadStream(archivePath);
  const gunzip = createGunzip();
  await Promise.all([pipeline(archiveStream, gunzip, tarProcess.stdin), extraction]);
}

async function extractZip(archivePath, destination) {
  await mkdir(destination, { recursive: true });

  const command = process.platform === 'win32' ? 'powershell.exe' : 'unzip';
  const args =
    process.platform === 'win32'
      ? [
          '-NoLogo',
          '-NoProfile',
          '-Command',
          `Expand-Archive -LiteralPath "${archivePath}" -DestinationPath "${destination}" -Force`,
        ]
      : ['-o', archivePath, '-d', destination];

  const extractor = spawn(command, args, { stdio: 'inherit' });

  await new Promise((resolve, reject) => {
    extractor.on('error', reject);
    extractor.on('close', (code) => {
      if (code === 0) resolve(undefined);
      else reject(new Error(`${command} exited with code ${code} while extracting Vale`));
    });
  });
}

async function run() {
  const { binaryPath } = await ensureBinary();
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

const executedScriptHref = process.argv[1] ? pathToFileURL(process.argv[1]).href : undefined;

if (executedScriptHref && import.meta.url === executedScriptHref) {
  run().catch((error) => {
    console.error('[vale] lint failed:', error);
    process.exitCode = 1;
  });
}

export const __internal = {
  SUPPORTED_TARGETS,
  extractTarGz,
  extractZip,
  ensureBinary,
};
