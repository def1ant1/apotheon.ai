#!/usr/bin/env tsx
/**
 * Keeps the OG asset manifest well-formed before builds run. The Astro runtime mutates the
 * manifest at generation time, but this script is part of the shared `ensure:*` lifecycle so
 * local development, CI, and deploy automation all start from a clean baseline.
 */
import { createHmac } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import matter from 'gray-matter';

interface OgManifestEntry {
  readonly expiresAt?: string;
}

interface OgManifest {
  readonly version: number;
  readonly entries: Record<string, OgManifestEntry>;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..', '..');
const manifestPath = join(projectRoot, 'src', 'generated', 'og-assets.manifest.json');
const blogContentDir = join(projectRoot, 'src', 'content', 'blog');
const socialOutputDir = join(projectRoot, 'public', 'images', 'social');

const OG_WORKER_BASE =
  process.env.OG_IMAGE_WORKER ?? process.env.PUBLIC_OG_IMAGE_WORKER ?? 'https://og.apotheon.ai';
const OG_SIGNING_SECRET = process.env.OG_IMAGE_SIGNING_SECRET ?? process.env.OG_IMAGE_WORKER_SECRET;
const isDryRun = process.argv.includes('--dry-run');

async function ensureManifestFile(): Promise<boolean> {
  try {
    await readFile(manifestPath, 'utf8');
    return false;
  } catch {
    const directory = dirname(manifestPath);
    await mkdir(directory, { recursive: true });
    const initial: OgManifest = { version: 1, entries: {} };
    await writeFile(manifestPath, `${JSON.stringify(initial, null, 2)}\n`, 'utf8');
    console.info('[og-assets] Created manifest at %s', manifestPath);
    return true;
  }
}

function isEntryExpired(entry: OgManifestEntry | undefined): boolean {
  if (!entry?.expiresAt) return false;
  const expiresAt = Date.parse(entry.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt <= Date.now();
}

async function pruneExpiredEntries(): Promise<void> {
  const contents = await readFile(manifestPath, 'utf8');
  const parsed = JSON.parse(contents) as Partial<OgManifest>;
  const entries = parsed.entries ?? {};
  const nextEntries: Record<string, OgManifestEntry> = {};
  let pruned = 0;
  for (const [key, value] of Object.entries(entries)) {
    if (isEntryExpired(value)) {
      pruned += 1;
      continue;
    }
    nextEntries[key] = value;
  }
  if (pruned > 0) {
    const updated: OgManifest = { version: parsed.version ?? 1, entries: nextEntries };
    await writeFile(manifestPath, `${JSON.stringify(updated, null, 2)}\n`, 'utf8');
    console.info('[og-assets] Pruned %d expired record(s) from manifest.', pruned);
  }
}

type SocialCandidate = {
  slug: string;
  title: string;
  description?: string;
  eyebrow?: string;
  accent?: string;
};

function toStringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function assertWithin(base: string, target: string): void {
  const resolvedBase = join(base);
  const resolvedTarget = join(target);
  const prefix = resolvedBase.endsWith(sep) ? resolvedBase : `${resolvedBase}${sep}`;
  if (!resolvedTarget.startsWith(prefix)) {
    throw new Error(`Path traversal attempt detected: ${target}`);
  }
}

async function readSocialCandidates(): Promise<SocialCandidate[]> {
  const entries = await readdir(blogContentDir);
  const candidates: SocialCandidate[] = [];
  for (const entry of entries) {
    if (!entry.endsWith('.mdx')) continue;
    const fullPath = join(blogContentDir, entry);
    assertWithin(blogContentDir, fullPath);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- path sanitised via assertWithin above.
    const raw = await readFile(fullPath, 'utf8');
    const parsed = matter(raw);
    const data = parsed.data as Record<string, unknown> & {
      openGraph?: Record<string, unknown>;
    };
    const tags = Array.isArray(data.tags)
      ? data.tags.flatMap((tag) => (typeof tag === 'string' ? [tag] : []))
      : [];
    const hasSocialTag = tags.some((tag) => tag.toLowerCase() === 'social-campaign');
    if (!hasSocialTag) continue;
    const slug = entry.replace(/\.mdx$/u, '');
    const openGraph =
      typeof data.openGraph === 'object' && data.openGraph !== null ? data.openGraph : undefined;
    candidates.push({
      slug,
      title: toStringOrUndefined(data.title) ?? slug,
      description: toStringOrUndefined(data.description),
      eyebrow: toStringOrUndefined(openGraph?.eyebrow) ?? 'Campaign spotlight',
      accent: toStringOrUndefined(openGraph?.accent),
    });
  }
  return candidates;
}

function buildSignedUrl(pathname: string, params: URLSearchParams, secret: string): string {
  const canonicalEntries = Array.from(params.entries()).filter(([key]) => key !== 'signature');
  canonicalEntries.sort(([a], [b]) => a.localeCompare(b));
  const canonical = `${pathname}?${new URLSearchParams(canonicalEntries).toString()}`;
  const signature = createHmac('sha256', secret).update(canonical).digest('base64url');
  const finalParams = new URLSearchParams(canonicalEntries);
  finalParams.set('signature', signature);
  const base = OG_WORKER_BASE.replace(/\/$/u, '');
  return `${base}${pathname}?${finalParams.toString()}`;
}

async function refreshSocialAssets(): Promise<void> {
  if (!OG_SIGNING_SECRET) {
    console.warn(
      '[og-assets] Skipping social asset refresh; OG_IMAGE_SIGNING_SECRET not configured.',
    );
    return;
  }
  const candidates = await readSocialCandidates();
  if (candidates.length === 0) {
    return;
  }
  await mkdir(socialOutputDir, { recursive: true });
  const expires = Math.floor(Date.now() / 1000) + 60 * 60; // one hour signed URL window
  for (const candidate of candidates) {
    for (const theme of ['dark', 'light']) {
      const params = new URLSearchParams({
        title: candidate.title,
        variant: 'twitter',
        theme,
        expires: String(expires),
        source: 'ensure-og-assets',
      });
      if (candidate.description) {
        params.set('subtitle', candidate.description);
      }
      if (candidate.eyebrow) {
        params.set('eyebrow', candidate.eyebrow);
      }
      if (candidate.accent) {
        params.set('accent', candidate.accent);
      }

      const path = `/og/blog/${candidate.slug}.png`;
      const signedUrl = buildSignedUrl(path, params, OG_SIGNING_SECRET);
      const outputPath = join(socialOutputDir, `${candidate.slug}-twitter-${theme}.png`);

      if (isDryRun) {
        console.info('[og-assets] (dry-run) %s -> %s', signedUrl, outputPath);
        continue;
      }

      try {
        assertWithin(socialOutputDir, outputPath);
        const response = await fetch(signedUrl);
        if (!response.ok) {
          console.warn(
            '[og-assets] Failed to refresh %s (%s theme); status %d',
            candidate.slug,
            theme,
            response.status,
          );
          continue;
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- output path normalised via assertWithin above.
        await writeFile(outputPath, buffer);
        console.info('[og-assets] Updated social card %s', outputPath);
      } catch (error) {
        console.error(
          '[og-assets] Error refreshing OG asset %s (%s theme):',
          candidate.slug,
          theme,
          error,
        );
      }
    }
  }
}

async function main(): Promise<void> {
  await ensureManifestFile();
  await pruneExpiredEntries();
  await refreshSocialAssets();
}

main().catch((error) => {
  console.error('[og-assets] Failed to prepare manifest:', error);
  process.exitCode = 1;
});
