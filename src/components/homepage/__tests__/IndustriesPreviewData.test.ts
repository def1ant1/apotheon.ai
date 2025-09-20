import { describe, expect, it, vi, beforeEach } from 'vitest';

import { loadIndustriesPreviewCards, INDUSTRIES_PREVIEW_LIMIT } from '../industries-preview-data';

import type { IndustryEntry } from '../../../content/industries';

interface IndustryEntryStub {
  id: string;
  slug: string;
  data: {
    title: string;
    hero: { copy: string; icon: IndustryEntry['data']['hero']['icon'] };
    order: number;
    draft: boolean;
  };
}

const { getCollection } = vi.hoisted(() => {
  const dataset: IndustryEntryStub[] = [
    {
      id: 'space',
      slug: 'space',
      data: {
        title: 'Aerospace Command',
        hero: {
          copy: 'Launch telemetry governance with orbital-grade controls.',
          icon: 'transport',
        },
        order: 5,
        draft: false,
      },
    },
    {
      id: 'finance',
      slug: 'finance',
      data: {
        title: 'Financial Services Intelligence',
        hero: {
          copy: 'GRC telemetry and Basel-ready analytics.',
          icon: 'finance',
        },
        order: 2,
        draft: false,
      },
    },
    {
      id: 'draft-sector',
      slug: 'draft-sector',
      data: {
        title: 'Unpublished Vertical',
        hero: {
          copy: 'Should never be visible until the draft flag clears.',
          icon: 'finance',
        },
        order: 1,
        draft: true,
      },
    },
    {
      id: 'solutions/governance',
      slug: 'solutions/governance',
      data: {
        title: 'Governance Lakehouse',
        hero: {
          copy: 'Non-industry marketing node used to verify filtering.',
          icon: 'finance',
        },
        order: 0,
        draft: false,
      },
    },
  ];

  return {
    getCollection: vi.fn(
      async (collection: string, filter?: (entry: IndustryEntryStub) => boolean) => {
        expect(collection).toBe('industries');
        const predicate = typeof filter === 'function' ? filter : () => true;
        const industryOnly = dataset.filter((entry) => !entry.id.startsWith('solutions/'));
        return industryOnly.filter((entry) => predicate(entry));
      },
    ),
  };
});

vi.mock('astro:content', () => ({
  getCollection,
}));

beforeEach(() => {
  getCollection.mockClear();
});

describe('loadIndustriesPreviewCards', () => {
  it('omits drafts and resolves canonical hrefs for published industries', async () => {
    const cards = await loadIndustriesPreviewCards();

    expect(cards).toHaveLength(2);
    expect(cards.map((card) => card.title)).toEqual([
      'Financial Services Intelligence',
      'Aerospace Command',
    ]);
    expect(cards.every((card) => card.href.startsWith('/industries/'))).toBe(true);
    expect(cards.map((card) => card.icon)).toEqual(['finance', 'transport']);
    expect(cards.find((card) => card.title.includes('Unpublished'))).toBeUndefined();
    expect(cards[0]?.href).toBe('/industries/finance/');
  });

  it('enforces the preview limit to keep the homepage scannable', async () => {
    const cards = await loadIndustriesPreviewCards(1);

    expect(cards).toHaveLength(1);
    expect(cards[0]?.title).toBe('Financial Services Intelligence');
  });

  it('defaults to the shared limit constant when none is provided', async () => {
    await loadIndustriesPreviewCards();

    expect(getCollection).toHaveBeenCalledTimes(1);
    expect(INDUSTRIES_PREVIEW_LIMIT).toBe(6);
  });
});
