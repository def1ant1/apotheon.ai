#!/usr/bin/env node
/**
 * Nightly personalization builder. Pulls aggregated metrics from D1 (or a local
 * fixture during CI) and serializes trending post recommendations under
 * `public/data/blog/`. Astro copies the directory into `dist`, giving visitors a
 * hydration-free fallback when the API endpoint is unavailable.
 */
import 'tsx/esm';

import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

/**
 * The `tsx` loader allows us to consume the TypeScript scoring helper directly.
 * Using a dynamic import defers module resolution until the loader is active.
 */
const {
  buildRecommendationSnapshot,
  selectTopRecommendations,
} = await import('../../src/utils/blog-recommendations.ts');

/** @typedef {import('../../src/utils/blog-recommendations.ts').BlogAnalyticsAggregate} BlogAnalyticsAggregate */

const execFileAsync = promisify(execFile);

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..', '..');
const outputDir = join(projectRoot, 'public', 'data', 'blog');
const outputPath = join(outputDir, 'recommendations.json');
const fixturePath = join(projectRoot, 'config', 'blog-analytics.fixtures.json');

const WRANGLER_BIN = process.env.WRANGLER ?? 'wrangler';
const D1_DATABASE = process.env.BLOG_ANALYTICS_D1_NAME;
const RESULT_LIMIT = Number.parseInt(process.env.BLOG_ANALYTICS_MAX_ROWS ?? '1000', 10);

/**
 * @returns {Promise<BlogAnalyticsAggregate[] | null>}
 */
async function fetchAggregatesFromD1() {
  if (!D1_DATABASE) {
    return null;
  }

  try {
    const command = [
      'd1',
      'execute',
      D1_DATABASE,
      '--command',
      `SELECT event_date AS eventDate, article_slug AS slug, event_type AS eventType, total_events AS totalEvents, unique_sessions AS uniqueSessions, domain_classification AS domainClassification FROM blog_event_rollups ORDER BY event_date DESC LIMIT ${RESULT_LIMIT};`,
      '--json',
    ];

    const { stdout } = await execFileAsync(WRANGLER_BIN, command, {
      cwd: projectRoot,
      env: process.env,
    });

    const parsed = JSON.parse(stdout);
    const rows = parsed?.result ?? parsed?.results ?? [];
    return /** @type {BlogAnalyticsAggregate[]} */ (rows);
  } catch (error) {
    console.warn('[blog-recommendations] failed to query D1, falling back to fixture:', error);
    return null;
  }
}

/**
 * @returns {Promise<BlogAnalyticsAggregate[]>}
 */
async function readFixture() {
  try {
    const raw = await readFile(fixturePath, 'utf8');
    return /** @type {BlogAnalyticsAggregate[]} */ (JSON.parse(raw));
  } catch (error) {
    console.warn('[blog-recommendations] fixture missing, generating empty snapshot:', error);
    return [];
  }
}

async function buildRecommendations() {
  await mkdir(outputDir, { recursive: true });

  const aggregates = (await fetchAggregatesFromD1()) ?? (await readFixture());
  const snapshot = buildRecommendationSnapshot(aggregates);
  const topArticles = selectTopRecommendations(snapshot, 10);

  const payload = {
    generatedAt: snapshot.generatedAt,
    metadata: snapshot.metadata,
    aggregates,
    topArticles,
  };

  await writeFile(outputPath, JSON.stringify(payload, null, 2));
  console.info('[blog-recommendations] wrote %d entries to %s', topArticles.length, outputPath);
}

try {
  await buildRecommendations();
} catch (error) {
  console.error('[blog-recommendations] build failed:', error);
  process.exitCode = 1;
}
