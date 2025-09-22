import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/* eslint-disable security/detect-non-literal-fs-filename */

export type OgScope = 'blog' | 'marketing';

export interface OgManifestEntry {
  readonly key: string;
  readonly scope: OgScope;
  readonly slug: string;
  readonly variant: string;
  readonly url: string;
  readonly workerEndpoint: string;
  readonly signature: string;
  readonly expiresAt: string;
  readonly generatedAt: string;
  readonly width: number;
  readonly height: number;
  readonly format: string;
  readonly source?: string | null;
  readonly lcpCandidate?: boolean;
}

export interface OgManifest {
  version: number;
  entries: Record<string, OgManifestEntry>;
}

const MANIFEST_URL = new URL('../generated/og-assets.manifest.json', import.meta.url);
let cachedManifest: OgManifest | null = null;
let manifestPath: string | null = null;

function resolveManifestPath(): string {
  if (!manifestPath) {
    manifestPath = fileURLToPath(MANIFEST_URL);
  }
  return manifestPath;
}

async function ensureManifestExists(): Promise<void> {
  const path = resolveManifestPath();
  try {
    await readFile(path, 'utf8');
  } catch {
    const directory = dirname(path);
    await mkdir(directory, { recursive: true });
    const initial: OgManifest = { version: 1, entries: {} };
    await writeFile(path, `${JSON.stringify(initial, null, 2)}\n`, 'utf8');
    cachedManifest = initial;
  }
}

export function buildManifestKey(scope: OgScope, slug: string, variant: string): string {
  return `${scope}::${slug}::${variant}`;
}

export async function readManifest(): Promise<OgManifest> {
  if (cachedManifest) {
    return cachedManifest;
  }
  const path = resolveManifestPath();
  await ensureManifestExists();
  const contents = await readFile(path, 'utf8');
  try {
    const parsed = JSON.parse(contents) as OgManifest;
    cachedManifest = {
      version: parsed.version ?? 1,
      entries: parsed.entries ?? {},
    };
  } catch (error) {
    throw new Error(
      `Failed to parse OG manifest: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return cachedManifest ?? { version: 1, entries: {} };
}

async function writeManifest(manifest: OgManifest): Promise<void> {
  const path = resolveManifestPath();
  const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, serialized, 'utf8');
  cachedManifest = manifest;
}

export async function getManifestEntry(
  scope: OgScope,
  slug: string,
  variant: string,
): Promise<OgManifestEntry | null> {
  const manifest = await readManifest();
  const key = buildManifestKey(scope, slug, variant);
  return manifest.entries[key] ?? null;
}

export async function upsertManifestEntry(entry: OgManifestEntry): Promise<void> {
  const manifest = await readManifest();
  const next: OgManifest = {
    version: manifest.version ?? 1,
    entries: {
      ...manifest.entries,
      [entry.key]: entry,
    },
  };
  await writeManifest(next);
}

export async function pruneExpiredManifestEntries(now = Date.now()): Promise<number> {
  const manifest = await readManifest();
  const entries = Object.entries(manifest.entries);
  const remaining: Record<string, OgManifestEntry> = {};
  let pruned = 0;
  for (const [key, value] of entries) {
    if (Date.parse(value.expiresAt) > now) {
      remaining[key] = value;
    } else {
      pruned += 1;
    }
  }
  if (pruned > 0) {
    await writeManifest({ version: manifest.version ?? 1, entries: remaining });
  }
  return pruned;
}
