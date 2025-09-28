import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import { trackAnalyticsEvent } from '../../../utils/analytics';
import PagefindSearch, { type PagefindClient } from '../PagefindSearch';

vi.mock('../../../utils/analytics', () => ({
  trackAnalyticsEvent: vi.fn().mockResolvedValue({ delivered: true }),
}));

declare global {
  // Vitest lacks the DOM typings for window augmentation; we redeclare for clarity in the test scope.
  interface Window {
    __APOTHEON_PAGEFIND__?: PagefindClient;
  }
}

describe('PagefindSearch', () => {
  const trackSpy = vi.mocked(trackAnalyticsEvent);

  beforeEach(() => {
    trackSpy.mockClear();
  });

  afterEach(() => {
    delete (window as typeof window & { __APOTHEON_PAGEFIND__?: PagefindClient })
      .__APOTHEON_PAGEFIND__;
    delete (globalThis as typeof globalThis & { __APOTHEON_PAGEFIND__?: PagefindClient })
      .__APOTHEON_PAGEFIND__;
  });

  it('streams Pagefind results as they resolve', async () => {
    const deferred = createDeferred();

    const searchMock = vi.fn().mockResolvedValue({
      results: [
        {
          id: 'result-1',
          data: vi.fn().mockResolvedValue({
            url: '/docs/',
            meta: { title: 'Docs overview' },
            excerpt: 'Streamed documentation hit.',
          }),
        },
        {
          id: 'result-2',
          data: vi.fn().mockImplementation(() =>
            deferred.promise.then(() => ({
              url: '/blog/',
              meta: { title: 'Blog insights' },
              excerpt: 'Second result lands once the deferred resolves.',
            })),
          ),
        },
      ],
    });

    installPagefindClient({ search: searchMock });

    const user = userEvent.setup();
    render(<PagefindSearch />);

    const input = screen.getByRole('searchbox', { name: /search apotheon\.ai/i });
    await user.type(input, 'automation');

    await expect(screen.findByRole('link', { name: /Docs overview/ })).resolves.toBeDefined();

    expect(screen.queryByText(/Second result/)).toBeNull();
    deferred.resolve();
    await expect(screen.findByRole('link', { name: /Blog insights/ })).resolves.toBeDefined();

    expect(searchMock).toHaveBeenCalledWith('automation');
  });

  it('surfaces curated suggestions when nothing matches', async () => {
    const searchMock = vi.fn().mockResolvedValue({ results: [] });
    installPagefindClient({ search: searchMock });

    const user = userEvent.setup();
    render(<PagefindSearch />);

    const input = screen.getByRole('searchbox', { name: /search apotheon\.ai/i });
    await user.type(input, 'unknown term');

    await expect(screen.findByText(/No matches for/)).resolves.toBeDefined();
    const suggestions = await screen.findByTestId('pagefind-search-suggestions');
    expect(suggestions.querySelectorAll('a')).toHaveLength(4);
  });

  it('reports analytics outcomes while respecting consent opt-outs', async () => {
    const searchMock = vi.fn().mockResolvedValue({
      results: [
        {
          id: 'result-1',
          data: vi.fn().mockResolvedValue({
            url: '/solutions/',
            meta: { title: 'Solution detail' },
            excerpt: 'Result snippet.',
          }),
        },
      ],
    });

    installPagefindClient({ search: searchMock });

    trackSpy.mockImplementation(async (options) => {
      options.onOptOut?.();
      return { delivered: false, reason: 'consent-denied' };
    });

    const user = userEvent.setup();
    render(<PagefindSearch />);

    const input = screen.getByRole('searchbox', { name: /search apotheon\.ai/i });
    await user.type(input, 'platforms');

    await waitFor(() => {
      expect(trackSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'search_query',
          payload: expect.objectContaining({ query: 'platforms', status: 'results' }),
        }),
      );
    });

    await expect(
      screen.findByText('Telemetry respects your consent settings; analytics logging was skipped.'),
    ).resolves.toBeDefined();
  });
});

function installPagefindClient(overrides: Partial<PagefindClient> = {}): void {
  const client: PagefindClient = {
    search: async () => ({ results: [] }),
    ...overrides,
  };
  (window as typeof window & { __APOTHEON_PAGEFIND__?: PagefindClient }).__APOTHEON_PAGEFIND__ =
    client;
  (
    globalThis as typeof globalThis & { __APOTHEON_PAGEFIND__?: PagefindClient }
  ).__APOTHEON_PAGEFIND__ = client;
}

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}
