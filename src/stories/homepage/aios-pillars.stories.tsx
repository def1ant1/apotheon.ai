import AiosPillarsSection from '../../components/homepage/AiosPillarsSection';

import type { Meta, Story } from '@ladle/react';

interface PillarData {
  label: string;
  tagline: string;
  longForm: string;
  icon: string;
}

const meta: Meta = {
  title: 'Homepage/AIOS Pillars',
};

export default meta;

const demoPillars: PillarData[] = [
  {
    label: 'Autonomous governance',
    tagline: 'Machine-audited controls for every launch gate.',
    longForm:
      'Policies map directly to enforcement hooks, generating audit evidence and regulator-ready dossiers without requiring engineers to duplicate compliance notes.',
    icon: 'themis',
  },
  {
    label: 'Observability mesh',
    tagline: 'Full-fidelity telemetry stitched across models and humans.',
    longForm:
      'Blend events from models, APIs, and human reviewers into a single pane with automated anomaly routing. Operators never lose sight of risk thresholds.',
    icon: 'hermes',
  },
  {
    label: 'Adaptive orchestration',
    tagline: 'Pipeline intelligence that optimizes itself per tenant.',
    longForm:
      'Routing logic learns from usage, trust feedback, and latency budgets to reconfigure workflows in real time—all without manual redeploys.',
    icon: 'morpheus',
  },
  {
    label: 'Lifecycle automation',
    tagline: 'Enterprise release cadence without regression roulette.',
    longForm:
      'Blueprints coordinate evaluation, red teaming, and rollout approvals so product, security, and legal stay aligned every sprint.',
    icon: 'clio',
  },
];

export const PillarsAcrossThemes: Story = () => (
  <article className="token-story">
    <header>
      <h1 className="token-story__title">AIOS pillars (light + dark themes)</h1>
      <p className="token-story__lede">
        The layout mirrors <code>src/components/homepage/AiosPillarsSection.tsx</code>. Use this
        story to preview how Tailwind tokens respond across themes and to document copy updates for
        go-to-market stakeholders.
      </p>
    </header>

    <section className="token-flex token-flex--grid" style={{ gap: 'var(--space-lg)' }}>
      <div data-theme="light" className="space-y-4">
        <h2>Light theme</h2>
        <AiosPillarsSection
          heading="AI Operating System pillars"
          description="Previewed with the light theme token ramp."
          pillars={demoPillars}
        />
      </div>
      <div data-theme="dark" className="space-y-4">
        <h2>Dark theme</h2>
        <AiosPillarsSection
          heading="AI Operating System pillars"
          description="Dark theme render ensures contrast ratios stay compliant."
          pillars={demoPillars}
        />
      </div>
    </section>

    <section className="details-explainer">
      <details open>
        <summary>Editorial workflow</summary>
        <ol>
          <li>
            Update <code>pillars</code> in <code>src/content/homepage/landing.mdx</code>. Maintain
            the order—analytics relies on position to map downstream campaigns.
          </li>
          <li>
            Icon slugs must match filenames in <code>public/static/icons/brand</code> (no
            extension). Designers can refresh artwork without touching markdown; the slug is the
            contract.
          </li>
          <li>
            Run <code>npm run typecheck</code> to confirm the schema accepts the edits, then execute
            <code>npm run test</code> so Vitest replays list-count assertions.
          </li>
        </ol>
      </details>
    </section>
  </article>
);
Object.assign(PillarsAcrossThemes, {
  storyName: 'Pillars across themes',
  meta: { width: 'full' },
});
