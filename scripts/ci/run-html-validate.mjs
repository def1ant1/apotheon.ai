#!/usr/bin/env node
/**
 * Enterprise HTML surface validator.
 *
 * Runs html-validate against the production-ready Astro artefacts under
 * `dist/` together with the Ladle storybook mirror in `dist/ladle/`. The
 * workflow intentionally assumes a sandboxed CI runner: network access is not
 * required because the validator only reads previously generated static files.
 * Local developers should mimic CI by regenerating `dist/` before invoking the
 * script so the same HTML contract is analysed everywhere.
 */
import {spawn} from 'node:child_process';
import {existsSync, readdirSync, statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join, relative, resolve} from 'node:path';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..', '..');
const htmlValidateBin = join(
  repoRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'html-validate.cmd' : 'html-validate',
);
const configPath = join(repoRoot, 'config', 'htmlvalidate.json');

const defaultTargets = [
  {
    label: 'Astro production build',
    path: join(repoRoot, 'dist'),
  },
  {
    label: 'Ladle component workbook',
    path: join(repoRoot, 'dist', 'ladle'),
  },
];

function toPosixPath(pathname) {
  return pathname.split('\\').join('/');
}

function collectHtmlFiles(targets) {
  const matches = new Set();
  const queue = targets
    .map(target => target.path)
    .filter(pathname => existsSync(pathname));

  while (queue.length > 0) {
    const current = queue.pop();
    if (!current) continue;
    const stats = statSync(current);
    if (stats.isDirectory()) {
      const entries = readdirSync(current);
      entries.forEach(entry => queue.push(join(current, entry)));
      continue;
    }
    if (stats.isFile()) {
      const normalised = toPosixPath(relative(repoRoot, current));
      if (normalised.endsWith('.html') || normalised.endsWith('.htm')) {
        matches.add(current);
      }
    }
  }

  return Array.from(matches).sort();
}

function createDefaultInvoker() {
  return (command, args) =>
    new Promise((resolvePromise, rejectPromise) => {
      const child = spawn(command, args, {
        cwd: repoRoot,
        env: {
          ...process.env,
          NODE_ENV: process.env.NODE_ENV ?? 'test',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', chunk => {
        stdout += chunk.toString();
      });

      child.stderr?.on('data', chunk => {
        stderr += chunk.toString();
      });

      child.on('error', rejectPromise);
      child.on('close', code => {
        resolvePromise({code, stdout, stderr});
      });
    });
}

function summariseReport(report) {
  const files = Array.isArray(report) ? report : [];
  return files.reduce(
    (accumulator, file) => {
      const {errorCount = 0, warningCount = 0, filePath, messages = []} = file;
      const normalisedPath = filePath ? toPosixPath(relative(repoRoot, filePath)) : '(stdin)';
      accumulator.errorCount += errorCount;
      accumulator.warningCount += warningCount;
      accumulator.files.push({filePath: normalisedPath, messages});
      return accumulator;
    },
    {errorCount: 0, warningCount: 0, files: []},
  );
}

function ensureTargetsExist(targets) {
  const missing = targets.filter(target => !existsSync(target.path));
  if (missing.length > 0) {
    const formatted = missing
      .map(target => `- ${target.label} (${relative(repoRoot, target.path)})`)
      .join('\n');
    throw new Error(
      `HTML validation requires prebuilt artefacts. Run \`npm run build\` and \`npm run ladle:build\` before invoking the validator.\nMissing targets:\n${formatted}`,
    );
  }
}

export async function runHtmlValidate({
  invoke = createDefaultInvoker(),
  logger = console,
  targets = defaultTargets,
} = {}) {
  logger.info(
    [
      '⚙️  Running html-validate inside the sandboxed CI harness.',
      '    • The validator only inspects files we already generated under dist/.',
      '    • No network access is required; everything runs from the local artefact cache.',
      '    • Regenerate dist/ locally via `npm run build && npm run ladle:build` for parity.',
    ].join('\n'),
  );

  ensureTargetsExist(targets);

  const filesToScan = collectHtmlFiles(targets);
  if (filesToScan.length === 0) {
    logger.warn('No HTML files detected under the provided targets; skipping validation.');
    return {errorCount: 0, warningCount: 0, files: [], scanned: 0};
  }

  const args = ['--config', configPath, '--formatter', 'json', ...filesToScan];

  const {code, stdout, stderr} = await invoke(htmlValidateBin, args);

  if (stderr.trim().length > 0) {
    logger.warn(stderr.trim());
  }

  let parsed;
  try {
    parsed = stdout.trim().length > 0 ? JSON.parse(stdout) : [];
  } catch (error) {
    throw new Error(`Failed to parse html-validate output: ${(error instanceof Error ? error.message : error)}. Raw output: ${stdout}`);
  }

  const summary = summariseReport(parsed);

  if (summary.errorCount === 0 && summary.warningCount === 0 && code === 0) {
    if (summary.files.length === 0) {
      summary.files = filesToScan.map(file => ({
        filePath: toPosixPath(relative(repoRoot, file)),
        messages: [],
      }));
    }
    summary.scanned = filesToScan.length;
    logger.info(
      `✅ HTML validation passed with ${filesToScan.length} files scanned. Sandboxed parity maintained.`,
    );
    return summary;
  }

  summary.scanned = filesToScan.length;

  const messageLines = [
    '❌ HTML validation reported structural issues:',
    `  • Errors: ${summary.errorCount}`,
    `  • Warnings: ${summary.warningCount}`,
  ];

  summary.files.forEach(file => {
    if (!file.messages || file.messages.length === 0) {
      return;
    }
    messageLines.push(`  ↳ ${file.filePath}`);
    file.messages.forEach(entry => {
      messageLines.push(
        `     - [${entry.ruleId}] (${entry.line}:${entry.column}) ${entry.message}`,
      );
    });
  });

  const errorMessage = messageLines.join('\n');
  logger.error(errorMessage);
  const exitCode = code === 0 ? 1 : code;
  const error = new Error(errorMessage);
  error.exitCode = exitCode;
  throw error;
}

const executedDirectly = (() => {
  if (!process.argv[1]) {
    return false;
  }
  try {
    return fileURLToPath(import.meta.url) === resolve(process.argv[1]);
  } catch {
    return false;
  }
})();

if (executedDirectly) {
  runHtmlValidate().catch(error => {
    console.error(error.message);
    process.exit(typeof error.exitCode === 'number' ? error.exitCode : 1);
  });
}
