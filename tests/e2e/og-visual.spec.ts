import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

// Derive an absolute path to the directory containing this spec so we can load
// the deterministic base64 snapshot without depending on the current working
// directory. This keeps the test hermetic when executed from CI or developer
// machines.
const specDir = dirname(fileURLToPath(import.meta.url));

const PREVIEW_PATH =
  '/api/og-test/welcome.png?title=Visual%20Regression&subtitle=Playwright%20Snapshot';

// Centralize the fixture path so future contributors have a single source of
// truth for the stored baseline. The snapshot itself lives as UTF-8 text to keep
// the repository free of binary blobs while still enabling deterministic visual
// assertions.
const BASE64_FIXTURE_PATH = join(specDir, 'fixtures', 'og-preview.base64.txt');

// Playwright's "request" fixture gives us first-class access to HTTP semantics
// without needing to render the PNG into a DOM. We lean on it so the spec stays
// fast, deterministic, and avoids flake caused by graphics stacks in headless
// browsers.
test('renders OG preview card', async ({ page }) => {
  const response = await page.request.get(PREVIEW_PATH);
  expect(response.ok()).toBeTruthy();

  // Convert the rendered PNG into a base64-encoded string. We rely on base64 so
  // the artifact can live inside the repository as text, satisfying the "no
  // binary files" constraint while still capturing the exact byte-level output
  // of the Open Graph renderer.
  const actualBase64 = (await response.body()).toString('base64');

  // Load the curated baseline and strip whitespace that may exist from manual
  // formatting. Trimming ensures that line wrapping inside the fixture does not
  // impact the assertion, keeping diffs readable even if editors reflow text.
  const expectedBase64 = (await readFile(BASE64_FIXTURE_PATH, 'utf8')).replace(/\s/g, '');

  // A strict equality assertion fails fast whenever the OG renderer output
  // diverges, effectively giving us the same safety net as pixel snapshots
  // without shipping a binary artifact. When the diff fires, contributors can
  // regenerate the fixture via the documented workflow in docs/dev/ACCESSIBILITY.md.
  expect(actualBase64).toBe(expectedBase64);
});
