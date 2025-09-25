import path from 'node:path';

/**
 * Recursively collect HTML documents within the provided directory.
 * The helper intentionally stays filesystem-agnostic so that both the static Astro
 * bundle (`dist/`) and Ladle storybook output (`dist/ladle/`) reuse the same
 * traversal logic.
 */
export async function collectHtmlFiles(directory) {
  const { readdir } = await import('node:fs/promises');
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return collectHtmlFiles(fullPath);
      }
      if (entry.isFile() && entry.name.endsWith('.html')) {
        return [fullPath];
      }
      return [];
    }),
  );
  return files.flat();
}

/**
 * Expand a set of target directories into an audit manifest describing each HTML file.
 * Returning the label + relative path lets reporting utilities build deterministic output
 * structures (e.g., reports/accessibility/axe/{pages|islands}/index.json).
 */
export async function collectAuditTargets(targets) {
  const { stat } = await import('node:fs/promises');

  const manifests = await Promise.all(
    targets.map(async ({ directory, label }) => {
      try {
        const stats = await stat(directory);
        if (!stats.isDirectory()) {
          return [];
        }
      } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
          return [];
        }
        throw error;
      }

      const htmlFiles = await collectHtmlFiles(directory);
      return htmlFiles.map((filePath) => ({
        filePath,
        label,
        relativePath: path.relative(directory, filePath),
      }));
    }),
  );

  return manifests.flat();
}
