#!/usr/bin/env node

import { cp, mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';

/**
 * Normalises Playwright diff artefacts for GitHub Actions uploads.
 *
 * Playwright stores textual and image diffs alongside the originating test file
 * inside the `--output` directory we hand it. That layout is ideal for local
 * debugging but it scatters context when CI fails. This helper mirrors the tree
 * into `artifacts/playwright/diffs`, writes a manifest so triage tooling can
 * render quick previews, and leaves the raw structure intact for humans that
 * prefer to dig deeper.
 */
const ARTIFACT_ROOT = process.argv[2] ?? 'artifacts/playwright';
const RESULTS_ROOT = join(ARTIFACT_ROOT, 'test-results');
const DIFF_ROOT = join(ARTIFACT_ROOT, 'diffs');

const DIFF_PATTERN = /(\.|-)diff\.(?:png|txt)$/i;
const TEXT_EXTENSIONS = new Set(['.txt', '.json', '.md', '.log']);

/**
 * Recursively walks a directory tree and executes a callback for each file. The
 * traversal intentionally avoids `fs.promises.opendir` to keep compatibility
 * with the GitHub Actions Node runtime when it revs in the future.
 */
async function walk(directory, visitor) {
  const entries = await readdir(directory, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const fullPath = join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath, visitor);
        return;
      }
      if (entry.isFile()) {
        await visitor(fullPath);
      }
    }),
  );
}

/**
 * Copies a diff artefact into the collated directory while ensuring the
 * destination folder exists. Using `fs.cp` keeps metadata intact so hashes stay
 * deterministic between reruns when we diff the artefacts themselves.
 */
async function copyDiff(source, destination) {
  await mkdir(dirname(destination), { recursive: true });
  await cp(source, destination, { recursive: false });
}

async function main() {
  const manifest = [];
  try {
    await stat(RESULTS_ROOT);
  } catch {
    console.info('[playwright-diffs] No test-results directory detected; skipping collection.');
    return;
  }

  await walk(RESULTS_ROOT, async (filePath) => {
    if (!DIFF_PATTERN.test(filePath)) {
      return;
    }

    const relativePath = relative(RESULTS_ROOT, filePath);
    const relativePosix = relativePath.split(sep).join('/');
    const targetPath = `${DIFF_ROOT}/${relativePosix}`;
    await copyDiff(filePath, targetPath);

    const extension = targetPath.slice(targetPath.lastIndexOf('.'));
    manifest.push({
      source: filePath.split(sep).join('/'),
      artifact: targetPath.split(sep).join('/'),
      type: TEXT_EXTENSIONS.has(extension) ? 'text' : 'binary',
    });
  });

  if (manifest.length === 0) {
    console.info('[playwright-diffs] No diff artefacts produced.');
    return;
  }

  await mkdir(DIFF_ROOT, { recursive: true });
  const manifestPath = join(DIFF_ROOT, 'manifest.json');
  await writeFile(manifestPath, JSON.stringify({ generatedAt: new Date().toISOString(), entries: manifest }, null, 2));
  console.info(`[playwright-diffs] Collected ${manifest.length} artefact(s). Manifest: ${manifestPath}`);
}

await main().catch((error) => {
  console.error('[playwright-diffs] Failed to collate artefacts.', error);
  process.exitCode = 1;
});
