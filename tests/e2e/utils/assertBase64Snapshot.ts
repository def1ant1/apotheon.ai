import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative } from 'node:path';

import { expect } from '@playwright/test';

interface SnapshotAssertionInput {
  /**
   * Raw PNG bytes captured from Playwright's `page.screenshot()` helper. The caller remains
   * responsible for disabling animations and waiting for hydration so that the encoded snapshot
   * stays deterministic. A shared helper keeps the baseline management logic centralized.
   */
  pngBuffer: Buffer;
  /**
   * Absolute path to the UTF-8 text fixture that stores the base64-encoded PNG payload. We persist
   * snapshots as text so Git diffs remain reviewable in code review while still capturing pixel-perfect
   * regressions without relying on binary assets.
   */
  fixturePath: string;
  /**
   * Human-friendly label (e.g., `/solutions/ (dark)`) used in assertion messages. This gives future
   * contributors immediate context on which combination fired without inspecting the stack trace.
   */
  scenarioLabel: string;
}

const UPDATE_FLAG = 'UPDATE_THEME_VISUAL_BASELINES';
const CHARS_PER_LINE = 120;

/**
 * Encodes the provided PNG buffer into base64, writes/updates the stored fixture when the dedicated
 * environment toggle (`UPDATE_THEME_VISUAL_BASELINES=1`) is set, and otherwise performs a strict
 * equality assertion against the curated baseline. Storing the artifact as base64 text keeps the repo
 * binary-free and enables conventional diff tooling when snapshots intentionally change.
 */
export async function assertBase64Snapshot({
  pngBuffer,
  fixturePath,
  scenarioLabel,
}: SnapshotAssertionInput): Promise<void> {
  const base64Payload = pngBuffer.toString('base64');
  const formattedPayload = base64Payload.match(new RegExp(`.{1,${CHARS_PER_LINE}}`, 'g'))?.join('\n') ?? '';
  const relativeFixture = relative(process.cwd(), fixturePath);

  if (process.env[UPDATE_FLAG] === '1') {
    await mkdir(dirname(fixturePath), { recursive: true });

    await writeFile(
      fixturePath,
      `${formattedPayload}\n`,
      'utf8',
    );

    return;
  }

  let baseline: string;
  try {
    baseline = (await readFile(fixturePath, 'utf8')).replace(/\s/g, '');
  } catch (error) {
    const hint = [
      `Missing visual baseline for ${scenarioLabel}.`,
      `Expected fixture: ${relativeFixture}.`,
      `Re-run the spec with \`${UPDATE_FLAG}=1\` to seed the snapshot automatically:`,
      `  ${UPDATE_FLAG}=1 npx playwright test tests/e2e/theme-visual.spec.ts`,
    ].join('\n');

    throw new Error(hint, { cause: error });
  }

  const message = [
    `Visual regression detected for ${scenarioLabel}.`,
    `Baseline fixture: ${relativeFixture}.`,
    `If the new rendering is intentional, regenerate the stored payload by running:`,
    `  ${UPDATE_FLAG}=1 npx playwright test tests/e2e/theme-visual.spec.ts`,
    'Snapshots are persisted as base64-encoded PNG text to keep diffs reviewable while staying binary-free.',
  ].join('\n');

  expect(base64Payload.replace(/\s/g, ''), message).toBe(baseline);
}
