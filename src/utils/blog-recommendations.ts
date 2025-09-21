import type { DomainClassification } from './domain-allowlist';

export type BlogAnalyticsEventType = 'article_view' | 'interaction' | 'conversion';

/**
 * Aggregated metrics exported by the analytics Worker. Each row represents a
 * single article, event type, and calendar day combo. We keep the classification
 * on the aggregate so segmentation experiments (ex: only show ABM-heavy content
 * to "allow" domains) can run without fetching raw events.
 */
export interface BlogAnalyticsAggregate {
  slug: string;
  eventType: BlogAnalyticsEventType;
  totalEvents: number;
  uniqueSessions: number;
  domainClassification: DomainClassification;
  eventDate: string;
}

export interface RecommendationScore {
  slug: string;
  score: number;
  breakdown: Record<BlogAnalyticsEventType, number>;
}

/**
 * Snapshot consumed by the personalization API + fallback JSON artifact. The
 * metadata block makes it trivial for reviewers to validate the weighting
 * scheme used to score trending posts.
 */
export interface RecommendationSnapshot {
  generatedAt: string;
  scores: RecommendationScore[];
  metadata: {
    decayHalfLifeDays: number;
    eventWeights: Record<BlogAnalyticsEventType, number>;
  };
}

/**
 * Knobs exposed so tests + downstream scripts can tweak scoring deterministically.
 */
export interface RecommendationOptions {
  now?: Date;
  decayHalfLifeDays?: number;
  eventWeights?: Partial<Record<BlogAnalyticsEventType, number>>;
}

/**
 * Event weighting intentionally leans toward deeper funnel interactions. Views
 * seed the queue but conversions get outsized influence.
 */
const DEFAULT_EVENT_WEIGHTS: Record<BlogAnalyticsEventType, number> = {
  article_view: 1,
  interaction: 3,
  conversion: 7,
};

/**
 * Two week half-life keeps the feed fresh while giving evergreen posts time to
 * accumulate signals.
 */
const DEFAULT_HALF_LIFE_DAYS = 14;

/**
 * Helper guards around invalid ISO strings so the scoring algorithm never
 * throws. Invalid dates degrade gracefully (no decay applied).
 */
function coerceDate(value: string): Date | null {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

/**
 * Applies exponential decay based on the provided half-life. We intentionally
 * use a continuous decay instead of step functions to avoid score oscillations
 * when cron jobs run slightly off schedule.
 */
function applyDecayMultiplier(eventDate: string, options: RecommendationOptions): number {
  const halfLife = options.decayHalfLifeDays ?? DEFAULT_HALF_LIFE_DAYS;
  if (halfLife <= 0) return 1;
  const now = options.now ?? new Date();
  const parsed = coerceDate(eventDate);
  if (!parsed) {
    return 1;
  }
  const elapsedMs = now.getTime() - parsed.getTime();
  const elapsedDays = Math.max(0, elapsedMs / (24 * 60 * 60 * 1000));
  const lambda = Math.log(2) / halfLife;
  return Math.exp(-lambda * elapsedDays);
}

/**
 * Score aggregated events into a single numeric rank per article. The score is
 * deterministic so the nightly script and API endpoint can produce identical
 * results.
 */
export function scoreAggregates(
  aggregates: BlogAnalyticsAggregate[],
  options: RecommendationOptions = {},
): RecommendationScore[] {
  const weights = { ...DEFAULT_EVENT_WEIGHTS, ...(options.eventWeights ?? {}) } as Record<
    BlogAnalyticsEventType,
    number
  >;

  const scores = new Map<string, RecommendationScore>();

  for (const aggregate of aggregates) {
    if (!weights[aggregate.eventType]) continue;
    const decay = applyDecayMultiplier(aggregate.eventDate, options);
    const weighted =
      (aggregate.totalEvents + aggregate.uniqueSessions * 0.5) *
      weights[aggregate.eventType] *
      decay;

    const existing = scores.get(aggregate.slug) ?? {
      slug: aggregate.slug,
      score: 0,
      breakdown: {
        article_view: 0,
        interaction: 0,
        conversion: 0,
      },
    };

    existing.score += weighted;
    existing.breakdown[aggregate.eventType] += weighted;
    scores.set(aggregate.slug, existing);
  }

  return Array.from(scores.values()).sort((a, b) => b.score - a.score);
}

/**
 * Compose a snapshot object that downstream clients can serialize verbatim. The
 * metadata object exists so auditors can inspect the scoring dial settings
 * without reverse engineering code.
 */
export function buildRecommendationSnapshot(
  aggregates: BlogAnalyticsAggregate[],
  options: RecommendationOptions = {},
): RecommendationSnapshot {
  const scores = scoreAggregates(aggregates, options);
  return {
    generatedAt: (options.now ?? new Date()).toISOString(),
    scores,
    metadata: {
      decayHalfLifeDays: options.decayHalfLifeDays ?? DEFAULT_HALF_LIFE_DAYS,
      eventWeights: { ...DEFAULT_EVENT_WEIGHTS, ...(options.eventWeights ?? {}) },
    },
  };
}

/**
 * Convenience helper for callers that only need the top N entries.
 */
export function selectTopRecommendations(
  snapshot: RecommendationSnapshot,
  limit = 5,
): RecommendationScore[] {
  return snapshot.scores.slice(0, limit);
}
