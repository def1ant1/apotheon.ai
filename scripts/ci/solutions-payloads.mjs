#!/usr/bin/env node
import { readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadSolutionFrontmatter } from '../utils/solutions-loader.mjs';

const EXTERNAL_URL_PATTERN = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/iu;
const DEFAULT_DIST_RELATIVE_PATH = 'dist';
const BUDGET_LIMIT_BYTES = 50 * 1024; // 50 KB

const ROOT_DIRECTORY = dirname(fileURLToPath(new URL('../../package.json', import.meta.url)));

function resolveDistDirectory(cliArgument) {
  const candidate = cliArgument ?? DEFAULT_DIST_RELATIVE_PATH;
  return resolve(ROOT_DIRECTORY, candidate);
}

function sanitizeAssetHref(href) {
  return href.split('#')[0]?.split('?')[0] ?? href;
}

function resolveAssetPath(assetHref, htmlDirectory, distDirectory) {
  if (!assetHref || EXTERNAL_URL_PATTERN.test(assetHref)) {
    return null;
  }

  if (assetHref.startsWith('/')) {
    return resolve(distDirectory, assetHref.replace(/^\/+/, ''));
  }

  return resolve(htmlDirectory, assetHref);
}

function collectAssetsFromHtml(htmlContents) {
  const cssAssets = new Set();
  const jsAssets = new Set();

  const stylesheetMatches = htmlContents.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/giu);
  for (const match of stylesheetMatches) {
    cssAssets.add(sanitizeAssetHref(match[1] ?? ''));
  }

  const modulePreloadMatches = htmlContents.matchAll(/<link[^>]+rel=["']modulepreload["'][^>]*href=["']([^"']+)["'][^>]*>/giu);
  for (const match of modulePreloadMatches) {
    jsAssets.add(sanitizeAssetHref(match[1] ?? ''));
  }

  const scriptMatches = htmlContents.matchAll(/<script[^>]+src=["']([^"']+)["'][^>]*><\/script>/giu);
  for (const match of scriptMatches) {
    jsAssets.add(sanitizeAssetHref(match[1] ?? ''));
  }

  return { cssAssets, jsAssets };
}

function computeBundleSize(assetHrefs, htmlDirectory, distDirectory) {
  let totalBytes = 0;
  const resolvedAssets = [];

  for (const assetHref of assetHrefs) {
    const resolvedPath = resolveAssetPath(assetHref, htmlDirectory, distDirectory);

    if (!resolvedPath) {
      continue;
    }

    try {
      const stats = statSync(resolvedPath);
      totalBytes += stats.size;
      resolvedAssets.push({ href: assetHref, size: stats.size });
    } catch (error) {
      console.warn(`solutions-payloads: Unable to read asset at ${resolvedPath}:`, error);
    }
  }

  return { totalBytes, resolvedAssets };
}

function formatKilobytes(bytes) {
  return (bytes / 1024).toFixed(2);
}

function main() {
  const [, , distArg] = process.argv;
  const distDirectory = resolveDistDirectory(distArg);

  const solutions = loadSolutionFrontmatter();

  console.log('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('┃ Solutions payload summary (first-party CSS + JS)');
  console.log(`┃ Dist directory: ${distDirectory}`);
  console.log('┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━┳━━━━━━━━━━┳━━━━━━━━━━┫');
  console.log('┃ Route                        ┃ CSS KB   ┃ JS KB    ┃ Total KB ┃');
  console.log('┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╋━━━━━━━━━━╋━━━━━━━━━━╋━━━━━━━━━━┫');

  for (const entry of solutions) {
    const route = `/solutions/${entry.slug}/`;
    const htmlDirectory = join(distDirectory, 'solutions', entry.slug);
    const htmlPath = join(htmlDirectory, 'index.html');

    let htmlContents = '';
    try {
      htmlContents = readFileSync(htmlPath, 'utf8');
    } catch (error) {
      console.error(`┃ ${route.padEnd(28)} ┃ ERROR    ┃ ERROR    ┃ ERROR    ┃`);
      console.error(`solutions-payloads: Unable to read ${htmlPath}. Did you run \`npm run build\`?`, error);
      continue;
    }

    const { cssAssets, jsAssets } = collectAssetsFromHtml(htmlContents);
    const cssBundle = computeBundleSize(cssAssets, htmlDirectory, distDirectory);
    const jsBundle = computeBundleSize(jsAssets, htmlDirectory, distDirectory);
    const totalBytes = cssBundle.totalBytes + jsBundle.totalBytes;

    const budgetIndicator = totalBytes > BUDGET_LIMIT_BYTES ? '⚠️' : '✅';

    console.log(
      `┃ ${route.padEnd(28)} ┃ ${formatKilobytes(cssBundle.totalBytes).padStart(7)} ┃ ${formatKilobytes(
        jsBundle.totalBytes,
      ).padStart(7)} ┃ ${formatKilobytes(totalBytes).padStart(7)} ┃ ${budgetIndicator}`,
    );

    if (budgetIndicator === '⚠️') {
      console.log('┃    • Assets contributing to the overage:');
      for (const asset of [...cssBundle.resolvedAssets, ...jsBundle.resolvedAssets]) {
        console.log(
          `┃      - ${asset.href.padEnd(40)} ${formatKilobytes(asset.size).padStart(7)} KB`,
        );
      }
    }
    console.log('┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╋━━━━━━━━━━╋━━━━━━━━━━╋━━━━━━━━━━┫');
  }

  console.log('┃ Budget target: 50 KB per solution route for first-party CSS + JS');
  console.log('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┻━━━━━━━━━━┻━━━━━━━━━━┻━━━━━━━━━━┛');
}

main();
