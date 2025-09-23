#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import axe from 'axe-core';
import { JSDOM, ResourceLoader, VirtualConsole } from 'jsdom';

import { collectHtmlFiles } from './shared.js';

const root = fileURLToPath(new URL('../..', import.meta.url));
const distDir = path.join(root, 'dist');
const reportDir = path.join(root, 'reports', 'accessibility', 'axe');

class DistResourceLoader extends ResourceLoader {
  constructor(rootDirectory) {
    super();
    this.rootDirectory = rootDirectory;
  }

  fetch(url) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'https:' && parsed.hostname === 'apotheon.local') {
        const normalizedPath = parsed.pathname.replace(/^\/+/, '');
        const localPath = path.join(this.rootDirectory, normalizedPath);
        return readFile(localPath).catch(() => Buffer.from(''));
      }

      if (parsed.protocol === 'file:') {
        const sanitized = decodeURIComponent(parsed.pathname).replace(/^\/+/, '');
        const candidate = path.join(this.rootDirectory, sanitized);
        return readFile(candidate).catch(() => Buffer.from(''));
      }
    } catch (error) {
      console.warn('[accessibility][axe] Failed to map resource', url, error);
    }

    return Promise.resolve(Buffer.from(''));
  }
}

async function runAxeAgainstFile(filePath, relativePath) {
  const html = await readFile(filePath, 'utf-8');
  const origin = new URL('https://apotheon.local/');
  const resourceLoader = new DistResourceLoader(distDir);
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('error', () => undefined);

  const dom = new JSDOM(html, {
    url: new URL(relativePath, origin).href,
    pretendToBeVisual: true,
    resources: resourceLoader,
    runScripts: 'outside-only',
    beforeParse(window) {
      if (typeof window.HTMLCanvasElement !== 'undefined') {
        Object.defineProperty(window.HTMLCanvasElement.prototype, 'getContext', {
          value: () => null,
          configurable: true,
        });
      }
    },
    virtualConsole,
  });

  const { window } = dom;
  const { document } = window;

  // Inject axe-core into the virtual window. Using eval keeps us aligned with the way axe expects
  // to boot inside a browser environment without introducing additional bundling steps.
  window.eval(axe.source);

  const axeRuntime = window.axe;
  axeRuntime.configure({ reporter: 'v2' });

  const results = await axeRuntime.run(document, {
    resultTypes: ['violations', 'incomplete'],
  });

  return results;
}

async function main() {
  const htmlFiles = await collectHtmlFiles(distDir);
  if (htmlFiles.length === 0) {
    console.warn('[accessibility][axe] No HTML files discovered in dist/. Ensure build:static has executed.');
    return;
  }

  const summary = {
    scanned: htmlFiles.length,
    generatedAt: new Date().toISOString(),
    documents: [],
    violations: [],
  };

  for (const filePath of htmlFiles) {
    const relativePath = path.relative(distDir, filePath);
    const reportPath = path.join(reportDir, `${relativePath}.json`);
    await mkdir(path.dirname(reportPath), { recursive: true });

    try {
      const results = await runAxeAgainstFile(filePath, relativePath);
      await writeFile(reportPath, JSON.stringify(results, null, 2), 'utf-8');

      summary.documents.push({
        path: relativePath,
        violations: results.violations.length,
        incomplete: results.incomplete.length,
      });

      for (const violation of results.violations) {
        summary.violations.push({
          page: relativePath,
          id: violation.id,
          impact: violation.impact,
          description: violation.description,
          helpUrl: violation.helpUrl,
          nodes: violation.nodes.map((node) => node.target),
        });
      }
    } catch (error) {
      console.error(`[accessibility][axe] Failed to scan ${relativePath}`, error);
      summary.documents.push({ path: relativePath, error: String(error) });
      process.exitCode = 1;
    }
  }

  await writeFile(path.join(reportDir, 'summary.json'), JSON.stringify(summary, null, 2), 'utf-8');

  const blockingViolations = summary.violations.filter((violation) =>
    violation.impact === 'critical' || violation.impact === 'serious',
  );

  if (blockingViolations.length > 0) {
    console.error(
      `[accessibility][axe] ${blockingViolations.length} critical/serious issues detected. See reports/accessibility/axe/summary.json`,
    );
    process.exitCode = 1;
  } else {
    console.info(
      `[accessibility][axe] Scan complete for ${summary.scanned} documents with no critical issues detected. Reports saved to reports/accessibility/axe/.`,
    );
  }
}

await main().catch((error) => {
  console.error('[accessibility][axe] Unexpected failure', error);
  process.exitCode = 1;
});
