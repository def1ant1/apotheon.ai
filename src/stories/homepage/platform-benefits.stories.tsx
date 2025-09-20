import PlatformBenefitsSection from '../../components/homepage/PlatformBenefitsSection';

import type { Meta, Story } from '@ladle/react';

const meta: Meta = {
  title: 'Homepage/Platform Benefits',
};

export default meta;

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

export const BenefitGrid: Story = () => (
  <article className="token-story">
    <header>
      <h1 className="token-story__title">Platform benefit cards</h1>
      <p className="token-story__lede">
        Mirrors the production Astro layout. Update <code>benefits</code> in
        <code>src/content/homepage/landing.mdx</code> to keep RevOps metrics fresh. Story allows
        quick QA on responsive collapse and copy length.
      </p>
    </header>

    <PlatformBenefitsSection benefits={demoBenefits} />

    <section className="details-explainer">
      <details open>
        <summary>Editorial expectations</summary>
        <ul>
          <li>Keep benefit titles short enough to avoid wrapping on 320px viewports.</li>
          <li>
            Proof points should reference automated workflows—no manual heroics. Metrics must map to
            CRM-backed evidence before publishing.
          </li>
          <li>
            Run <code>npm run ladle:build</code> after updating styling tokens so the accessible
            color audit stays current.
          </li>
        </ul>
      </details>
    </section>
  </article>
);
Object.assign(BenefitGrid, { storyName: 'Benefit grid showcase', meta: { width: 'full' } });
