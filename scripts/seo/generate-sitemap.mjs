#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SEO_MANIFEST,
  SITEMAP_INDEX_BASENAME,
  createRouteExclusionPredicate,
} from '../../config/seo/manifest.mjs';
import { parse } from 'yaml';

const modulePath = fileURLToPath(import.meta.url);
const projectRoot = fileURLToPath(new URL('../..', import.meta.url));
const distDir = join(projectRoot, 'dist');
const contentDir = join(projectRoot, 'src', 'content');
const blogContentDir = join(contentDir, 'blog');

const isRouteExcluded = createRouteExclusionPredicate();

async function assertDistExists() {
  try {
    await fs.access(distDir);
  } catch (error) {
    throw new Error(`Cannot generate sitemap because dist is missing (${distDir}). Run \`astro build\` first.`, {
      cause: error,
    });
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

async function readBlogFrontmatterDates() {
  const metadata = new Map();
  let entries = [];
  try {
    entries = await fs.readdir(blogContentDir);
  } catch {
    return metadata;
  }

  for (const entry of entries) {
    if (!entry.endsWith('.mdx')) continue;
    const fullPath = join(blogContentDir, entry);
    const raw = await fs.readFile(fullPath, 'utf8');
    const match = raw.match(/^---\n([\s\S]*?)\n---/u);
    if (!match) continue;
    const frontmatter = parse(match[1]);
    if (frontmatter?.draft) continue;
    const publishDate = frontmatter?.publishDate ? new Date(frontmatter.publishDate) : undefined;
    const updatedDate = frontmatter?.updatedDate ? new Date(frontmatter.updatedDate) : undefined;
    const timestamp = updatedDate ?? publishDate;
    if (!timestamp) continue;
    const route = `/blog/${entry.replace(/\.mdx$/u, '')}/`;
    metadata.set(route, timestamp.toISOString());
  }

  return metadata;
}

function buildUrlEntry(loc, lastmod) {
  const { changeFrequency, priority } = SEO_MANIFEST.sitemap.cache;
  return [
    '  <url>',
    `    <loc>${loc}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
    changeFrequency ? `    <changefreq>${changeFrequency}</changefreq>` : null,
    priority != null ? `    <priority>${priority}</priority>` : null,
    '  </url>',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildUrlSetXml(entries) {
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'];
  for (const entry of entries) {
    lines.push(buildUrlEntry(entry.loc, entry.lastmod));
  }
  lines.push('</urlset>', '');
  return lines.join('\n');
}

function buildSitemapIndexXml(chunks) {
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'];
  const now = new Date().toISOString();
  for (const chunk of chunks) {
    lines.push('  <sitemap>');
    lines.push(`    <loc>${chunk.loc}</loc>`);
    lines.push(`    <lastmod>${now}</lastmod>`);
    lines.push('  </sitemap>');
  }
  lines.push('</sitemapindex>', '');
  return lines.join('\n');
}

async function writeFile(filePath, contents) {
  await fs.mkdir(dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, contents);
}

async function main() {
  await assertDistExists();
  const htmlFiles = await collectHtmlFiles(distDir);
  const blogMetadata = await readBlogFrontmatterDates();

  const entries = [];
  for (const filePath of htmlFiles) {
    const route = deriveRouteFromHtmlFile(filePath);
    if (isRouteExcluded(route)) {
      continue;
    }
    const url = new URL(route, SEO_MANIFEST.site).toString();
    const stats = await fs.stat(filePath);
    const lastmod = blogMetadata.get(route) ?? stats.mtime.toISOString();
    entries.push({ loc: url, lastmod });
  }

  entries.sort((a, b) => a.loc.localeCompare(b.loc));

  const entryLimit = SEO_MANIFEST.sitemap.entryLimit;
  const chunks = [];
  for (let index = 0; index < entries.length; index += entryLimit) {
    const slice = entries.slice(index, index + entryLimit);
    const chunkName = entries.length > entryLimit ? `sitemap-pages-${chunks.length + 1}.xml` : 'sitemap-pages.xml';
    const chunkPath = join(distDir, chunkName);
    const chunkUrl = new URL(chunkName, SEO_MANIFEST.site).toString();
    await writeFile(chunkPath, buildUrlSetXml(slice));
    chunks.push({ name: chunkName, loc: chunkUrl });
  }

  if (chunks.length === 0) {
    throw new Error('No sitemap entries were generated.');
  }

  const indexPath = join(distDir, SITEMAP_INDEX_BASENAME);
  await writeFile(indexPath, buildSitemapIndexXml(chunks));

  console.info(`[sitemap] Generated ${chunks.length} chunk(s) with ${entries.length} routes.`);
}

const invokedDirectly = process.argv[1] ? fileURLToPath(new URL(process.argv[1], 'file:')) === modulePath : false;

if (invokedDirectly) {
  main().catch((error) => {
    console.error('[sitemap] generation failed:', error);
    process.exitCode = 1;
  });
}
