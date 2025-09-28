import { beforeEach, describe, expect, it } from 'vitest';

import { createConsentAwarePlausibleLoader } from '../analytics-consent-gate';

describe('consent-aware analytics loader', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    delete window.plausible;
    window.localStorage.clear();
  });

  it('does not inject the Plausible script when consent is denied', () => {
    const loader = createConsentAwarePlausibleLoader({
      domain: 'example.com',
      scriptSrc: '/plausible.js',
      consentService: 'umami-telemetry',
    });

    loader.sync({ 'umami-telemetry': false });

    expect(document.head.querySelector('[data-apotheon-analytics="plausible"]')).toBeNull();
    expect(window.plausible).toBeUndefined();
  });

  it('injects the script when consent is granted and removes it on revoke', () => {
    const loader = createConsentAwarePlausibleLoader({
      domain: 'example.com',
      scriptSrc: '/plausible.js',
      consentService: 'umami-telemetry',
    });

    loader.sync({ 'umami-telemetry': true });

    const injected = document.head.querySelector('[data-apotheon-analytics="plausible"]');
    expect(injected).not.toBeNull();
    expect(injected).toHaveAttribute('data-consent-service', 'umami-telemetry');
    expect(window.plausible).toBeTypeOf('function');

    loader.sync({ 'umami-telemetry': false });
    expect(document.head.querySelector('[data-apotheon-analytics="plausible"]')).toBeNull();
    expect(window.plausible).toBeUndefined();
  });
});
