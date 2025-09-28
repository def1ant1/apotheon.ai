#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SEO_MANIFEST,
  createRouteExclusionPredicate,
} from '../../config/seo/manifest.mjs';

const modulePath = fileURLToPath(import.meta.url);
const projectRoot = fileURLToPath(new URL('../..', import.meta.url));
const distDir = join(projectRoot, 'dist');

const isRouteExcluded = createRouteExclusionPredicate();

const LOCALE_DEFINITIONS = SEO_MANIFEST.locales?.definitions ?? {};
const DEFAULT_LOCALE = SEO_MANIFEST.locales?.default ?? 'en-US';
const HREFLANG_CLUSTERS = SEO_MANIFEST.locales?.hreflang?.clusters ?? [];
const X_DEFAULT_LOCALE = SEO_MANIFEST.locales?.hreflang?.xDefault ?? DEFAULT_LOCALE;

const LOCALE_LOOKUP = new Map();
const PATH_PREFIXES = [];

for (const [code, definition] of Object.entries(LOCALE_DEFINITIONS)) {
  const canonicalCode = (definition.code ?? code).toString();
  LOCALE_LOOKUP.set(code.toLowerCase(), canonicalCode);
  LOCALE_LOOKUP.set(canonicalCode.toLowerCase(), canonicalCode);
  LOCALE_LOOKUP.set(canonicalCode.replace(/_/g, '-').toLowerCase(), canonicalCode);
  if (definition.hrefLang) {
    LOCALE_LOOKUP.set(definition.hrefLang.toLowerCase(), canonicalCode);
  }
  const baseLanguage = canonicalCode.split(/[-_]/u)[0];
  if (baseLanguage) {
    LOCALE_LOOKUP.set(baseLanguage.toLowerCase(), canonicalCode);
  }
  PATH_PREFIXES.push({
    code: canonicalCode,
    prefix: normalisePathPrefix(definition.pathPrefix ?? '/'),
  });
}

if (!LOCALE_LOOKUP.has(DEFAULT_LOCALE.toLowerCase())) {
  LOCALE_LOOKUP.set(DEFAULT_LOCALE.toLowerCase(), DEFAULT_LOCALE);
}

if (PATH_PREFIXES.length === 0) {
  PATH_PREFIXES.push({ code: DEFAULT_LOCALE, prefix: normalisePathPrefix('/') });
}

PATH_PREFIXES.sort((a, b) => b.prefix.length - a.prefix.length);

function normalisePathPrefix(prefix) {
  if (!prefix) {
    return '/';
  }
  const trimmed = prefix.trim();
  if (!trimmed || trimmed === '/') {
    return '/';
  }
  const withLeading = ensureLeadingSlash(trimmed);
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
}

function ensureLeadingSlash(value) {
  if (!value) {
    return '/';
  }
  return value.startsWith('/') ? value : `/${value}`;
}

function ensureTrailingSlash(value) {
  if (!value) {
    return '/';
  }
  if (value.endsWith('/') || value.includes('.')) {
    return value;
  }
  return `${value}/`;
}

function resolveLocaleCode(locale) {
  if (!locale) {
    return DEFAULT_LOCALE;
  }
  const normalised = locale.replace(/_/g, '-').toLowerCase();
  return LOCALE_LOOKUP.get(normalised) ?? LOCALE_LOOKUP.get(locale.toLowerCase()) ?? locale;
}

function resolveLocaleFromRoute(route) {
  const normalised = ensureLeadingSlash(route);
  for (const { code, prefix } of PATH_PREFIXES) {
    if (prefix === '/') {
      return code;
    }
    if (normalised === prefix.slice(0, -1) || normalised.startsWith(prefix)) {
      return code;
    }
  }
  return DEFAULT_LOCALE;
}

function stripLocalePrefix(route, localeCode) {
  const definition = LOCALE_DEFINITIONS[localeCode];
  const prefix = normalisePathPrefix(definition?.pathPrefix ?? '/');
  const normalised = ensureLeadingSlash(route);
  if (prefix === '/') {
    return normalised;
  }
  if (normalised === prefix.slice(0, -1)) {
    return '/';
  }
  if (normalised.startsWith(prefix)) {
    const remainder = normalised.slice(prefix.length - 1);
    return ensureLeadingSlash(remainder);
  }
  return normalised;
}

