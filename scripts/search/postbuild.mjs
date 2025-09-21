#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { JSDOM } from 'jsdom';
import { SEO_MANIFEST } from '../../config/seo/manifest.mjs';

const modulePath = fileURLToPath(import.meta.url);
const projectRoot = fileURLToPath(new URL('../..', import.meta.url));
const distDir = join(projectRoot, 'dist');

async function collectHtmlFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = await collectHtmlFiles(entryPath);
      files.push(...nested);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      files.push(entryPath);
    }
  }
  return files;
}

function normaliseRoute(route) {
  if (!route) return route;
  let value = route;
  if (!value.startsWith('/')) {
    value = `/${value}`;
  }
  value = value.replace(/index\.html$/u, '');
  if (value !== '/' && !value.endsWith('/') && !value.includes('.')) {
    value = `${value}/`;
  }
  return value.replace(/\/+/g, '/');
}

async function buildCanonicalMap() {
  const htmlFiles = await collectHtmlFiles(distDir);
  const mapping = new Map();

  for (const filePath of htmlFiles) {
    const html = await fs.readFile(filePath, 'utf8');
    const dom = new JSDOM(html);
    const canonical = dom.window.document.querySelector('link[rel="canonical"]');
    if (!canonical) continue;
    const canonicalHref = canonical.getAttribute('href');
    if (!canonicalHref) continue;
    try {
      const canonicalUrl = new URL(canonicalHref);
      const canonicalPath = normaliseRoute(canonicalUrl.pathname);
      const relativePath = filePath.replace(distDir, '').replace(/\\/g, '/');
      const route = normaliseRoute(relativePath);
      mapping.set(route, canonicalPath);
      mapping.set(canonicalPath, canonicalPath);
    } catch {
      // Ignore malformed canonical links; verification script will surface the issue.
    }
  }

  return mapping;
}

function resolveCanonicalUrl(candidate, canonicalMap) {
  if (!candidate) return null;

  try {
    const resolved = new URL(candidate, SEO_MANIFEST.site);
    const lookupPath = normaliseRoute(resolved.pathname);
    const canonicalPath = canonicalMap.get(lookupPath);
    if (!canonicalPath) {
      return null;
    }
    if (candidate.startsWith('http')) {
      return new URL(canonicalPath, SEO_MANIFEST.site).toString();
    }
    if (candidate.startsWith('/')) {
      return canonicalPath;
    }
    return canonicalPath;
  } catch {
    return null;
  }
}

async function enforceCanonicalUrls() {
  const pagefindDir = join(distDir, 'pagefind');
  try {
    await fs.access(pagefindDir);
  } catch {
    return;
  }

  const manifestCandidates = ['manifest.json', 'pagefind-entry.json'];
  let manifestPath;
  for (const candidate of manifestCandidates) {
    const candidatePath = join(pagefindDir, candidate);
    try {
      await fs.access(candidatePath);
      manifestPath = candidatePath;
      break;
    } catch {
      // continue searching
    }
  }

  if (!manifestPath) {
    console.warn('[search] Unable to locate Pagefind manifest for canonical rewriting.');
    return;
  }

  const canonicalMap = await buildCanonicalMap();
  if (canonicalMap.size === 0) {
    return;
  }

  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  let mutated = false;

  const rewriteRoutes = (node) => {
    if (Array.isArray(node)) {
      node.forEach(rewriteRoutes);
      return;
    }
    if (!node || typeof node !== 'object') {
      return;
    }
    for (const [key, value] of Object.entries(node)) {
      if (value && typeof value === 'object') {
        rewriteRoutes(value);
        continue;
      }
      if (typeof value === 'string' && (key === 'url' || key === 'path')) {
        const resolved = resolveCanonicalUrl(value, canonicalMap);
        if (resolved && resolved !== value) {
          node[key] = resolved;
          mutated = true;
        }
      }
    }
  };

  rewriteRoutes(manifest);

  if (mutated) {
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    console.log('[search] Canonicalised Pagefind manifest URLs.');
  }
}

function resolvePagefindBinary() {
  const binName = process.platform === 'win32' ? 'pagefind.cmd' : 'pagefind';
  return join(projectRoot, 'node_modules', '.bin', binName);
}

async function main() {
  await fs.access(distDir).catch((error) => {
    throw new Error(`Pagefind cannot index missing directory: ${distDir}`, { cause: error });
  });

  const pagefindBin = resolvePagefindBinary();
  const args = ['--site', distDir];
  const bannerStart = process.env.CI ? '::group::pagefind::index' : '[search] ▶ Pagefind indexing start';
  const bannerEnd = process.env.CI ? '::endgroup::' : '[search] ◀ Pagefind indexing complete';

  console.log(bannerStart);
  console.log(`[search] Executing ${pagefindBin} ${args.join(' ')}`);
  const started = performance.now();

  await new Promise((resolve, reject) => {
    const child = spawn(pagefindBin, args, {
      stdio: 'inherit',
      env: {
        ...process.env,
        PAGEFIND_OUTPUT: join(distDir, 'pagefind')
      }
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Pagefind exited with status ${code}`));
      } else {
        resolve();
      }
    });
  });

  const durationSeconds = ((performance.now() - started) / 1000).toFixed(2);
  console.log(`[search] Index created in ${durationSeconds}s at ${join(distDir, 'pagefind')}`);
  console.log(bannerEnd);
  await enforceCanonicalUrls();
}

const invokedDirectly = process.argv[1] ? resolve(process.argv[1]) === modulePath : false;

if (invokedDirectly) {
  main().catch((error) => {
    console.error('[search] Pagefind indexing failed:', error);
    process.exitCode = 1;
  });
}
