const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const distDir = path.join(root, 'dist');

function collectHtmlFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectHtmlFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      files.push(fullPath);
    }
  }

  return files;
}

const htmlFiles = collectHtmlFiles(distDir);

if (htmlFiles.length === 0) {
  console.warn('[pa11y-ci] No HTML files discovered in dist/. Did you run `npm run build:static`?');
}

module.exports = {
  concurrency: 4,
  defaults: {
    standard: 'WCAG2AA',
    timeout: 60000,
    wait: 500,
    log: {
      debug: (...messages) => console.debug('[pa11y-ci]', ...messages),
      error: (...messages) => console.error('[pa11y-ci]', ...messages),
    },
    chromeLaunchConfig: {
      args: ['--disable-dev-shm-usage'],
    },
  },
  thresholds: {
    global: 0,
  },
  urls: htmlFiles.map((filePath) => ({
    url: `file://${filePath}`,
    label: path.relative(distDir, filePath),
  })),
};
