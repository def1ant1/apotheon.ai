import { render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ExperimentBadge from '../ExperimentBadge';

describe('ExperimentBadge island', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders the accelerated variant when GrowthBook enables it', async () => {
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
        hash: 'sha256:hook',
        source: 'origin',
      }),
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    render(<ExperimentBadge />);

    const badge = await screen.findByTestId('experiment-badge');
    expect(badge).toHaveAttribute('data-variant', 'accelerated');
    expect(badge.textContent).toContain('experiments aligned');

    vi.unstubAllGlobals();
  });
});
