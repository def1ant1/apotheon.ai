import { describe, expect, it } from 'vitest';

import {
  buildRecommendationSnapshot,
  scoreAggregates,
  selectTopRecommendations,
  type BlogAnalyticsAggregate,
} from '../blog-recommendations';

describe('blog recommendation scoring', () => {
  const baseAggregates: BlogAnalyticsAggregate[] = [
    {
      slug: 'welcome',
      eventType: 'article_view',
      totalEvents: 120,
      uniqueSessions: 90,
      domainClassification: 'allow',
      eventDate: '2024-10-01',
    },
    {
      slug: 'welcome',
      eventType: 'interaction',
      totalEvents: 30,
      uniqueSessions: 22,
      domainClassification: 'allow',
      eventDate: '2024-10-01',
    },
    {
      slug: 'integration-governance',
      eventType: 'conversion',
      totalEvents: 6,
      uniqueSessions: 5,
      domainClassification: 'review',
      eventDate: '2024-09-25',
    },
  ];

  it('applies event weights and recency decay', () => {
    const scores = scoreAggregates(baseAggregates, {
      now: new Date('2024-10-02T00:00:00.000Z'),
      decayHalfLifeDays: 7,
    });

    expect(scores[0].slug).toBe('welcome');
    expect(scores[0].score).toBeGreaterThan(scores[1].score);
    expect(scores[0].breakdown.interaction).toBeGreaterThan(0);
  });

  it('builds snapshots that downstream APIs can slice', () => {
    const snapshot = buildRecommendationSnapshot(baseAggregates, {
      now: new Date('2024-10-02T00:00:00.000Z'),
    });
    expect(snapshot.scores).toHaveLength(2);
    expect(snapshot.metadata.decayHalfLifeDays).toBeGreaterThan(0);

    const topOne = selectTopRecommendations(snapshot, 1);
    expect(topOne).toHaveLength(1);
    expect(topOne[0].slug).toBe('welcome');
  });
});
