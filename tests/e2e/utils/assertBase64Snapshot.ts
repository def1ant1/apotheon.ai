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
const UPDATE_COMMAND = 'npm run test:e2e:update-theme-visual';
const CHARS_PER_LINE = 120;
const COMMENT_PREFIX = '# ';

function buildCommentHeader(scenarioLabel: string, relativeFixture: string): string {
  const routeThemeMatch = scenarioLabel.match(/^(?<route>.*) \((?<theme>.*)\)$/);
  const route = routeThemeMatch?.groups?.route?.trim() ?? scenarioLabel;
  const theme = routeThemeMatch?.groups?.theme?.trim() ?? 'unspecified';

  const lines = [
    `${COMMENT_PREFIX}Route: ${route}`,
    `${COMMENT_PREFIX}Theme: ${theme}`,
    `${COMMENT_PREFIX}Regenerate: ${UPDATE_COMMAND}`,
    `${COMMENT_PREFIX}Fixture: ${relativeFixture}`,
    '',
  ];

  return lines.join('\n');
}

function stripCommentLines(payload: string): string {
  return payload
    .split('\n')
    .filter((line) => !line.trimStart().startsWith(COMMENT_PREFIX.trim()))
    .join('\n');
}

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
  const formattedPayload =
    base64Payload.match(new RegExp(`.{1,${CHARS_PER_LINE}}`, 'g'))?.join('\n') ?? '';
  const relativeFixture = relative(process.cwd(), fixturePath);

  if (process.env[UPDATE_FLAG] === '1') {
    await mkdir(dirname(fixturePath), { recursive: true }); // eslint-disable-line security/detect-non-literal-fs-filename

    const header = buildCommentHeader(scenarioLabel, relativeFixture);
    await writeFile(fixturePath, `${header}${formattedPayload}\n`, 'utf8'); // eslint-disable-line security/detect-non-literal-fs-filename

    return;
  }

  let baseline: string;
  try {
    const fileContents = await readFile(fixturePath, 'utf8'); // eslint-disable-line security/detect-non-literal-fs-filename
    baseline = stripCommentLines(fileContents).replace(/\s/g, '');
  } catch (error) {
    const hint = [
      `Missing visual baseline for ${scenarioLabel}.`,
      `Expected fixture: ${relativeFixture}.`,
      `Re-run the spec with the dedicated npm helper (it exports \`${UPDATE_FLAG}=1\` automatically):`,
      `  ${UPDATE_COMMAND}`,
    ].join('\n');

    throw new Error(hint, { cause: error });
  }

  const message = [
    `Visual regression detected for ${scenarioLabel}.`,
    `Baseline fixture: ${relativeFixture}.`,
    `If the new rendering is intentional, regenerate the stored payload via:`,
    `  ${UPDATE_COMMAND}`,
    'Snapshots are persisted as base64-encoded PNG text to keep diffs reviewable while staying binary-free.',
  ].join('\n');

  expect(base64Payload.replace(/\s/g, ''), message).toBe(baseline);
}
