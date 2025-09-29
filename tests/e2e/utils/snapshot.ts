import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative } from 'node:path';

import { expect, type Page, type TestInfo } from '@playwright/test';

/**
 * Shared environment toggle that mirrors Playwright's native snapshot updating
 * semantics. When set to `1` the helper rewrites fixtures instead of failing the
 * assertion, keeping CLI tooling and ad-hoc test runs aligned.
 */
export const PLAYWRIGHT_SNAPSHOT_UPDATE_ENV = 'PLAYWRIGHT_UPDATE_SNAPSHOTS';

/**
 * Canonical npm script exposed to contributors when diffs occur. Centralising
 * the message prevents typos from sneaking into error text and ensures docs,
 * tests, and CLI helpers stay in sync.
 */
const UPDATE_COMMAND = 'npm run test:e2e:update-theme-visual';

/**
 * Wrapping base64 output mirrors the POSIX `base64` CLI (76 characters per
 * line). Keeping the format stable drastically improves readability when
 * reviewing fixtures in pull requests.
 */
const BASE64_LINE_LENGTH = 76;

/** Human-readable prefix used for the metadata banner stored above each payload. */
const COMMENT_PREFIX = '# ';

interface ComparePngSnapshotOptions {
  readonly page: Page;
  readonly fixturePath: string;
  readonly routePath: string;
  readonly slug: string;
  readonly theme: string;
  readonly testInfo?: TestInfo;
}

function chunkBase64Payload(payload: string): string {
  const matches = payload.match(new RegExp(`.{1,${BASE64_LINE_LENGTH}}`, 'g'));
  return matches?.join('\n') ?? payload;
}

function sanitisePayload(payload: string): string {
  return payload.replace(/\s/g, '');
}

function stripCommentLines(contents: string): string {
  return contents
    .split('\n')
    .filter((line) => !line.trimStart().startsWith(COMMENT_PREFIX.trim()))
    .join('\n');
}

function hashPayload(payload: string): string {
  return createHash('sha256').update(payload).digest('hex');
}

function buildCommentHeader(routePath: string, theme: string, fixturePath: string): string {
  const relativeFixture = relative(process.cwd(), fixturePath);
  return [
    `${COMMENT_PREFIX}Route: ${routePath}`,
    `${COMMENT_PREFIX}Theme: ${theme}`,
    `${COMMENT_PREFIX}Fixture: ${relativeFixture}`,
    `${COMMENT_PREFIX}Regenerate: ${UPDATE_COMMAND}`,
    '',
  ].join('\n');
}

async function attachArtifacts(
  options: ComparePngSnapshotOptions,
  formattedPayload: string,
  pngBuffer: Buffer,
): Promise<void> {
  if (!options.testInfo) {
    return;
  }

  const baseName = `${options.slug}__${options.theme}`;
  await options.testInfo.attach(`${baseName}.png`, {
    body: pngBuffer,
    contentType: 'image/png',
  });
  await options.testInfo.attach(`${baseName}.base64.txt`, {
    body: Buffer.from(`${formattedPayload}\n`, 'utf8'),
    contentType: 'text/plain',
  });
}

/**
 * Captures a deterministic PNG snapshot for the supplied route/theme pairing,
 * diffs it against the committed baseline, and emits an actionable assertion
 * when drift occurs. The helper intentionally centralises fixture formatting so
 * humans reviewing pull requests see clean, line-wrapped payloads.
 */
export async function comparePngSnapshot(options: ComparePngSnapshotOptions): Promise<void> {
  const screenshot = await options.page.screenshot({ type: 'png', fullPage: true });
  const base64 = screenshot.toString('base64');
  const formatted = chunkBase64Payload(base64);
  const normalised = sanitisePayload(formatted);
  const header = buildCommentHeader(options.routePath, options.theme, options.fixturePath);
  const relativeFixture = relative(process.cwd(), options.fixturePath);

  let baselineNormalised: string | null = null;
  try {
    const existingFixture = await readFile(options.fixturePath, 'utf8');
    baselineNormalised = sanitisePayload(stripCommentLines(existingFixture));
  } catch (error) {
    if (process.env[PLAYWRIGHT_SNAPSHOT_UPDATE_ENV] === '1') {
      await mkdir(dirname(options.fixturePath), { recursive: true });
      await writeFile(options.fixturePath, `${header}${formatted}\n`, 'utf8');
      return;
    }

    await attachArtifacts(options, formatted, screenshot);

    throw new Error(
      [
        `Missing visual baseline for ${options.routePath} (${options.theme}).`,
        `Expected fixture: ${relativeFixture}.`,
        `Run \`${UPDATE_COMMAND}\` to seed the snapshot set once the UI renders correctly.`,
      ].join('\n'),
      { cause: error },
    );
  }

  if (process.env[PLAYWRIGHT_SNAPSHOT_UPDATE_ENV] === '1') {
    await mkdir(dirname(options.fixturePath), { recursive: true });
    await writeFile(options.fixturePath, `${header}${formatted}\n`, 'utf8');
    return;
  }

  if (baselineNormalised === normalised) {
    return;
  }

  await attachArtifacts(options, formatted, screenshot);

  const baselineHash = hashPayload(baselineNormalised);
  const nextHash = hashPayload(normalised);
  const message = [
    `Visual regression detected for ${options.routePath} (${options.theme}).`,
    `Fixture: ${relativeFixture}.`,
    `Expected hash: ${baselineHash}.`,
    `Received hash: ${nextHash}.`,
    `Run \`${UPDATE_COMMAND}\` after verifying the new pixels locally.`,
  ].join('\n');

  expect(normalised, message).toBe(baselineNormalised);
}
