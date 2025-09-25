const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const distDir = path.join(root, 'dist');
const ladleDistDir = path.join(distDir, 'ladle');

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

const pageFiles = collectHtmlFiles(distDir);
const islandFiles = collectHtmlFiles(ladleDistDir);
const htmlFiles = [
  ...pageFiles.map((filePath) => ({ filePath, label: 'pages' })),
  ...islandFiles.map((filePath) => ({ filePath, label: 'islands' })),
];

if (htmlFiles.length === 0) {
  console.warn('[pa11y-ci] No HTML files discovered in dist/ or dist/ladle. Did you run `npm run build:static` and `npm run ladle:build`?');
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
  urls: htmlFiles.map(({ filePath, label }) => ({
    url: `file://${filePath}`,
    label: path.join(label, path.relative(label === 'islands' ? ladleDistDir : distDir, filePath)),
  })),
};
