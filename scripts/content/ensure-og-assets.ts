#!/usr/bin/env tsx
/**
 * Keeps the OG asset manifest well-formed before builds run. The Astro runtime mutates the
 * manifest at generation time, but this script is part of the shared `ensure:*` lifecycle so
 * local development, CI, and deploy automation all start from a clean baseline.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

async function main(): Promise<void> {
  await ensureManifestFile();
  await pruneExpiredEntries();
}

main().catch((error) => {
  console.error('[og-assets] Failed to prepare manifest:', error);
  process.exitCode = 1;
});
