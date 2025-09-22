/* eslint-disable security/detect-non-literal-fs-filename */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export interface ImageDerivativeManifest {
  readonly avif?: string;
  readonly webp?: string;
  readonly [format: string]: string | undefined;
}

export interface ImageManifestEntry {
  readonly base: string;
  readonly derivatives?: ImageDerivativeManifest;
  readonly preload?: boolean;
  readonly lcpCandidate?: boolean;
  readonly width?: number;
  readonly height?: number;
  readonly checksum?: string;
  readonly [key: string]: unknown;
}

export interface ImageManifest {
  version: number;
  assets: Record<string, ImageManifestEntry>;
}

export async function readImageManifest(path: string): Promise<ImageManifest> {
  try {
    const contents = await readFile(path, 'utf8');
    const parsed = JSON.parse(contents) as Partial<ImageManifest>;
    return { version: parsed.version ?? 1, assets: parsed.assets ?? {} };
  } catch {
    return { version: 1, assets: {} };
  }
}

export async function writeImageManifest(path: string, manifest: ImageManifest): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
  await writeFile(path, serialized, 'utf8');
}

export function toForwardSlash(path: string): string {
  return path.replace(/\\/g, '/');
}

export function upsertImageAsset(
  manifest: ImageManifest,
  key: string,
  entry: ImageManifestEntry,
): ImageManifest {
  return {
    version: manifest.version ?? 1,
    assets: {
      ...manifest.assets,
      [key]: {
        ...(manifest.assets?.[key] ?? {}),
        ...entry,
      },
    },
  };
}
