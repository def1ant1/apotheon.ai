import path from 'node:path';

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
