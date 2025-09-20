#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SEO_MANIFEST,
  SITEMAP_INDEX_BASENAME,
  createRouteExclusionPredicate,
  getSitemapIndexUrl,
  resolveDeploymentStage,
  resolveRobotsPolicies
} from '../../config/seo/manifest.mjs';

const modulePath = fileURLToPath(import.meta.url);
const projectRoot = fileURLToPath(new URL('../..', import.meta.url));
const distDir = join(projectRoot, 'dist');
const robotsPath = join(distDir, 'robots.txt');

const isRouteExcluded = createRouteExclusionPredicate();

function deriveRobotsPathFromPattern(pattern) {
  let candidate = pattern.source;
  candidate = candidate.replace(/^\^/, '').replace(/\$$/, '');
  candidate = candidate.replace(/\\\//g, '/');
  if (candidate.endsWith('/?')) {
    candidate = candidate.slice(0, -2);
  }
  candidate = candidate.replace(/\(\/\.\*\)\?/g, '/*');
  candidate = candidate.replace(/\\\?/g, '');
  if (!candidate.startsWith('/')) {
    candidate = `/${candidate}`;
  }

  return candidate;
}

function formatDirectiveLines(label, values = []) {
  if (!values || values.length === 0) {
    return [`${label}:`];
  }

  return Array.from(new Set(values)).map((value) => `${label}: ${value}`);
}

async function main() {
  const timestamp = new Date().toISOString();
  try {
    await fs.access(distDir);
  } catch (error) {
    throw new Error(
      `Cannot generate robots.txt because the dist directory is missing (${distDir}). Run \`astro build\` first.`,
      { cause: error }
    );
  }

  const stage = resolveDeploymentStage();
  const policies = resolveRobotsPolicies(stage);
  const sitemapUrl = getSitemapIndexUrl();
  const derivedDisallows = SEO_MANIFEST.routes.exclusionPatterns
    .map((pattern) => {
      const candidate = deriveRobotsPathFromPattern(pattern);
      if (candidate && !isRouteExcluded(candidate)) {
        console.warn(
          `[robots] derived disallow path "${candidate}" did not match exclusion predicate from manifest. Check pattern:`,
          pattern
        );
      }
      return candidate;
    })
    .filter(Boolean);

  const lines = [
    `# robots.txt generated ${timestamp}`,
    `# Environment stage: ${stage}`,
    `# Source sitemap: ${SITEMAP_INDEX_BASENAME}`
  ];

  for (const policy of policies) {
    lines.push(`User-agent: ${policy.userAgent}`);

    const allowLines = formatDirectiveLines('Allow', policy.allow);
    lines.push(...allowLines);

    const disallowValues = [...(policy.disallow ?? []), ...derivedDisallows];
    const disallowLines = formatDirectiveLines('Disallow', disallowValues);
    lines.push(...disallowLines);

    lines.push('');
  }

  lines.push(`Sitemap: ${sitemapUrl}`);
  lines.push('');

  await fs.mkdir(dirname(robotsPath), { recursive: true });
  await fs.writeFile(robotsPath, `${lines.join('\n')}`);

  console.info(
    `[robots] Wrote ${robotsPath} (${policies.length} policy set${policies.length === 1 ? '' : 's'}) targeting ${stage}.`
  );
}

const invokedDirectly = process.argv[1] ? resolve(process.argv[1]) === modulePath : false;

if (invokedDirectly) {
  main().catch((error) => {
    console.error('[robots] generation failed:', error);
    process.exitCode = 1;
  });
}
