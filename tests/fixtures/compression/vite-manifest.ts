import { promises as fs } from 'node:fs';

import { z } from 'zod';

/**
 * Declarative schema for the subset of Vite's manifest output that we care
 * about when verifying compression coverage. The manifest can grow additional
 * metadata over time, so we intentionally keep the parser liberal while still
 * guaranteeing the critical `file` pointer resolves to an emitted chunk.
 */
const ViteManifestEntrySchema = z.object({
  file: z.string(),
  src: z.string().optional(),
  isEntry: z.boolean().optional(),
  isDynamicEntry: z.boolean().optional(),
  imports: z.array(z.string()).optional(),
  dynamicImports: z.array(z.string()).optional(),
  css: z.array(z.string()).optional(),
  assets: z.array(z.string()).optional(),
});

const ViteManifestSchema = z.record(ViteManifestEntrySchema);

export type ViteManifest = z.infer<typeof ViteManifestSchema>;
export type ViteManifestEntry = z.infer<typeof ViteManifestEntrySchema>;

/**
 * Reads and validates the Vite manifest generated during `astro build`. The
 * helper doubles as the single entry point for specs and operational tooling so
 * nobody has to remember to sprinkle `JSON.parse` / `fs.readFile` boilerplate
 * throughout the codebase. Centralising the logic keeps the automation surface
 * deterministic and documents the expectation that `npm run build` must be
 * executed before consumers attempt to hydrate the manifest.
 */
export async function readViteManifest(manifestPath: string): Promise<ViteManifest> {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- Fixture path resolved inside the repository workspace.
  const raw = await fs.readFile(manifestPath, 'utf8');
  const parsed = JSON.parse(raw);
  const result = ViteManifestSchema.safeParse(parsed);

  if (!result.success) {
    throw new Error(
      `Vite manifest at ${manifestPath} failed schema validation: ${result.error.toString()}`,
    );
  }

  return result.data;
}
