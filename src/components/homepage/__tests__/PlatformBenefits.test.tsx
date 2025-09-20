import { render, screen, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import PlatformBenefitsSection from '../PlatformBenefitsSection';

const demoBenefits = [
  {
    title: 'ROI acceleration',
    proofPoint:
      'Policy automation and pre-built governance templates compress onboarding from months to hours, reducing services drag.',
    metric: '6.2x faster compliance sign-off',
  },
  {
    title: 'Security posture',
    proofPoint:
      'Unified controls, continuous attestation, and federated secrets ensure every agent workflow inherits zero-trust defaults.',
    metric: '42% reduction in audit findings',
  },
  {
    title: 'Continuous learning',
    proofPoint:
      'Feedback routing and active learning loops retrain orchestration policies automatically as teams scale globally.',
    metric: 'Weekly model uplift cadence',
  },
  {
    title: 'Elastic scalability',
    proofPoint:
      'Multi-region orchestration keeps latency predictable while auto-rightsizing GPU footprints per tenant demand.',
    metric: 'Sub-120ms median inference latency',
  },
];

describe('Platform benefits section', () => {
  it('renders semantic list items for each benefit', async () => {
    render(<PlatformBenefitsSection benefits={demoBenefits} />);

    const region = screen.getByRole('region', {
      name: /platform outcomes enterprise teams expect/i,
    });
    const list = within(region).getByRole('list');
    const items = within(list).getAllByRole('listitem');

    expect(items).toHaveLength(demoBenefits.length);
    demoBenefits.forEach((benefit) => {
      const metricElements = screen.getAllByText(benefit.metric);
      expect(metricElements.length).toBeGreaterThan(0);
    });
  });

  it('exposes aria labels for metrics so screen readers read the results', async () => {
    const [firstBenefit] = demoBenefits;

    render(<PlatformBenefitsSection benefits={[firstBenefit]} />);

    const metric = screen.getAllByText(firstBenefit.metric)[0];
    expect(metric.getAttribute('aria-label')).toBe(`Result: ${firstBenefit.metric}`);
  });
});
