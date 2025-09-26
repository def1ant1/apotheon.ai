import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { TextEncoder } from 'node:util';
import { webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { Miniflare } from 'miniflare';

import { MemoryD1Database, runSyntheticHealth } from '../../workers/synthetic-health.ts';

const projectRoot = dirname(fileURLToPath(import.meta.url));

if (typeof globalThis.crypto === 'undefined') {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto });
}

Object.defineProperty(globalThis, 'TextEncoder', {
  configurable: true,
  writable: true,
  value: TextEncoder,
});

function bundleWorker(scriptPath) {
  const result = spawnSync('node', [scriptPath], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(result.stderr || `Failed to bundle worker via ${scriptPath}`);
  }
  return result.stdout;
}

async function applyMigrations(db, relativePath) {
  const migrationPath = join(process.cwd(), relativePath);
  const contents = await readFile(migrationPath, 'utf8');
  const sanitized = contents.replace(/^--.*$/gm, '');
  const statements = sanitized
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await db.prepare(statement).run();
  }
}

const contactScript = bundleWorker(join(projectRoot, 'bundle-contact-worker.mjs'));
const whitepaperScript = bundleWorker(join(projectRoot, 'bundle-whitepapers-worker.mjs'));

const secret = 'synthetic-test-secret-automation-signing-key-001';
const contactEndpoint = 'https://synthetic.test/api/contact';
const whitepaperEndpoint = 'https://synthetic.test/api/whitepapers';

const contactMf = new Miniflare({
  script: contactScript,
  modules: true,
  modulesRoot: process.cwd(),
  compatibilityDate: '2024-10-08',
  kvNamespaces: ['CONTACT_RATE_LIMIT'],
  d1Databases: { CONTACT_AUDIT_DB: ':memory:' },
  bindings: {
    TURNSTILE_SECRET: 'synthetic-turnstile-secret',
    CONTACT_BLOCKLIST: '',
    CONTACT_ALLOWLIST: '',
    CONTACT_SYNTHETIC_SIGNING_SECRET: secret,
  },
});

const whitepaperMf = new Miniflare({
  script: whitepaperScript,
  modules: true,
  modulesRoot: process.cwd(),
  compatibilityDate: '2024-10-08',
  kvNamespaces: ['WHITEPAPER_RATE_LIMIT'],
  d1Databases: { WHITEPAPER_AUDIT_DB: ':memory:' },
  r2Buckets: ['WHITEPAPER_ASSETS'],
  bindings: {
    TURNSTILE_SECRET: 'synthetic-turnstile-secret',
    WHITEPAPER_BLOCKLIST: '',
    WHITEPAPER_ALLOWLIST: '',
    WHITEPAPER_SIGNING_TTL_SECONDS: '900',
    WHITEPAPER_SYNTHETIC_SIGNING_SECRET: secret,
    WHITEPAPER_SIGNED_URL_BASE: 'https://cdn.synthetic.test/downloads',
  },
});

const contactDb = await contactMf.getD1Database('CONTACT_AUDIT_DB');
await applyMigrations(contactDb, 'workers/migrations/contact/0001_init.sql');

const whitepaperDb = await whitepaperMf.getD1Database('WHITEPAPER_AUDIT_DB');
await applyMigrations(whitepaperDb, 'workers/migrations/whitepapers/0001_init.sql');

const whitepaperBindings = await whitepaperMf.getBindings();
const whitepaperBucket = whitepaperBindings.WHITEPAPER_ASSETS;
await whitepaperBucket.put('whitepapers/apotheon-investor-brief.pdf', new ArrayBuffer(16));
const bucketPrototype = Object.getPrototypeOf(whitepaperBucket);
if (bucketPrototype && typeof bucketPrototype.createSignedUrl !== 'function') {
  bucketPrototype.createSignedUrl = async ({ key, expires }) => {
    const expiration = typeof expires === 'number' ? expires : Math.round(Date.now() / 1000) + 900;
    const url = new URL(`https://cdn.synthetic.test/${key}`);
    url.searchParams.set('token', 'synthetic-preview');
    url.searchParams.set('expires', expiration.toString());
    return { url: url.toString(), expiration };
  };
}

const syntheticEnv = {
  SYNTHETIC_HEALTH_DB: new MemoryD1Database(),
  SYNTHETIC_SIGNING_SECRET: secret,
  SYNTHETIC_CONTACT_ENDPOINT: contactEndpoint,
  SYNTHETIC_WHITEPAPER_ENDPOINT: whitepaperEndpoint,
  SYNTHETIC_WHITEPAPER_SLUG: 'apotheon-investor-brief',
};

const fetchImplementation = async (input, init) => {
  const url = typeof input === 'string' ? input : input.url;
  if (url.startsWith(contactEndpoint)) {
    return contactMf.dispatchFetch(url, init);
  }
  if (url.startsWith(whitepaperEndpoint)) {
    return whitepaperMf.dispatchFetch(url, init);
  }
  return fetch(input, init);
};

try {
  const summary = await runSyntheticHealth(syntheticEnv, {
    dryRun: true,
    fetchImplementation,
    logger: console,
  });

  if (summary.status !== 'healthy') {
    console.error('[synthetic-health] Dry-run detected regression:', summary);
    process.exitCode = 1;
  } else {
    console.info('[synthetic-health] Dry-run completed successfully.');
  }
} catch (error) {
  console.error('[synthetic-health] Dry-run execution failed:', error);
  process.exitCode = 1;
}

await contactMf.dispose();
await whitepaperMf.dispose();
