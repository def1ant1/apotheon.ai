import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildTimelineSchema, getTimelineMilestones, HISTORY_ROUTE } from '../history';

import type { HistoryEntry } from '@content/history';

interface HistoryEntryStub {
  id: string;
  slug: string;
  data: HistoryEntry;
  render: () => Promise<{ Content: () => null }>;
}

const { getCollection } = vi.hoisted(() => {
  const dataset: HistoryEntryStub[] = [
    {
      id: 'history/governance-lab',
      slug: 'governance-lab',
      data: {
        year: 2022,
        headline: 'Governance automation lab operationalized with regulator access',
        narrative: 'Codified audit interactions into orchestrations.',
        programArea: 'Governance',
        media: {
          src: 'governance.svg',
          alt: 'Governance lab',
          caption: 'Oversight walkthrough',
          credit: 'Compliance Team',
        },
        draft: false,
      },
      render: async () => ({ Content: () => null }),
    },
    {
      id: 'history/research-foundation',
      slug: 'research-foundation',
      data: {
        year: 2018,
        headline: 'Foundational research lab formalized',
        narrative: 'Mission charter anchored to audit ledger.',
        programArea: 'Research',
        media: {
          src: 'foundation.svg',
          alt: 'Founders',
        },
        draft: false,
      },
      render: async () => ({ Content: () => null }),
    },
    {
      id: 'history/internal-draft',
      slug: 'internal draft milestone',
      data: {
        year: 2024,
        headline: 'Draft milestone pending review',
        narrative: 'Should never render publicly.',
        programArea: 'Platform',
        media: {
          src: 'draft.svg',
          alt: 'Draft asset',
        },
        draft: true,
      },
      render: async () => ({ Content: () => null }),
    },
  ];

  return {
    getCollection: vi.fn(async (collection: string) => {
      expect(collection).toBe('history');
      return dataset;
    }),
  };
});

vi.mock('astro:content', () => ({
  getCollection,
}));

beforeEach(() => {
  getCollection.mockClear();
});

describe('getTimelineMilestones', () => {
  it('returns milestones sorted descending by year and excludes drafts', async () => {
    const milestones = await getTimelineMilestones();

    expect(getCollection).toHaveBeenCalledTimes(1);
    expect(milestones).toHaveLength(2);
    expect(milestones.map((milestone) => milestone.year)).toEqual([2022, 2018]);
    expect(milestones.map((milestone) => milestone.slug)).toEqual([
      'governance-lab',
      'research-foundation',
    ]);
    expect(milestones[0]?.href).toBe(`#milestone-2022-governance-lab`);
    expect(milestones[1]?.id).toBe('milestone-2018-research-foundation');
  });
});

describe('buildTimelineSchema', () => {
  it('serialises milestones into a descending ItemList with media metadata', async () => {
    const milestones = await getTimelineMilestones();
    const schema = buildTimelineSchema(milestones, new URL('https://apotheon.ai'));

    expect(schema['@type']).toBe('ItemList');
    expect(schema.itemListElement).toHaveLength(2);
    expect(schema.itemListElement[0]?.item.url).toBe(
      `https://apotheon.ai${HISTORY_ROUTE}#milestone-2022-governance-lab`,
    );
    expect(schema.itemListElement[0]?.item.image).toMatchObject({
      url: 'https://apotheon.ai/assets/history/governance.svg',
      caption: 'Oversight walkthrough',
      creditText: 'Compliance Team',
    });
    expect(schema.itemListElement[1]?.item.image).toMatchObject({
      url: 'https://apotheon.ai/assets/history/foundation.svg',
    });
  });
});
