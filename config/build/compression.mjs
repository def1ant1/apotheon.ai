import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { constants as zlibConstants } from 'node:zlib';

import viteCompression from 'vite-plugin-compression';

/**
 * Static assets are cached at the CDN edge for extended periods, so operators
 * need deterministic filenames and metadata for observability. The helpers in
 * this module centralise that contract by coordinating both gzip and Brotli
 * emission, recording the hash for every compressed artefact, and exporting the
 * shared pattern that downstream manifest jobs consume when reconciling cache
 * state. Keeping it in one place avoids the risk of bespoke globbing logic that
 * would otherwise diverge across pipelines.
 */
export const STATIC_EDGE_COMPRESSION_PATTERN = /\.(?:avif|css|html|js|json|mjs|svg|txt|webp|xml)$/i;

/**
 * Mutable map populated at build time so manifest generators can diff the
 * emitted compression artefacts without re-parsing the output directory. The
 * keys are origin-relative filenames (without the compression extension) and
 * the values list every compressed variant alongside its hash and payload size.
 */
export const STATIC_COMPRESSION_MANIFEST = {
  pattern: STATIC_EDGE_COMPRESSION_PATTERN,
  assets: new Map()
};

const EXTENSION_TO_ALGORITHM = new Map([
  ['.br', 'brotli'],
  ['.gz', 'gzip']
]);

const COMPRESSED_EXTENSIONS = Array.from(EXTENSION_TO_ALGORITHM.keys());

function createDigest(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function walkCompressedFiles(rootDir) {
  const pending = [rootDir];
  const results = [];

  while (pending.length > 0) {
    const current = pending.pop();
    const entries = await fs.readdir(current, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(entryPath);
        continue;
      }

      if (COMPRESSED_EXTENSIONS.includes(path.extname(entry.name))) {
        results.push(entryPath);
      }
    }
  }

  return results;
}

function registerCompressedAsset(relativeOriginFile, record) {
  if (!STATIC_COMPRESSION_MANIFEST.assets.has(relativeOriginFile)) {
    STATIC_COMPRESSION_MANIFEST.assets.set(relativeOriginFile, []);
  }

  STATIC_COMPRESSION_MANIFEST.assets.get(relativeOriginFile).push(record);
}

function createCompressionPlugin(options) {
  const plugin = viteCompression(options);
  plugin.apply = 'build';
  return plugin;
}

export function createCompressionPluginSuite() {
  STATIC_COMPRESSION_MANIFEST.assets.clear();

  let resolvedOutDir;

  const manifestPlugin = {
    name: 'apotheon:compression-manifest',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      resolvedOutDir = path.isAbsolute(config.build.outDir)
        ? config.build.outDir
        : path.join(config.root, config.build.outDir);
    },
    async closeBundle() {
      if (!resolvedOutDir) {
        return;
      }

      try {
        await fs.access(resolvedOutDir);
      } catch (error) {
        // Build output directory was never created (e.g. fatal build failure),
        // so there is nothing to hash.
        return;
      }

      const compressedFiles = await walkCompressedFiles(resolvedOutDir);

      await Promise.all(
        compressedFiles.map(async (compressedPath) => {
          const relativeCompressedPath = path.relative(resolvedOutDir, compressedPath);
          const ext = path.extname(compressedPath);
          const algorithm = EXTENSION_TO_ALGORITHM.get(ext);

          if (!algorithm) {
            return;
          }

          const source = await fs.readFile(compressedPath);
          const digest = createDigest(source);
          const relativeOriginFile = relativeCompressedPath.slice(0, -ext.length);
          const normalizedOrigin = relativeOriginFile.split(path.sep).join('/');

          if (!STATIC_EDGE_COMPRESSION_PATTERN.test(normalizedOrigin)) {
            return;
          }

          STATIC_EDGE_COMPRESSION_PATTERN.lastIndex = 0;

          const record = {
            algorithm,
            digest,
            bytes: source.byteLength,
            file: relativeCompressedPath.split(path.sep).join('/')
          };

          registerCompressedAsset(normalizedOrigin, record);
        })
      );
    }
  };

  const brotliPlugin = createCompressionPlugin({
    algorithm: 'brotliCompress',
    compressionOptions: {
      params: {
        [zlibConstants.BROTLI_PARAM_QUALITY]: zlibConstants.BROTLI_MAX_QUALITY,
        [zlibConstants.BROTLI_PARAM_MODE]: zlibConstants.BROTLI_MODE_TEXT
      }
    },
    deleteOriginFile: false,
    ext: '.br',
    filter: STATIC_EDGE_COMPRESSION_PATTERN,
    verbose: false
  });

  const gzipPlugin = createCompressionPlugin({
    algorithm: 'gzip',
    compressionOptions: {
      level: zlibConstants.Z_BEST_COMPRESSION
    },
    deleteOriginFile: false,
    ext: '.gz',
    filter: STATIC_EDGE_COMPRESSION_PATTERN,
    verbose: false
  });

  return {
    plugins: [brotliPlugin, gzipPlugin, manifestPlugin],
    manifest: STATIC_COMPRESSION_MANIFEST
  };
}
