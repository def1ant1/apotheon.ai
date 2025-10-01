#!/usr/bin/env node
/**
 * Enterprise-grade post-build compression orchestrator.
 *
 * This script fans file compression work out across a worker-thread pool so we can
 * deterministically emit Brotli and gzip artefacts alongside the original static
 * assets in `dist/`. It persists a manifest describing the work so CI/CD can audit
 * deltas and developers get incremental rebuilds for free.
 */

import { createHash } from 'node:crypto';
import { promises as fs, constants as fsConstants } from 'node:fs';
import { cpus } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker, isMainThread, parentPort } from 'node:worker_threads';
import globModule from 'glob';

const globSync = typeof globModule.globSync === 'function' ? globModule.globSync : globModule.sync.bind(globModule);
import { performance } from 'node:perf_hooks';
import { z } from 'zod';


const THIS_FILE = fileURLToPath(import.meta.url);
export const ROOT_DIR = path.join(path.dirname(path.dirname(THIS_FILE)), '..');
export const DIST_DIR = path.join(ROOT_DIR, 'dist');
export const COMPRESSION_MANIFEST_PATH = path.join(DIST_DIR, '.compressed-manifest.json');

/**
 * Shared Zod schema that downstream tooling (tests, CI pipelines, etc.) can
 * import to reason about the manifest with static type-safety. Centralising the
 * shape here eliminates the chance of ad-hoc parsers drifting out of sync when
 * new fields are introduced during future optimisations.
 */
export const CompressionEncodingSchema = z.object({
  file: z.string(),
  bytes: z.number(),
  mtime: z.string(),
});

export const CompressionAssetSchema = z.object({
  source: z.string(),
  hash: z.string(),
  sourceBytes: z.number(),
  sourceMtime: z.string(),
  brotli: CompressionEncodingSchema,
  gzip: CompressionEncodingSchema,
  validatedAt: z.string(),
  compressedDurationMs: z.number().optional(),
});

export const CompressionManifestSchema = z.object({
  generatedAt: z.string(),
  assets: z.array(CompressionAssetSchema),
});

const toPosix = (value) => value.split(path.sep).join('/');
const nowIso = () => new Date().toISOString();

