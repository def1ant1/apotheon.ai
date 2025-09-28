import { describe, expect, it } from 'vitest';

import {
  resolveIntentPresetFromSearch,
  type IntentPresetResolution,
} from '../../../utils/audience-resolver';

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
    expect(unknown.role).toBeUndefined();
    expect(unknown.rolePreset).toBeUndefined();
  });

  it('maps the dev role to the demo intent and exposes the preset messaging', () => {
    const dev = resolveIntentPresetFromSearch('?role=dev');
    expect(dev.intent).toBe('demo');
    expect(dev.analyticsEvent).toBe('lead_demo');
    expect(dev.source).toBe('role');
    expect(dev.role).toBe('dev');
    expect(dev.rolePreset?.hero.headline).toContain('Accelerate AI delivery');
  });

  it('ensures team presets win over roles while still surfacing the role copy', () => {
    const combined = resolveIntentPresetFromSearch('?team=investor-relations&role=exec');
    expect(combined.intent).toBe('investor');
    expect(combined.analyticsEvent).toBe('lead_investor');
    expect(combined.source).toBe('team');
    expect(combined.team).toBe('investor-relations');
    expect(combined.role).toBe('exec');
    expect(combined.rolePreset?.contact.headline).toContain('Executive alignment');
  });
});
