#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// The dev server must be running locally so we can pull a fully rendered Open Graph image. We use
// the same slug and query params that the E2E suite validates to keep automation and manual refreshes
// aligned.
const PREVIEW_ROUTE =
  '/api/og-test/welcome.png?title=Visual%20Regression&subtitle=Playwright%20Snapshot';

// Resolve the fixture location relative to the repository root instead of the CWD so the script can
// execute from any directory (CI hooks, npm scripts, or IDE task runners).
const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const fixturePath = join(repoRoot, 'tests/e2e/fixtures/og-preview.base64.txt');

// We intentionally avoid bundling extra dependencies; Node 18+ ships with a native fetch
// implementation that supports ArrayBuffer responses, which we can coerce into a Buffer for
// base64 manipulation.
const response = await fetch(`http://localhost:4321${PREVIEW_ROUTE}`);

if (!response.ok) {
  const body = await response.text().catch(() => '<unable to read body>');
  throw new Error(
    `Failed to fetch OG preview (status ${response.status}): ${body.slice(0, 200)}...`,
  );
}

// Convert the streamed PNG bytes into base64 so the snapshot can live as UTF-8 text. We then wrap the
// output at 76 characters to mirror the POSIX `base64` CLI, keeping diffs approachable during code
// review.
const buffer = Buffer.from(await response.arrayBuffer());
const base64 = buffer.toString('base64');
const formatted = base64.match(/.{1,76}/g)?.join('\n') ?? base64;

await writeFile(fixturePath, `${formatted}\n`, 'utf8');

console.info(`OG preview fixture refreshed at ${fixturePath}`);