const fileExists = async (targetPath) => {
  try {
    await fs.access(targetPath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
};

if (!isMainThread) {
  // Worker-thread execution branch: perform compression for the assigned asset.
  const { brotliCompress, constants: zlibConstants, gzip } = await import('node:zlib');
  const { promisify } = await import('node:util');
  const brotliAsync = promisify(brotliCompress);
  const gzipAsync = promisify(gzip);
  const writeFile = fs.writeFile.bind(fs);
  const stat = fs.stat.bind(fs);

  if (!parentPort) {
    throw new Error('Compression worker spawned without a parent port.');
  }

  parentPort.on('message', async (message) => {
    if (!message || typeof message !== 'object') {
      return;
    }

    if (message.type === 'shutdown') {
      parentPort.postMessage({ type: 'shutdownAck' });
      // Explicitly close the message channel and exit so the main thread can
      // await a clean shutdown. Without this, the worker would keep the event
      // loop alive and `WorkerPool.destroy()` would hang forever.
      parentPort.close();
      process.exit(0);
    }

    if (message.type !== 'compress') {
      return;
    }

    const { jobId, arrayBuffer, byteOffset, byteLength, brotliPath, gzipPath } = message;

    try {
      const startedAt = performance.now();
      const buffer = Buffer.from(arrayBuffer, byteOffset, byteLength);

      const [brotliData, gzipData] = await Promise.all([
        brotliAsync(buffer, {
          params: {
            [zlibConstants.BROTLI_PARAM_QUALITY]: 11,
            [zlibConstants.BROTLI_PARAM_LGWIN]: 22,
          },
        }),
        gzipAsync(buffer, {
          level: zlibConstants.Z_BEST_COMPRESSION,
        }),
      ]);

      await Promise.all([
        writeFile(brotliPath, brotliData),
        writeFile(gzipPath, gzipData),
      ]);

      const [brotliStat, gzipStat] = await Promise.all([
        stat(brotliPath),
        stat(gzipPath),
      ]);

      const completedAt = performance.now();

      parentPort.postMessage({
        type: 'result',
        jobId,
        result: {
          brotli: {
            bytes: brotliStat.size,
            mtime: brotliStat.mtime.toISOString(),
          },
          gzip: {
            bytes: gzipStat.size,
            mtime: gzipStat.mtime.toISOString(),
          },
          durationMs: Number((completedAt - startedAt).toFixed(3)),
        },
      });
    } catch (error) {
      parentPort.postMessage({
        type: 'result',
        jobId,
        error: {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
      });
    }
  });
}

/**
 * Lightweight worker pool to coordinate compression tasks without re-creating
 * worker threads per file. This keeps the pipeline scalable as dist/ grows.
 */
class WorkerPool {
  constructor(scriptPath, size) {
    this.scriptPath = scriptPath;
    this.size = size;
    this.workers = [];
    this.idleWorkers = [];
    this.queue = [];
    this.pending = new Map();
    this.sequence = 0;

    for (let i = 0; i < size; i += 1) {
      const worker = new Worker(scriptPath);
      worker.on('message', (message) => this.handleMessage(worker, message));
      worker.on('error', (error) => this.handleError(worker, error));
      worker.on('exit', (code) => {
        if (code !== 0) {
          this.handleError(worker, new Error(`Worker exited with code ${code}`));
        }
      });
      this.workers.push(worker);
      this.idleWorkers.push(worker);
    }
  }

  nextId() {
    this.sequence += 1;
    return this.sequence;
  }

  runTask(payload, transferList = []) {
    const jobId = this.nextId();
    return new Promise((resolve, reject) => {
      const job = {
        jobId,
        payload: { ...payload, jobId },
        resolve,
        reject,
        transferList,
      };

      if (this.idleWorkers.length > 0) {
        const worker = this.idleWorkers.shift();
        this.dispatch(worker, job);
      } else {
        this.queue.push(job);
      }
    });
  }

  dispatch(worker, job) {
    this.pending.set(job.jobId, { worker, job });
    try {
      worker.postMessage(job.payload, job.transferList);
    } catch (error) {
      this.pending.delete(job.jobId);
      this.idleWorkers.push(worker);
      job.reject(error);
      this.processQueue();
    }
  }

  handleMessage(worker, message) {
    if (!message || typeof message !== 'object') {
      return;
    }

    if (message.type === 'shutdownAck') {
      return;
    }

    if (message.type !== 'result') {
      return;
    }

    const record = this.pending.get(message.jobId);
    if (!record) {
      return;
    }

    this.pending.delete(message.jobId);
    this.idleWorkers.push(worker);

    if (message.error) {
      const error = new Error(message.error.message);
      if (message.error.stack) {
        error.stack = message.error.stack;
      }
      record.job.reject(error);
    } else {
      record.job.resolve(message.result);
    }

    this.processQueue();
  }

  handleError(worker, error) {
    for (const [jobId, record] of this.pending.entries()) {
      if (record.worker === worker) {
        record.job.reject(error);
        this.pending.delete(jobId);
      }
    }
    this.workers = this.workers.filter((candidate) => candidate !== worker);
    this.idleWorkers = this.idleWorkers.filter((candidate) => candidate !== worker);
    this.processQueue();
  }

  processQueue() {
    if (this.queue.length === 0 || this.idleWorkers.length === 0) {
      return;
    }
    const worker = this.idleWorkers.shift();
    const job = this.queue.shift();
    this.dispatch(worker, job);
  }

  async destroy() {
    await Promise.all(
      this.workers.map(
        (worker) =>
          new Promise((resolve) => {
            worker.once('exit', () => resolve());
            worker.postMessage({ type: 'shutdown' });
          }),
      ),
    );
    this.workers = [];
    this.idleWorkers = [];
    this.pending.clear();
    this.queue = [];
  }
}

const readJsonFile = async (targetPath) => {
  try {
    const data = await fs.readFile(targetPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
};

/**
 * Enterprise manifest reader that keeps CI, tests, and operational tooling in
 * lock-step with the compression pipeline. The helper performs existence checks
 * and schema validation so every consumer receives a fully-typed manifest
 * without re-implementing guards or default handling.
 *
 * @param {Object} [options]
 * @param {string} [options.manifestPath=COMPRESSION_MANIFEST_PATH] Absolute path to the manifest file.
 * @param {boolean} [options.requirePresence=true] When true, throws if the manifest is missing.
 * @returns {Promise<import('zod').infer<typeof CompressionManifestSchema> | null>}
 */
export const readCompressionManifest = async ({
  manifestPath = COMPRESSION_MANIFEST_PATH,
  requirePresence = true,
} = {}) => {
  const raw = await readJsonFile(manifestPath);

  if (!raw) {
    if (requirePresence) {
      throw new Error(
        `Compression manifest not found at ${manifestPath}. Ensure the build pipeline executed postbuild:compress first.`,
      );
    }
    return null;
  }

  const result = CompressionManifestSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Compression manifest at ${manifestPath} failed validation: ${result.error.toString()}`,
    );
  }

  return result.data;
};

const computeHash = (buffer) => {
  const hash = createHash('sha256');
  hash.update(buffer);
  return hash.digest('hex');
};

const readFileBuffer = async (filePath) => fs.readFile(filePath);

const loadPreviousManifest = async () => {
  const previous = await readCompressionManifest({
    manifestPath: COMPRESSION_MANIFEST_PATH,
    requirePresence: false,
  });
  if (!previous || !Array.isArray(previous.assets)) {
    return new Map();
  }
  const map = new Map();
  for (const asset of previous.assets) {
    if (asset && typeof asset.source === 'string') {
      map.set(asset.source, asset);
    }
  }
  return map;
};

const safeUnlink = async (filePath) => {
  try {
    await fs.unlink(filePath);
    console.log(`[#compress] Removed stale artefact ${toPosix(path.relative(ROOT_DIR, filePath))}`);
  } catch (error) {
    if (error && error.code !== 'ENOENT') {
      throw error;
    }
  }
};

const ensureDistPresent = async () => {
  try {
    const stats = await fs.stat(DIST_DIR);
    return stats.isDirectory();
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
};

const main = async () => {
  const hasDist = await ensureDistPresent();
  if (!hasDist) {
    console.log('[#compress] dist/ directory not found; skipping compression step.');
    return;
  }

  // Pull the previous manifest into memory so we can fast-path unchanged files
  // and avoid re-compressing assets whose hashes have not budged.
  const previousManifest = await loadPreviousManifest();

  // The glob is resolved relative to the repo root so the script stays relocatable
  // when executed by npm, pnpm, or directly via Node.
  const pattern = toPosix(path.join('dist', '**', '*.{js,css,html,svg,json}'));
  const absoluteFiles = globSync(pattern, {
    cwd: ROOT_DIR,
    absolute: true,
    nodir: true,
    dot: false,
  });

  // Filter out any existing compression artefacts to ensure we never double
  // compress `.br` or `.gz` files and accidentally create recursive variants.
  const candidateFiles = absoluteFiles.filter((filePath) => {
    const lower = filePath.toLowerCase();
    return !lower.endsWith('.br') && !lower.endsWith('.gz');
  });

  if (candidateFiles.length === 0) {
    console.log('[#compress] No compressible artefacts discovered under dist/.');
    await fs.writeFile(
      COMPRESSION_MANIFEST_PATH,
      `${JSON.stringify({ generatedAt: nowIso(), assets: [] }, null, 2)}\n`,
      'utf8',
    );
    return;
  }

  console.log(`[#compress] Preparing compression jobs for ${candidateFiles.length} artefacts.`);

  const updatedEntries = [];
  const compressionJobs = [];

  for (const absolutePath of candidateFiles) {
    // Normalise the source path so it plays nicely on Windows and Linux, then
    // hydrate the metadata we need for hashing, caching, and logging.
    const relativePath = toPosix(path.relative(ROOT_DIR, absolutePath));
    const sourceStat = await fs.stat(absolutePath);
    const buffer = await readFileBuffer(absolutePath);
    const hashHex = computeHash(buffer);
    const digest = `sha256-${hashHex}`;
    const hashPrefix = hashHex.slice(0, 16);
    const parsed = path.parse(absolutePath);
    const brotliPath = path.join(parsed.dir, `${parsed.name}.${hashPrefix}${parsed.ext}.br`);
    const gzipPath = path.join(parsed.dir, `${parsed.name}.${hashPrefix}${parsed.ext}.gz`);
    const brotliRelative = toPosix(path.relative(ROOT_DIR, brotliPath));
    const gzipRelative = toPosix(path.relative(ROOT_DIR, gzipPath));

    const previous = previousManifest.get(relativePath);

    const [brotliPresent, gzipPresent] = await Promise.all([
      fileExists(brotliPath),
      fileExists(gzipPath),
    ]);

    // Hash + file presence checks let us skip the expensive compression step for
    // unchanged files, turning incremental builds into quick manifest rewrites.
    const canReuse =
      !!previous &&
      previous.hash === digest &&
      previous.brotli?.file === brotliRelative &&
      previous.gzip?.file === gzipRelative &&
      brotliPresent &&
      gzipPresent;

    if (canReuse) {
      console.log(`[#compress] Skipping ${relativePath}; artefacts already up to date.`);
      updatedEntries.push({
        ...previous,
        sourceBytes: sourceStat.size,
        sourceMtime: sourceStat.mtime.toISOString(),
        validatedAt: nowIso(),
      });
      continue;
    }

    if (previous?.brotli?.file && previous.brotli.file !== brotliRelative) {
      await safeUnlink(path.join(ROOT_DIR, previous.brotli.file));
    }
    if (previous?.gzip?.file && previous.gzip.file !== gzipRelative) {
      await safeUnlink(path.join(ROOT_DIR, previous.gzip.file));
    }

    // Ship the raw bytes to the worker thread so each file is only read once per
    // build. The underlying ArrayBuffer is transferred for zero-copy throughput.
    const arrayBuffer = buffer.buffer;
    const jobPayload = {
      type: 'compress',
      arrayBuffer,
      byteOffset: buffer.byteOffset,
      byteLength: buffer.byteLength,
      brotliPath,
      gzipPath,
    };

    compressionJobs.push({
      relativePath,
      digest,
      hashPrefix,
      brotliRelative,
      gzipRelative,
      sourceBytes: sourceStat.size,
      sourceMtime: sourceStat.mtime.toISOString(),
      payload: jobPayload,
      transferList: [arrayBuffer],
    });
  }

  let pool = null;
  if (compressionJobs.length > 0) {
    const concurrency = Math.min(Math.max(1, cpus().length - 1), compressionJobs.length);
    console.log(`[#compress] Launching worker pool with concurrency=${concurrency}.`);
    pool = new WorkerPool(THIS_FILE, concurrency);
  }

  if (pool) {
    const compressionEntries = await Promise.all(
      compressionJobs.map(async (job) => {
        const result = await pool.runTask(job.payload, job.transferList);
        console.log(
          `[#compress] Compressed ${job.relativePath} -> ${job.brotliRelative} & ${job.gzipRelative} (hash ${job.hashPrefix}, ${result.durationMs}ms).`,
        );
        return {
          source: job.relativePath,
          hash: job.digest,
          sourceBytes: job.sourceBytes,
          sourceMtime: job.sourceMtime,
          brotli: {
            file: job.brotliRelative,
            bytes: result.brotli.bytes,
            mtime: result.brotli.mtime,
          },
          gzip: {
            file: job.gzipRelative,
            bytes: result.gzip.bytes,
            mtime: result.gzip.mtime,
          },
          validatedAt: nowIso(),
          compressedDurationMs: result.durationMs,
        };
      }),
    );

    updatedEntries.push(...compressionEntries);
  }

  if (pool) {
    await pool.destroy();
  }

  updatedEntries.sort((a, b) => a.source.localeCompare(b.source));

  const manifest = {
    generatedAt: nowIso(),
    assets: updatedEntries,
  };

  await fs.writeFile(
    COMPRESSION_MANIFEST_PATH,
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );
  console.log(
    `[#compress] Compression manifest written with ${updatedEntries.length} entries at ${toPosix(
      path.relative(ROOT_DIR, COMPRESSION_MANIFEST_PATH),
    )}.`,
  );
};

if (isMainThread) {
  const invokedFromCli = process.argv[1] && path.resolve(process.argv[1]) === THIS_FILE;

  if (invokedFromCli) {
    main().catch((error) => {
      console.error('[#compress] Compression pipeline failed:', error);
      process.exitCode = 1;
    });
  }
}
