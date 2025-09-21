import { render } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it, beforeEach } from 'vitest';

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

  it('matches the hydrated markup snapshot', () => {
    const { asFragment } = render(
      <React.StrictMode>
        <WhitepaperRequestForm endpoint="/api/mock" siteKey="test" />
      </React.StrictMode>,
    );
    expect(asFragment()).toMatchSnapshot();
  });
});
