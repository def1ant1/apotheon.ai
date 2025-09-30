import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repoRoot = join(fileURLToPath(new URL('..', import.meta.url)), '..');
const script = join(repoRoot, 'scripts', 'ci', 'run-lychee.mjs');

function runLychee(args: string[]) {
  return new Promise<{ code: number | null }>((resolve, reject) => {
    const child = spawn('node', [script, ...args], {
      cwd: repoRoot,
      env: { ...process.env, FORCE_COLOR: '0' },
      stdio: 'ignore',
    });

    child.once('error', (error) => {
      reject(error);
    });

    child.once('close', (code) => {
      resolve({ code });
    });
  });
}

describe('lychee orchestration', () => {
  it('passes when all fixture links resolve', async () => {
    const { code } = await runLychee([
      '--paths',
      join('tests', 'fixtures', 'link-check', 'valid.md'),
      '--offline',
    ]);

    expect(code).toBe(0);
  });

  it('fails when the fixture contains a broken link', async () => {
    const { code } = await runLychee([
      '--paths',
      join('tests', 'fixtures', 'link-check', 'broken.md'),
      '--offline',
    ]);

    expect(code).not.toBe(0);
  });
});
