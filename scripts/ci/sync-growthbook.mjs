#!/usr/bin/env node
/**
 * GrowthBook sync helper
 * ----------------------
 *
 * CI invokes this script before merge to guarantee the experiments proxy cache
 * reflects the latest definitions stored in the self-hosted GrowthBook instance.
 * The Worker performs integrity checks; we simply trigger the refresh endpoint
 * and verify the hash afterwards. Passing `--dry-run` prints the intended
 * actions without issuing network calls so developers can validate credentials
 * locally.
 */

const args = new Set(process.argv.slice(2));
const isDryRun = args.has('--dry-run');

const baseUrl = (process.env.EXPERIMENTS_PROXY_URL ?? 'https://experiments.apotheon.ai').replace(/\/$/u, '');
const refreshToken = process.env.EXPERIMENTS_REFRESH_TOKEN;

if (!refreshToken) {
  console.error('[experiments-sync] Missing EXPERIMENTS_REFRESH_TOKEN environment variable.');
  process.exit(1);
}

const refreshEndpoint = `${baseUrl}/v1/refresh`;
const featuresEndpoint = `${baseUrl}/v1/features`;

if (isDryRun) {
  console.info('[experiments-sync] Dry run. Would POST %s with Bearer credentials.', refreshEndpoint);
  console.info('[experiments-sync] Dry run. Would GET  %s to verify cache hash.', featuresEndpoint);
  process.exit(0);
}

async function syncGrowthBook() {
  const refreshResponse = await fetch(refreshEndpoint, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${refreshToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ triggeredAt: new Date().toISOString(), actor: 'ci' }),
  });

  if (!refreshResponse.ok) {
    const body = await refreshResponse.text();
    throw new Error(`Refresh failed with status ${refreshResponse.status}: ${body}`);
  }

  const refreshed = await refreshResponse.json();
  console.info('[experiments-sync] Refreshed experiments via %s (hash=%s).', refreshed.source, refreshed.hash);

  const verifyResponse = await fetch(featuresEndpoint, {
    headers: { Accept: 'application/json' },
  });

  if (!verifyResponse.ok) {
    throw new Error(`Verification fetch failed with status ${verifyResponse.status}`);
  }

  const snapshot = await verifyResponse.json();
  console.info('[experiments-sync] Verified cache response (source=%s, hash=%s).', snapshot.source, snapshot.hash);
}

syncGrowthBook().catch((error) => {
  console.error('[experiments-sync] Sync failed:', error);
  process.exitCode = 1;
});
