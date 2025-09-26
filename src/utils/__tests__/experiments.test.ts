import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __internal,
  evaluateFlag,
  getExperimentsSnapshot,
  type ExperimentsSnapshot,
  useExperimentFlag,
} from '../experiments';

describe('experiments utilities', () => {
  beforeEach(() => {
    const cache = __internal.getCacheContainer();
    cache.snapshot = __internal.SAFE_SNAPSHOT;
    cache.inFlight = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the network snapshot when the proxy responds successfully', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        features: {
          'homepage.hero.badge': {
            defaultValue: 'control',
            rules: [{ condition: {}, force: 'accelerated' }],
          },
        },
        fetchedAt: '2024-10-10T00:00:00.000Z',
        hash: 'sha256:test',
        source: 'origin',
        metadata: { upstreamStatus: 200 },
      }),
    });

    const snapshot = await getExperimentsSnapshot({
      endpoint: 'https://example.com/v1/features',
      fetchImplementation: fetchMock,
    });

    expect(snapshot.features['homepage.hero.badge']).toBeDefined();
    expect(snapshot.source).toBe('origin');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to cached snapshot when the network errors', async () => {
    const cache = __internal.getCacheContainer();
    const cached: ExperimentsSnapshot = {
      features: { 'homepage.hero.badge': { defaultValue: 'control' } },
      fetchedAt: '2024-10-09T00:00:00.000Z',
      hash: 'sha256:cached',
      source: 'cache',
      metadata: {},
    };
    cache.snapshot = cached;

    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    const snapshot = await getExperimentsSnapshot({
      endpoint: 'https://example.com/v1/features',
      fetchImplementation: fetchMock,
      forceRefresh: true,
    });

    expect(snapshot.hash).toBe('sha256:cached');
    expect(snapshot.features['homepage.hero.badge']).toEqual({ defaultValue: 'control' });
  });

  it('evaluates flags using the provided snapshot', () => {
    const snapshot: ExperimentsSnapshot = {
      features: {
        'homepage.hero.badge': {
          defaultValue: 'control',
          rules: [{ condition: {}, force: 'accelerated' }],
        },
      },
      fetchedAt: '2024-10-10T00:00:00.000Z',
      hash: 'sha256:demo',
      source: 'origin',
      metadata: {},
    };

    const evaluation = evaluateFlag({
      flag: 'homepage.hero.badge',
      fallback: 'control',
      snapshot,
    });

    expect(evaluation.value).toBe('accelerated');
    expect(evaluation.snapshotSource).toBe('origin');
  });

  it('hydrates the React hook and surfaces loading state', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        features: {
          'homepage.hero.badge': {
            defaultValue: 'control',
            rules: [{ condition: {}, force: 'accelerated' }],
          },
        },
        fetchedAt: '2024-10-10T00:00:00.000Z',
        hash: 'sha256:hook',
        source: 'origin',
      }),
    });

    const { result, rerender } = renderHook(
      (props: { refetchOnMount?: boolean }) =>
        useExperimentFlag({
          flag: 'homepage.hero.badge',
          fallback: 'control',
          fetchImplementation: fetchMock,
          endpoint: 'https://example.com/v1/features',
          refetchOnMount: props.refetchOnMount,
        }),
      { initialProps: { refetchOnMount: true } },
    );

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.loading).toBe(false);
    expect(result.current.value).toBe('accelerated');

    rerender({ refetchOnMount: false });
    expect(result.current.error).toBeUndefined();
  });
});
