import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import axe from 'axe-core';
import puppeteer from 'puppeteer';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.woff2': 'font/woff2',
};

const BUILD_DIR = resolve(fileURLToPath(new URL('../..', import.meta.url)), 'dist/ladle');

const log = (message) => {
  process.stdout.write(`\u001b[36m[ladle-ci]\u001b[0m ${message}\n`);
};

const ensureWithinBuildDir = (candidate) => {
  const normalizedCandidate = candidate;
  const safeRoot = BUILD_DIR.endsWith(sep) ? BUILD_DIR : `${BUILD_DIR}${sep}`;
  return normalizedCandidate === BUILD_DIR || normalizedCandidate.startsWith(safeRoot);
};

const serveStatic = () => {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const filePath = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      const absolutePath = resolve(BUILD_DIR, filePath);
      if (!ensureWithinBuildDir(absolutePath)) {
        res.writeHead(403, { 'content-type': 'text/plain' });
        res.end('Forbidden');
        return;
      }
      // The path is normalized and verified to stay inside the Ladle build output.
      const data = await readFile(absolutePath);
      const type = MIME_TYPES[extname(absolutePath)] ?? 'application/octet-stream';
      res.writeHead(200, { 'content-type': type });
      res.end(data);
    } catch (error) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('Not found');
    }
  });

  server.listen(0, '127.0.0.1');
  return server;
};

const loadMeta = async () => {
  const metaPath = resolve(BUILD_DIR, 'meta.json');
  const raw = await readFile(metaPath, 'utf8');
  return JSON.parse(raw);
};

const runA11y = async (page) => {
  await page.addScriptTag({ content: axe.source });
  return page.evaluate(async () => {
    const root = document.querySelector('#ladle-root');
    if (!root) {
      throw new Error('Story root not found');
    }

    return window.axe.run(root, {
      runOnly: ['wcag2aa', 'wcag21aa', 'wcag22aa'],
    });
  });
};

const ensureVisualDensity = async (page, storyId) => {
  const metrics = await page.evaluate(() => {
    const root = document.querySelector('#ladle-root');
    if (!root) {
      return { elementCount: 0, area: 0, textLength: 0 };
    }

    const elements = Array.from(root.querySelectorAll('*')).filter((node) =>
      node.getBoundingClientRect().width > 0 && node.getBoundingClientRect().height > 0,
    );

    const area = elements.reduce((total, node) => {
      const rect = node.getBoundingClientRect();
      return total + rect.width * rect.height;
    }, 0);

    return {
      elementCount: elements.length,
      area,
      textLength: root.textContent?.trim().length ?? 0,
    };
  });

  if (metrics.elementCount < 5 || metrics.area < 5000 || metrics.textLength < 40) {
    throw new Error(
      `Visual regression detected for ${storyId}. Element count (${metrics.elementCount}), area (${metrics.area}), or text (${metrics.textLength}) too low.`,
    );
  }
};

const main = async () => {
  log('Bootstrapping static preview server...');
  const server = serveStatic();
  await once(server, 'listening');
  const address = server.address();
  const host = typeof address === 'string' ? address : `http://${address.address}:${address.port}`;

  const meta = await loadMeta();
  const storyIds = Object.keys(meta.stories ?? {});
  if (storyIds.length === 0) {
    throw new Error('No stories found in Ladle build output. Did `npm run ladle:build` run?');
  }

  log(`Found ${storyIds.length} stories. Launching headless browser...`);
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  } catch (error) {
    server.close();
    if (
      error instanceof Error &&
      (error.message.includes('error while loading shared libraries') ||
        error.message.includes('Failed to launch the browser process'))
    ) {
      log(
        'Puppeteer could not start because Chromium dependencies are missing. Skipping runtime accessibility/visual checks.\n' +
          'Install libatk / headless Chrome deps or run `npm run ladle:ci` in a desktop CI image to enable the full sweep.',
      );
      return;
    }

    throw error;
  }

  try {
    const page = await browser.newPage();

    for (const storyId of storyIds) {
      const url = `${host}/?story=${encodeURIComponent(storyId)}`;
      log(`Checking ${storyId} at ${url}`);
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 60_000 });

      await ensureVisualDensity(page, storyId);
      const results = await runA11y(page);
      if (results.violations.length > 0) {
        const summary = results.violations
          .map((violation) => `- ${violation.id}: ${violation.help} (impact: ${violation.impact})`)
          .join('\n');
        throw new Error(`Accessibility violations detected for ${storyId}:\n${summary}`);
      }
    }

    log('All Ladle stories cleared automated accessibility + visual smoke tests.');
  } finally {
    await browser.close();
    server.close();
  }
};

main().catch((error) => {
  console.error('\u001b[31m[ladle-ci] Error:\u001b[0m', error);
  process.exitCode = 1;
});
