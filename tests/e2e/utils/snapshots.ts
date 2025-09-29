import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';

import type { Page, TestInfo } from '@playwright/test';

export interface SnapshotAssertionOptions {
  readonly page: Page;
  readonly fixturePath: string;
  readonly route: string;
  readonly theme: string;
  readonly rationale: string;
  readonly updateCommand: string;
  readonly testInfo: TestInfo;
}

const UPDATE_ENV_FLAG = 'UPDATE_THEME_VISUAL_BASELINES';

/**
 * Formats long base64 strings so the resulting fixtures remain reviewable in
 * pull requests. Wrapping every 120 characters keeps the diff compact and lets
 * GitHub render additions/removals cleanly.
 */
function wrapBase64(content: string): string {
  return content.replace(/(.{120})/g, '$1\n');
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/**
 * Captures a full-page PNG screenshot, converts it to base64, and asserts it
 * matches the curated fixture on disk. When the `UPDATE_THEME_VISUAL_BASELINES`
 * environment flag is set the helper will refresh the stored baseline instead of
 * throwing, enabling an ergonomic "record" mode for designers iterating on the
 * UI system.
 */
export async function assertBase64Snapshot({
  page,
  fixturePath,
  route,
  theme,
  rationale,
  updateCommand,
  testInfo,
}: SnapshotAssertionOptions): Promise<void> {
  const screenshot = await page.screenshot({ fullPage: true, type: 'png' });
  const base64 = screenshot.toString('base64');

  await testInfo.attach(`${route}-${theme}-render.png`, {
    body: screenshot,
    contentType: 'image/png',
  });
  await testInfo.attach(`${route}-${theme}-render.base64.txt`, {
    body: Buffer.from(base64, 'utf8'),
    contentType: 'text/plain',
  });

  const shouldUpdate = process.env[UPDATE_ENV_FLAG] === '1';

  try {
    const expected = (await readFile(fixturePath, 'utf8')).replace(/\s/g, '');

    if (expected === base64) {
      return;
    }

    if (shouldUpdate) {
      await mkdir(dirname(fixturePath), { recursive: true });
      await writeFile(fixturePath, `${wrapBase64(base64)}\n`, 'utf8');
      console.info(
        `[theme-visual] Updated baseline for ${route} (${theme}) at ${fixturePath}.`,
      );
      return;
    }

    const expectedHash = sha256(expected);
    const actualHash = sha256(base64);
    throw new Error(
      [
        `Theme visual drift detected for route "${route}" in ${theme} mode.`,
        `• Rationale: ${rationale}`,
        `• Fixture: ${fixturePath}`,
        `• Expected SHA-256: ${expectedHash}`,
        `• Actual SHA-256:   ${actualHash}`,
        `• Update via: ${updateCommand}`,
      ].join('\n'),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      if (shouldUpdate) {
        await mkdir(dirname(fixturePath), { recursive: true });
        await writeFile(fixturePath, `${wrapBase64(base64)}\n`, 'utf8');
        console.info(
          `[theme-visual] Created new baseline for ${route} (${theme}) at ${fixturePath}.`,
        );
        return;
      }

      throw new Error(
        [
          `Missing theme visual baseline for route "${route}" in ${theme} mode.`,
          `• Fixture: ${fixturePath}`,
          `• Rationale: ${rationale}`,
          `• Generate via: ${updateCommand}`,
        ].join('\n'),
      );
    }

    throw error;
  }
}
