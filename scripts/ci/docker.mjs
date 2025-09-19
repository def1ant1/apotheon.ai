/**
 * Utility helpers shared by CI command runners that shell out to Docker-based
 * scanners.  Centralising the integration logic keeps the individual scripts
 * laser focused on their security or quality responsibilities while still
 * providing a single choke point for reliability hardening.
 */
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const execFileAsync = promisify(execFile);

/**
 * Normalises a filesystem path so it can be mounted inside a Docker container.
 * Windows paths need to be rewritten into the format Docker understands,
 * whereas POSIX platforms can be used as-is.  The helper keeps the scripts
 * portable for contributors regardless of their host operating system.
 */
export function toDockerPath(fsPath) {
  const normalised = path.resolve(fsPath);

  if (process.platform === 'win32') {
    const driveLetter = normalised.slice(0, 1).toLowerCase();
    const rest = normalised.slice(2).replace(/\\/g, '/');
    return `/${driveLetter}${rest.startsWith('/') ? rest : `/${rest}`}`;
  }

  return normalised;
}

/**
 * Ensures Docker is available before we attempt to run any containerised
 * tooling.  The explicit check provides actionable feedback in local
 * environments where Docker may not be installed or started.
 */
export async function ensureDockerAvailable() {
  try {
    await execFileAsync('docker', ['--version']);
  } catch (error) {
    throw new Error(
      'Docker is required to run this command. Ensure the Docker CLI is ' +
        'installed, running, and available on your PATH. Original error: ' +
        (error instanceof Error ? error.message : String(error)),
    );
  }
}

/**
 * Streams a Docker command and rejects if the underlying process exits with a
 * non-zero code.  We rely on `spawn` over `exec` to avoid buffering large
 * outputs such as the ZAP HTML report while still surfacing logs to the user in
 * real-time.
 */
export async function runDockerCommand(args, options = {}) {
  const { cwd = process.cwd(), env = process.env } = options;
  await ensureDockerAvailable();

  await new Promise((resolve, reject) => {
    const child = spawn('docker', args, {
      cwd,
      env,
      stdio: 'inherit',
    });

    child.on('close', (code, signal) => {
      if (signal) {
        reject(new Error(`Docker command terminated via signal: ${signal}`));
        return;
      }

      if (code !== 0) {
        reject(new Error(`Docker command exited with status ${code}`));
        return;
      }

      resolve();
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}
