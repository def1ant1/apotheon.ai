import { readFile } from 'node:fs/promises';

import {
  buildRecommendationSnapshot,
  selectTopRecommendations,
  type BlogAnalyticsAggregate,
} from '../../../utils/blog-recommendations';

import type { APIRoute } from 'astro';

export const prerender = false;

const fallbackUrl = new URL('../../../../public/data/blog/recommendations.json', import.meta.url);

interface RecommendationArtifact {
  aggregates?: BlogAnalyticsAggregate[];
  metadata?: unknown;
  generatedAt?: string;
}

async function loadAggregates(): Promise<{
  aggregates: BlogAnalyticsAggregate[];
  metadata?: unknown;
  generatedAt?: string;
}> {
  try {
    const raw = await readFile(fallbackUrl, 'utf8'); // eslint-disable-line security/detect-non-literal-fs-filename
    const parsed = JSON.parse(raw) as RecommendationArtifact | null;
    return {
      aggregates: Array.isArray(parsed?.aggregates) ? parsed.aggregates : [],
      metadata: parsed?.metadata,
      generatedAt: typeof parsed?.generatedAt === 'string' ? parsed.generatedAt : undefined,
    };
  } catch (error) {
    console.warn('[api/blog/recommendations] fallback read failed:', error);
    return { aggregates: [] };
  }
}

export const GET: APIRoute = async ({ url }) => {
  const limit = Math.max(
    1,
    Math.min(20, Number.parseInt(url.searchParams.get('limit') ?? '5', 10)),
  );
  const classificationFilter = url.searchParams.get('classification');

  const { aggregates, metadata, generatedAt } = await loadAggregates();

  const filtered = classificationFilter
    ? aggregates.filter((entry) => entry.domainClassification === classificationFilter)
    : aggregates;

  const snapshot = buildRecommendationSnapshot(filtered);
  const recommendations = selectTopRecommendations(snapshot, limit);

  const body = {
    generatedAt: generatedAt ?? snapshot.generatedAt,
    metadata: {
      ...(metadata ?? {}),
      requestedLimit: limit,
      classificationFilter: classificationFilter ?? null,
    },
    recommendations,
  };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=3600',
    },
  });
};
