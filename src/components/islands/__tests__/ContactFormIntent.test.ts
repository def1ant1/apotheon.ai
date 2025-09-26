import { describe, expect, it } from 'vitest';

import { resolveIntentPresetFromSearch, type IntentPresetResolution } from '../ContactForm';

describe('resolveIntentPresetFromSearch', () => {
  it('returns the default intent when no query params exist', () => {
    const resolution = resolveIntentPresetFromSearch(null);
    expect(resolution.intent).toBe('demo');
    expect(resolution.analyticsEvent).toBe('lead_demo');
    expect(resolution.source).toBe('default');
  });

  it('maps the investor-relations team to the investor intent', () => {
    const resolution = resolveIntentPresetFromSearch('?team=investor-relations');
    expect(resolution.intent).toBe('investor');
    expect(resolution.analyticsEvent).toBe('lead_investor');
    expect(resolution.source).toBe('team');
    expect(resolution.team).toBe('investor-relations');
  });

  it('normalizes casing and stray whitespace in the query value', () => {
    const resolution = resolveIntentPresetFromSearch('?team= Investor-Relations ');
    expect(resolution.intent).toBe('investor');
    expect(resolution.analyticsEvent).toBe('lead_investor');
  });

  it('falls back to default intent when the team is not recognized', () => {
    const unknown: IntentPresetResolution = resolveIntentPresetFromSearch('?team=operations');
    expect(unknown.intent).toBe('demo');
    expect(unknown.analyticsEvent).toBe('lead_demo');
    expect(unknown.source).toBe('default');
    expect(unknown.team).toBeUndefined();
  });
});