function applyLocalePrefix(routeKey, localeCode) {
  const definition = LOCALE_DEFINITIONS[localeCode];
  const prefix = normalisePathPrefix(definition?.pathPrefix ?? '/');
  const cleanRoute = ensureLeadingSlash(routeKey);
  if (prefix === '/') {
    return cleanRoute;
  }
  const trimmed = cleanRoute.startsWith('/') ? cleanRoute.slice(1) : cleanRoute;
  return `${prefix}${trimmed}`;
}

function resolveOrigin(localeCode) {
  const definition = LOCALE_DEFINITIONS[localeCode];
  if (definition?.origin) {
    return new URL(definition.origin.toString());
  }
  return new URL(SEO_MANIFEST.site.toString());
}

async function assertDistExists() {
  try {
    await fs.access(distDir);
  } catch (error) {
    throw new Error(
      `Cannot generate hreflang sitemap augmentations because dist is missing (${distDir}). Run \`astro build\` first.`,
      { cause: error },
    );
  }
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
  const relativePath = relative(distDir, filePath);
  if (relativePath === 'index.html') {
    return '/';
  }
  if (relativePath.endsWith('/index.html')) {
    const route = relativePath.replace(/\/index\.html$/u, '');
    return `/${route.replace(/\\/g, '/')}/`;
  }
  const withoutExtension = relativePath.replace(/\.html$/u, '');
  return `/${withoutExtension.replace(/\\/g, '/')}`;
}

async function readExistingLastmod() {
  const records = new Map();
  let entries = [];
  try {
    entries = await fs.readdir(distDir);
  } catch {
    return records;
  }
  for (const entry of entries) {
    if (!/^sitemap-pages.*\.xml$/u.test(entry)) continue;
    const xml = await fs.readFile(join(distDir, entry), 'utf8');
    const urlBlocks = xml.match(/<url>[\s\S]*?<\/url>/gu) ?? [];
    for (const block of urlBlocks) {
      const locMatch = block.match(/<loc>(.*?)<\/loc>/u);
      if (!locMatch?.[1]) continue;
      const lastmodMatch = block.match(/<lastmod>(.*?)<\/lastmod>/u);
      records.set(locMatch[1], lastmodMatch?.[1]);
    }
  }
  return records;
}

function buildUrlEntry(entry, alternates) {
  const lines = ['  <url>', `    <loc>${entry.loc}</loc>`];
  if (entry.lastmod) {
    lines.push(`    <lastmod>${entry.lastmod}</lastmod>`);
  }
  const { changeFrequency, priority } = SEO_MANIFEST.sitemap.cache;
  if (changeFrequency) {
    lines.push(`    <changefreq>${changeFrequency}</changefreq>`);
  }
  if (priority != null) {
    lines.push(`    <priority>${priority}</priority>`);
  }
  for (const alternate of alternates) {
    lines.push(
      `    <xhtml:link rel="alternate" hreflang="${alternate.hreflang}" href="${alternate.href}" />`,
    );
  }
  lines.push('  </url>');
  return lines.join('\n');
}

function buildUrlSetXml(entries, alternatesByRoute) {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
  ];
  for (const entry of entries) {
    const alternates = alternatesByRoute.get(entry.routeKey) ?? [];
    lines.push(buildUrlEntry(entry, alternates));
  }
  lines.push('</urlset>', '');
  return lines.join('\n');
}

