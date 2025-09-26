import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { TextEncoder } from 'node:util';

Object.defineProperty(globalThis, 'TextEncoder', {
  configurable: true,
  writable: true,
  value: TextEncoder,
});

const { build } = await import('esbuild');

const currentDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(currentDir, '..', '..');

const result = await build({
  entryPoints: [join(projectRoot, 'workers', 'synthetic-health.ts')],
  bundle: true,
  format: 'esm',
  write: false,
  platform: 'neutral',
  target: 'es2022',
  sourcemap: false,
});

process.stdout.write(result.outputFiles[0]?.text ?? '');
