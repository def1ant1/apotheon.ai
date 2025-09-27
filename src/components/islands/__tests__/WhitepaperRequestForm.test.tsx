import { render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

import WhitepaperRequestForm from '../WhitepaperRequestForm';

describe('WhitepaperRequestForm', () => {
  beforeEach(() => {
    window.dataLayer = [];
    // Some build targets still expect React on the global scope; expose it for the test runtime.
    (globalThis as typeof globalThis & { React?: typeof React }).React = React;
    // Simulate Turnstile presence so the island skips network loading during tests.
    window.turnstile = {
      render: () => 'test-widget',
      reset: () => undefined,
    } as typeof window.turnstile;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState(null, '', '/');
  });

  it('matches the hydrated markup snapshot', () => {
    const { asFragment } = render(
      <React.StrictMode>
        <WhitepaperRequestForm endpoint="/api/mock" siteKey="test" />
      </React.StrictMode>,
    );
    expect(asFragment()).toMatchSnapshot();
  });

  it('prefills the investor brief when the query parameter is present', async () => {
    window.history.replaceState(
      null,
      '',
      '/about/white-papers/?whitepaperSlug=apotheon-investor-brief#whitepaper-request',
    );

    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    render(
      <React.StrictMode>
        <WhitepaperRequestForm endpoint="/api/mock" siteKey="test" />
      </React.StrictMode>,
    );

    const select = await screen.findByLabelText('Which guide do you need?');
    await waitFor(() => expect(select).toHaveValue('apotheon-investor-brief'));

    expect(window.dataLayer).toContainEqual(
      expect.objectContaining({
        event: 'whitepaper_request_prefill_applied',
        slug: 'apotheon-investor-brief',
        source: 'querystring',
      }),
    );

    expect(infoSpy).toHaveBeenCalledWith(
      '[whitepaper-form] whitepaper_request_prefill_applied',
      expect.objectContaining({ slug: 'apotheon-investor-brief', source: 'querystring' }),
    );
  });

  it('logs when an invalid query parameter cannot be matched', () => {
    window.history.replaceState(null, '', '/about/white-papers/?whitepaperSlug=unknown-whitepaper');

    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    render(
      <React.StrictMode>
        <WhitepaperRequestForm endpoint="/api/mock" siteKey="test" />
      </React.StrictMode>,
    );

    expect(window.dataLayer).toContainEqual(
      expect.objectContaining({
        event: 'whitepaper_request_prefill_ignored',
        slug: 'unknown-whitepaper',
        reason: 'manifest-miss',
      }),
    );

    expect(infoSpy).toHaveBeenCalledWith(
      '[whitepaper-form] whitepaper_request_prefill_ignored',
      expect.objectContaining({ slug: 'unknown-whitepaper', reason: 'manifest-miss' }),
    );
    const select = screen.getByLabelText('Which guide do you need?');
    expect(select).toHaveValue('');
  });
});
