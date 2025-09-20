import { describe, expect, it } from 'vitest';

import { buildDiagramAccessibilityState } from '../solutionDiagram.helpers';

describe('buildDiagramAccessibilityState', () => {
  it('generates aria metadata that reuses alt text and captions', () => {
    const state = buildDiagramAccessibilityState(
      {
        slug: 'nova',
        alt: 'Nova governance loop guiding sandbox provisioning, policy guardrails, and monitored launches.',
        caption:
          'Nova automates sandbox provisioning, policy guardrails, and live monitoring so experimentation stays compliant.',
      },
      'solutions-diagram',
    );

    expect(state.captionId).toBe('solutions-diagram-caption');
    expect(state.inlineAttributes['aria-label']).toMatch(/sandbox provisioning/);
    expect(state.inlineAttributes['aria-describedby']).toBe(state.captionId);
    expect(state.imageAttributes['aria-describedby']).toBe(state.captionId);
    expect(state.imageAttributes.loading).toBe('lazy');
    expect(state.imageAttributes.decoding).toBe('async');
  });
});
