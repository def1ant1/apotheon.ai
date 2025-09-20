import ProductModulesSection from '../../components/homepage/ProductModulesSection';

import type { Meta, Story } from '@ladle/react';

interface ModuleData {
  name: string;
  summary: string;
  href: string;
  icon: string;
}

const meta: Meta = {
  title: 'Homepage/Product Modules',
};

export default meta;

const demoModules: ModuleData[] = [
  {
    name: 'Governance Lakehouse',
    summary:
      'Centralizes policies, attestations, and remediation workflows so legal, risk, and product teams work from the same truth set.',
    href: '/solutions/governance-lakehouse',
    icon: 'themis',
  },
  {
    name: 'Observability Fabric',
    summary:
      'Token-level telemetry with configurable retention and anomaly routing. Scales from pre-production evals to global deployments.',
    href: '/solutions/observability-fabric',
    icon: 'hermes',
  },
  {
    name: 'Automation Studio',
    summary:
      'Builder that choreographs human reviews, multi-model routing, and escalation handoffs with enterprise-grade RBAC.',
    href: '/solutions/automation-studio',
    icon: 'mnemosyne',
  },
];

export const ModulesDeepDive: Story = () => (
  <article className="token-story">
    <header>
      <h1 className="token-story__title">Product modules grid</h1>
      <p className="token-story__lede">
        Anchored cards hydrate from the homepage collection. This story mirrors
        <code>ProductModulesSection</code> so designers can verify hover states and reviewers can
        trace copy back to the markdown source.
      </p>
    </header>

    <ProductModulesSection
      heading="Product modules ready for deployment"
      description="Story mirrors the production component; adjust the markdown frontmatter to add or re-order modules."
      modules={demoModules}
    />

    <section className="details-explainer">
      <details open>
        <summary>Maintaining module content</summary>
        <ul>
          <li>
            Edit <code>modules</code> in <code>src/content/homepage/landing.mdx</code>. Keep names
            synced with <code>/solutions</code> routes to avoid 404s.
          </li>
          <li>
            The Vitest suite asserts link counts and destinations; run <code>npm run test</code>{' '}
            after changing module data to keep automation honest.
          </li>
          <li>
            If a new icon is required, add the SVG under <code>public/static/icons/brand</code> and
            reference the slug (without the <code>.svg</code> extension) in the frontmatter.
          </li>
        </ul>
      </details>
    </section>
  </article>
);
Object.assign(ModulesDeepDive, {
  storyName: 'Modules deep-dive',
  meta: { width: 'full' },
});
