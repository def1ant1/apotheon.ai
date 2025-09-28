#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

import {
  SEO_MANIFEST,
  SITEMAP_INDEX_BASENAME,
  createRouteExclusionPredicate,
  getSitemapIndexUrl
} from '../../config/seo/manifest.mjs';

const modulePath = fileURLToPath(import.meta.url);
const projectRoot = fileURLToPath(new URL('../..', import.meta.url));
const distDir = join(projectRoot, 'dist');

const isRouteExcluded = createRouteExclusionPredicate();

async function readText(filePath) {
  return fs.readFile(filePath, 'utf8');
}

async function assertFileExists(filePath, message) {
  try {
    await fs.access(filePath);
  } catch (error) {
    throw new Error(message, { cause: error });
  }
}

function extractLocEntries(xml) {
  const matches = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g));
  return matches.map(([, loc]) => loc.trim());
}

async function collectSitemapRoutes() {
  const sitemapIndexPath = join(distDir, SITEMAP_INDEX_BASENAME);
  await assertFileExists(sitemapIndexPath, `Missing sitemap index at ${sitemapIndexPath}`);
  const sitemapIndexXml = await readText(sitemapIndexPath);
  const sitemapUrls = extractLocEntries(sitemapIndexXml);

  if (sitemapUrls.length === 0) {
    throw new Error('Sitemap index contained no <loc> entries.');
  }

  const routeSet = new Set();
  for (const sitemapUrl of sitemapUrls) {
    const url = new URL(sitemapUrl);
    const sitemapPath = join(distDir, url.pathname.replace(/^\//, ''));
    await assertFileExists(sitemapPath, `Missing sitemap chunk referenced at ${sitemapPath}`);
    const chunkXml = await readText(sitemapPath);
    const chunkRoutes = extractLocEntries(chunkXml);
    chunkRoutes.forEach((route) => routeSet.add(route));
  }

  return routeSet;
}

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

function deriveRouteFromHtmlFile(filePath) {
  const relativePath = filePath.replace(distDir, '').replace(/\\/g, '/');
  if (relativePath === '/index.html') {
    return '/';
  }
  if (relativePath.endsWith('/index.html')) {
    return relativePath.replace('/index.html', '/');
  }
  return relativePath.replace(/\.html$/u, '');
}

async function verifyHtmlMetadata() {
  const htmlFiles = await collectHtmlFiles(distDir);
  for (const filePath of htmlFiles) {
    const route = deriveRouteFromHtmlFile(filePath);
    if (isRouteExcluded(route)) {
      continue;
    }
    if (route.startsWith('/admin')) {
      console.info(`[verify] Skipping admin surface verification for ${route}.`);
      continue;
    }

    const html = await readText(filePath);
    const dom = new JSDOM(html);
    const { document } = dom.window;

    const canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      throw new Error(`Missing canonical link in ${filePath}`);
    }
    const canonicalHref = canonicalLink.getAttribute('href');
    if (!canonicalHref) {
      throw new Error(`Canonical link is empty in ${filePath}`);
    }
    try {
      new URL(canonicalHref);
    } catch (error) {
      throw new Error(`Canonical link is not an absolute URL in ${filePath}: ${canonicalHref}`, { cause: error });
    }

    const descriptionMeta = document.querySelector('meta[name="description"]');
    if (!descriptionMeta || !descriptionMeta.getAttribute('content')) {
      throw new Error(`Missing meta description in ${filePath}`);
    }

    const schemaNodes = [...document.querySelectorAll('script[type="application/ld+json"]')];
    if (schemaNodes.length === 0) {
      throw new Error(`Structured data scripts missing in ${filePath}`);
    }
    for (const node of schemaNodes) {
      const payload = node.textContent?.trim();
      if (!payload) {
        throw new Error(`Empty JSON-LD payload detected in ${filePath}`);
      }
      try {
        JSON.parse(payload);
      } catch (error) {
        throw new Error(`Invalid JSON-LD payload in ${filePath}`, { cause: error });
      }
    }
  }
  console.info('[verify] HTML metadata checks passed.');
}

async function verifySitemap() {
  const routes = await collectSitemapRoutes();
  const sitemapUrl = getSitemapIndexUrl();
  console.info(`[verify] Sitemap index located at ${sitemapUrl} with ${routes.size} routes.`);

  for (const criticalPath of SEO_MANIFEST.routes.criticalPaths) {
    const expectedUrl = new URL(criticalPath, SEO_MANIFEST.site).toString();
    if (!routes.has(expectedUrl)) {
      throw new Error(`Critical route ${expectedUrl} missing from sitemap.`);
    }
  }

  for (const route of routes) {
    const { pathname } = new URL(route);
    if (isRouteExcluded(pathname)) {
      throw new Error(`Excluded route ${route} unexpectedly present in sitemap.`);
    }
  }
}

async function verifyRobots() {
  const robotsPath = join(distDir, 'robots.txt');
  await assertFileExists(robotsPath, `Missing robots.txt at ${robotsPath}`);
  const robotsContent = await readText(robotsPath);
  const sitemapUrl = getSitemapIndexUrl();

  if (!robotsContent.includes(`Sitemap: ${sitemapUrl}`)) {
    throw new Error(`robots.txt is missing the sitemap pointer (${sitemapUrl}).`);
  }

  const stageLine = robotsContent.split('\n').find((line) => line.startsWith('# Environment stage:'));
  if (!stageLine) {
    throw new Error('robots.txt is missing the environment stage banner.');
  }

  console.info(`[verify] robots.txt present with environment banner (${stageLine}).`);
}

async function verifyPagefind() {
  const pagefindDir = join(distDir, 'pagefind');
  const manifestCandidates = ['manifest.json', 'pagefind-entry.json'];
  let foundManifest;

  for (const candidate of manifestCandidates) {
    const candidatePath = join(pagefindDir, candidate);
    try {
      await fs.access(candidatePath);
      foundManifest = candidatePath;
      break;
    } catch (error) {
      // ignore missing files, we'll error below if none exist
    }
  }

  if (!foundManifest) {
    throw new Error(`Missing Pagefind manifest in ${pagefindDir}`);
  }

  const runtimePath = join(pagefindDir, 'pagefind.js');
  await assertFileExists(runtimePath, `Missing Pagefind runtime at ${runtimePath}`);

  console.info(`[verify] Pagefind assets located (${foundManifest}, ${runtimePath}).`);
}

async function main() {
  await fs.access(distDir).catch((error) => {
    throw new Error(`Cannot verify SEO assets because dist is missing (${distDir}).`, { cause: error });
  });

  await verifySitemap();
  await verifyRobots();
  await verifyPagefind();
  await verifyHtmlMetadata();
  console.info('[verify] SEO smoke checks passed.');
}

const invokedDirectly = process.argv[1] ? resolve(process.argv[1]) === modulePath : false;

if (invokedDirectly) {
  main().catch((error) => {
    console.error('[verify] SEO verification failed:', error);
    process.exitCode = 1;
  });
}
