/**
 * Executes a repository wide secret scan using the official Gitleaks Docker
 * image.  The script ensures that reports are written into the `artifacts/`
 * folder so GitHub Actions can always upload the findings for later review.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

import { runDockerCommand, toDockerPath } from './docker.mjs';

async function main() {
  const workspaceDir = process.cwd();
  const reportDir = path.resolve(workspaceDir, 'artifacts/security/gitleaks');
  const reportPath = path.join(reportDir, 'report.json');

  await fs.mkdir(reportDir, { recursive: true });

  const dockerArgs = [
    'run',
    '--rm',
    '-v', `${toDockerPath(workspaceDir)}:/repo`,
    '-w', '/repo',
    'zricethezav/gitleaks:latest',
    'detect',
    '--no-banner',
    '--redact',
    '--report-format', 'json',
    '--report-path', reportPath,
    '--config', '.gitleaks.toml',
  ];

  try {
    await runDockerCommand(dockerArgs);
  } catch (error) {
    console.error('\nGitleaks failed. The JSON report contains full details at:', reportPath);
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exitCode = 1;
  }
}

main();
