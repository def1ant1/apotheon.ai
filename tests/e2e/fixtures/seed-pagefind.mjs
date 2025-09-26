#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(fileURLToPath(new URL('../..', import.meta.url)));
const targetDir = join(projectRoot, 'dist', 'pagefind');
const manifestPath = join(targetDir, 'manifest.json');

await mkdir(targetDir, { recursive: true });

const manifestPayload = {
  generatedAt: new Date().toISOString(),
  routes: ['/','/es/'],
  metadata: {
    note: 'Stub manifest seeded for Playwright tests. Replace with real Pagefind export in CI builds.',
  },
};

await writeFile(manifestPath, JSON.stringify(manifestPayload, null, 2));
