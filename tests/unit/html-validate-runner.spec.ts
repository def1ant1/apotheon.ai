import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {describe, expect, it, vi} from 'vitest';

const scriptPath = new URL('../../scripts/ci/run-html-validate.mjs', import.meta.url).href;
const repoRoot = resolve(fileURLToPath(new URL('../../', import.meta.url)));

function createLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe('runHtmlValidate', () => {
  it('passes through when html-validate reports no issues', async () => {
    const {runHtmlValidate} = await import(scriptPath);
    const invoke = vi.fn().mockResolvedValue({
      code: 0,
      stdout: JSON.stringify([
        {
          filePath: join(repoRoot, 'tests/fixtures/html-validator/broken-form.html'),
          errorCount: 0,
          warningCount: 0,
          messages: [],
        },
      ]),
      stderr: '',
    });
    const logger = createLogger();

    const summary = await runHtmlValidate({
      invoke,
      logger,
      targets: [
        {
          label: 'Fixture HTML',
          path: join(repoRoot, 'tests/fixtures/html-validator'),
        },
      ],
    });

    expect(summary.errorCount).toBe(0);
    expect(summary.warningCount).toBe(0);
    expect(invoke).toHaveBeenCalledWith(
      join(repoRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'html-validate.cmd' : 'html-validate'),
      [
        '--config',
        join(repoRoot, 'config', 'htmlvalidate.json'),
        '--formatter',
        'json',
        join(repoRoot, 'tests/fixtures/html-validator/broken-form.html'),
        join(repoRoot, 'tests/fixtures/html-validator/duplicate-main.html'),
      ],
    );
    expect(summary.scanned).toBe(2);
    expect(logger.info).toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('throws an actionable error when the validator reports failures', async () => {
    const {runHtmlValidate} = await import(scriptPath);
    const invoke = vi.fn().mockResolvedValue({
      code: 1,
      stdout: JSON.stringify([
        {
          filePath: join(repoRoot, 'tests/fixtures/html-validator/broken-form.html'),
          errorCount: 2,
          warningCount: 0,
          messages: [
            {
              ruleId: 'wcag/h37',
              message: '<img> is missing required "alt" attribute',
              line: 12,
              column: 9,
            },
            {
              ruleId: 'no-implicit-button-type',
              message: 'Button type attribute is mandatory',
              line: 10,
              column: 10,
            },
          ],
        },
      ]),
      stderr: '',
    });
    const logger = createLogger();

    await expect(
      runHtmlValidate({
        invoke,
        logger,
        targets: [
          {
            label: 'Fixture HTML',
            path: join(repoRoot, 'tests/fixtures/html-validator'),
          },
        ],
      }),
    ).rejects.toThrow(/wcag\/h37/);

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('❌ HTML validation reported structural issues'));
  });

  it('fails fast when dist artefacts are missing', async () => {
    const {runHtmlValidate} = await import(scriptPath);

    await expect(
      runHtmlValidate({
        targets: [
          {
            label: 'Missing directory',
            path: join(repoRoot, 'non-existent/path'),
          },
        ],
      }),
    ).rejects.toThrow(/Run `npm run build` and `npm run ladle:build`/);
  });
});
