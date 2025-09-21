import { describe, expect, it } from 'vitest';

import { __internal } from '../blog-analytics';

describe('blog analytics helpers', () => {
  it('normalizes domains from identity payloads', () => {
    const baseEvent = __internal.blogEventSchema.parse({
      type: 'interaction',
      slug: 'welcome',
      sessionId: 'session-1234',
      occurredAt: new Date('2024-10-01T12:00:00Z'),
      identity: { email: 'user@example.com' },
    });

    expect(__internal.deriveDomain(baseEvent)).toBe('example.com');
  });

  it('aggregates events into rollups with unique session counts', () => {
    const first = __internal.blogEventSchema.parse({
      type: 'article_view',
      slug: 'welcome',
      sessionId: 'session-1',
      occurredAt: new Date('2024-10-01T12:00:00Z'),
    });
    const second = __internal.blogEventSchema.parse({
      type: 'article_view',
      slug: 'welcome',
      sessionId: 'session-1',
      occurredAt: new Date('2024-10-01T13:00:00Z'),
    });
    const third = __internal.blogEventSchema.parse({
      type: 'article_view',
      slug: 'welcome',
      sessionId: 'session-2',
      occurredAt: new Date('2024-10-01T14:00:00Z'),
    });

    const { rollups } = __internal.createRollups([first, second, third]);
    expect(rollups).toHaveLength(1);
    expect(rollups[0].totalEvents).toBe(3);
    expect(rollups[0].uniqueSessions).toBe(2);
    expect(rollups[0].domainAnalysis.domain).toBe('unknown');
  });
});
