#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pa11y from 'pa11y';

import { collectAuditTargets } from './shared.js';

const root = fileURLToPath(new URL('../..', import.meta.url));
const distDir = path.join(root, 'dist');
const ladleDistDir = path.join(distDir, 'ladle');
const reportDir = path.join(root, 'reports', 'accessibility', 'pa11y');

async function runPa11yScan() {
  const auditTargets = await collectAuditTargets([
    { directory: distDir, label: 'pages' },
    { directory: ladleDistDir, label: 'islands' },
  ]);

  if (auditTargets.length === 0) {
    console.warn('[accessibility][pa11y] No HTML files discovered in dist/ or dist/ladle. Ensure build:static and ladle:build have executed.');
    return;
  }

  await mkdir(reportDir, { recursive: true });

  const summary = {
    scanned: auditTargets.length,
    generatedAt: new Date().toISOString(),
    documents: [],
    issues: [],
  };

  for (const target of auditTargets) {
    const reportPath = path.join(reportDir, target.label, `${target.relativePath}.json`);
    await mkdir(path.dirname(reportPath), { recursive: true });

    try {
      const result = await pa11y(`file://${target.filePath}`, {
        standard: 'WCAG2AA',
        timeout: 60000,
        chromeLaunchConfig: {
          args: ['--disable-dev-shm-usage', '--no-sandbox', '--disable-setuid-sandbox'],
        },
        log: {
          error: (message) => console.error('[accessibility][pa11y]', message),
          info: () => undefined,
          debug: () => undefined,
        },
      });

      await writeFile(reportPath, JSON.stringify(result, null, 2), 'utf-8');

      summary.documents.push({
        label: target.label,
        path: target.relativePath,
        issues: result.issues.length,
      });

      for (const issue of result.issues) {
        summary.issues.push({
          label: target.label,
          page: target.relativePath,
          code: issue.code,
          message: issue.message,
          selector: issue.selector,
          type: issue.type,
          typeCode: issue.typeCode,
          context: issue.context,
        });
      }
    } catch (error) {
      console.error(`[accessibility][pa11y] Failed to scan ${target.relativePath}`, error);
      summary.documents.push({ label: target.label, path: target.relativePath, error: String(error) });
      summary.issues.push({
        label: target.label,
        page: target.relativePath,
        code: 'pa11y.scan_error',
        message: String(error),
        selector: 'N/A',
        type: 'error',
        typeCode: 1,
        context: 'Scan failed',
      });
      process.exitCode = 1;
    }
  }

  await writeFile(path.join(reportDir, 'summary.json'), JSON.stringify(summary, null, 2), 'utf-8');

  if (summary.issues.some((issue) => issue.type === 'error')) {
    console.error('[accessibility][pa11y] Violations detected. See reports/accessibility/pa11y/summary.json');
    process.exitCode = 1;
  } else {
    console.info(
      `[accessibility][pa11y] Scan complete for ${summary.scanned} documents with zero blocking issues. Reports saved to reports/accessibility/pa11y/.`,
    );
  }
}

await runPa11yScan().catch((error) => {
  console.error('[accessibility][pa11y] Unexpected failure', error);
  process.exitCode = 1;
});