async function main() {
  await assertDistExists();
  const existingLastmod = await readExistingLastmod();
  const htmlFiles = await collectHtmlFiles(distDir);
  const pages = [];
  const routeGroups = new Map();

  for (const filePath of htmlFiles) {
    const route = deriveRouteFromHtmlFile(filePath);
    if (isRouteExcluded(route)) {
      continue;
    }
    const localeCode = resolveLocaleCode(resolveLocaleFromRoute(route));
    const stats = await fs.stat(filePath);
    const routeKey = stripLocalePrefix(route, localeCode);
    const origin = resolveOrigin(localeCode);
    const canonicalPath = ensureTrailingSlash(route);
    const canonicalUrl = new URL(canonicalPath, origin).toString();
    const lastmod = existingLastmod.get(canonicalUrl) ?? stats.mtime.toISOString();

    pages.push({
      route,
      routeKey,
      localeCode,
      loc: canonicalUrl,
      lastmod,
    });

    const group = routeGroups.get(routeKey) ?? new Map();
    const definition = LOCALE_DEFINITIONS[localeCode];
    group.set(localeCode, {
      hrefLang: definition?.hrefLang ?? localeCode,
      href: canonicalUrl,
      lastmod,
    });
    routeGroups.set(routeKey, group);
  }

  const hreflangErrors = [];
  const hreflangWarnings = [];
  for (const cluster of HREFLANG_CLUSTERS) {
    if (!Array.isArray(cluster) || cluster.length <= 1) continue;
    const normalisedCluster = cluster.map((locale) => resolveLocaleCode(locale));
    for (const [routeKey, locales] of routeGroups.entries()) {
      const missing = normalisedCluster.filter((locale) => !locales.has(locale));
      const present = normalisedCluster.filter((locale) => locales.has(locale));
      if (missing.length === 0) {
        continue;
      }
      if (present.length > 1) {
        hreflangErrors.push(
          `Route "${routeKey}" is missing locale variants: ${missing.join(', ')}.`,
        );
        continue;
      }
      hreflangWarnings.push(
        `Route "${routeKey}" has only ${present.length === 0 ? '0' : '1'} generated locale. Missing variants: ${missing.join(', ')}.`,
      );
    }
  }

  if (hreflangWarnings.length > 0) {
    console.warn(
      '[hreflang] Warning: Incomplete locale coverage detected for the following routes:\n' +
        hreflangWarnings.join('\n'),
    );
  }

  if (hreflangErrors.length > 0) {
    throw new Error(
      `Hreflang validation failed. Ensure every locale in a cluster has a generated route.\n${hreflangErrors.join('\n')}`,
    );
  }

  const alternatesByRoute = new Map();
  for (const [routeKey, locales] of routeGroups.entries()) {
    const alternates = [];
    for (const [localeCode, info] of locales.entries()) {
      alternates.push({ hreflang: info.hrefLang, href: info.href });
    }
    const xDefaultCode = resolveLocaleCode(X_DEFAULT_LOCALE);
    const xDefaultSource =
      locales.get(xDefaultCode) ?? locales.get(DEFAULT_LOCALE) ?? locales.values().next().value;
    if (xDefaultSource) {
      alternates.push({ hreflang: 'x-default', href: xDefaultSource.href });
    }
    alternates.sort((a, b) => a.hreflang.localeCompare(b.hreflang));
    alternatesByRoute.set(routeKey, alternates);
  }

  const sortedPages = pages.sort((a, b) => a.loc.localeCompare(b.loc));
  const entryLimit = SEO_MANIFEST.sitemap.entryLimit;
  const chunks = [];
  for (let index = 0; index < sortedPages.length; index += entryLimit) {
    const slice = sortedPages.slice(index, index + entryLimit);
    const chunkName =
      sortedPages.length > entryLimit ? `sitemap-pages-${chunks.length + 1}.xml` : 'sitemap-pages.xml';
    const chunkPath = join(distDir, chunkName);
    const xml = buildUrlSetXml(slice, alternatesByRoute);
    await fs.writeFile(chunkPath, xml);
    chunks.push({ name: chunkName, entries: slice.length });
  }

  if (chunks.length === 0) {
    throw new Error('No sitemap chunks found to augment with hreflang metadata.');
  }

  console.info(
    `[hreflang] Injected alternate references into ${chunks.length} sitemap chunk(s) covering ${sortedPages.length} routes.`,
  );
}

const invokedDirectly =
  process.argv[1] && fileURLToPath(new URL(process.argv[1], 'file:')) === modulePath;

if (invokedDirectly) {
  main().catch((error) => {
    console.error('[hreflang] generation failed:', error);
    process.exitCode = 1;
  });
}

export { main };
