import { describe, expect, it } from 'vitest';

import { INDUSTRY_ICON_SLUGS } from '../../../content/industries/iconSlugs';
import { resolveIndustryIcon } from '../icon-map';

import type {
  IndustryComplianceHighlight,
  IndustryCtaGroup,
  IndustryHeroContent,
  IndustryPressure,
  IndustrySolutionReference,
  IndustrySolutionSummary,
  IndustryUseCase,
} from '../types';

describe('Industry section view models', () => {
  const hero: IndustryHeroContent = {
    eyebrow: 'Regulated Industries',
    headline: 'Mission ready intelligence',
    copy: 'Structured playbooks keep executives aligned on compliance, automation, and go-live velocity.',
    icon: 'finance',
  } as const;

  const pressures: IndustryPressure[] = [
    {
      title: 'Siloed telemetry inflates response times',
      description:
        'Teams lose hours stitching together telemetry across finance, risk, and operations dashboards.',
      metric: '52% of operators cite duplicate investigations as a top risk.',
    },
    {
      title: 'Manual attestations delay procurement',
      description:
        'Security teams chase spreadsheet attestations instead of working from shared system-of-record evidence.',
      metric: '8+ hours burned each week summarizing control status.',
    },
    {
      title: 'Automation programs stall on compliance reviews',
      description:
        'Program leads hesitate to ship new flows without explicit policy guardrails baked into orchestrations.',
    },
  ] as const;

  const complianceHighlights: IndustryComplianceHighlight[] = [
    {
      framework: 'SOC 2 Type II + ISO 27001',
      highlight:
        'Shared control inheritance packages accelerate third-party assessments across global teams.',
      evidence: 'SOC 2 Type II report and ISO certificates in vendor portal.',
    },
  ] as const;

  const solutionMap: IndustrySolutionReference[] = [
    {
      slug: 'atlas',
      positioning: 'Centralizes telemetry and governed analytics for financial services teams.',
      outcome: 'Cuts investigation prep time in half.',
    },
    {
      slug: 'automation-studio',
      positioning:
        'Delivers policy-driven automations that pass internal risk reviews without manual rewrites.',
    },
  ] as const;

  const useCases: IndustryUseCase[] = [
    {
      title: 'Unified control room',
      persona: 'Operations executives',
      narrative:
        'Blend telemetry, approvals, and audits into a single mission control experience for stakeholders.',
      automationLevel: 'Automated alerts with manual approvals.',
    },
    {
      title: 'Evidence automation',
      persona: 'Risk and compliance leads',
      narrative:
        'Auto-generate attestations, POA&Ms, and regulator-ready audit packages with reusable templates.',
    },
  ] as const;

  const ctas: IndustryCtaGroup = {
    demo: {
      label: 'Request a tailored demo',
      href: '/about/contact/?flow=demo&vertical=finance',
      description: 'Partner with platform specialists to scope governed telemetry patterns.',
    },
    whitepaper: {
      label: 'Download the compliance brief',
      href: '/assets/whitepapers/sample.pdf',
      description: 'Review the audit-ready architecture and reporting approach.',
    },
  } as const;

  const solutionEntries: IndustrySolutionSummary[] = [
    {
      slug: 'atlas',
      data: { title: 'Atlas Data Fabric' },
    },
    {
      slug: 'automation-studio',
      data: { title: 'Automation Studio' },
    },
  ] as const;

  it('snapshots the hero payload', () => {
    expect({ hero, title: 'Finance Intelligence' }).toMatchSnapshot();
  });

  it('snapshots pressures and metrics', () => {
    expect(pressures).toMatchSnapshot();
  });

  it('snapshots mapped solutions and validates linked titles', () => {
    const resolvedSolutions = solutionMap.map((item) => {
      const match = solutionEntries.find((entry) => entry.slug === item.slug);
      return {
        slug: item.slug,
        title: match?.data.title ?? item.slug.replace(/-/g, ' '),
        href: `/solutions/${item.slug}/`,
        positioning: item.positioning,
        outcome: item.outcome ?? null,
      };
    });

    expect(resolvedSolutions).toMatchSnapshot();
    expect(resolvedSolutions.map((entry) => entry.title)).toEqual([
      'Atlas Data Fabric',
      'Automation Studio',
    ]);
  });

  it('snapshots persona use cases', () => {
    expect(useCases).toMatchSnapshot();
  });

  it('snapshots compliance highlights', () => {
    expect(complianceHighlights).toMatchSnapshot();
  });

  it('snapshots CTA configuration', () => {
    expect(ctas).toMatchSnapshot();
  });

  it('tracks the registered industry icon slugs for schema parity', () => {
    expect(INDUSTRY_ICON_SLUGS).toMatchSnapshot('industry-icon-slugs');
  });

  it.each(INDUSTRY_ICON_SLUGS)(
    'resolves an icon component for %s',
    (slug: (typeof INDUSTRY_ICON_SLUGS)[number]) => {
      /**
       * The icon resolver must always return a renderable component. Some of our
       * generated icons use `forwardRef`, which returns a React element factory
       * object with a `render` method instead of a bare function. We normalize the
       * assertion to cover both patterns without coupling the test to React
       * internals.
       */
      const IconComponent = resolveIndustryIcon(slug);
      expect(IconComponent).toBeTruthy();
      if (typeof IconComponent === 'object') {
        expect('render' in IconComponent).toBe(true);
      } else {
        expect(typeof IconComponent).toBe('function');
      }
    },
  );
});
