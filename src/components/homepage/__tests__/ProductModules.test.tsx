import { render, screen, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import ProductModulesSection from '../ProductModulesSection';

const demoModules = [
  {
    name: 'Governance Lakehouse',
    summary:
      'Unifies policies, risk scoring, and mitigation tasks so legal, security, and product teams collaborate from the same source of truth.',
    href: '/solutions/governance-lakehouse',
    icon: 'themis',
  },
  {
    name: 'Observability Fabric',
    summary:
      'Streams token-level telemetry, feedback queues, and anomaly detection to keep every agentic workflow measurable and improvable.',
    href: '/solutions/observability-fabric',
    icon: 'hermes',
  },
  {
    name: 'Automation Studio',
    summary:
      'No-code and code-native builders orchestrate human reviews, multi-model routing, and escalation runbooks with enterprise-grade RBAC.',
    href: '/solutions/automation-studio',
    icon: 'mnemosyne',
  },
];

describe('Product modules section', () => {
  it('renders anchored cards with matching href targets', async () => {
    render(
      <ProductModulesSection
        heading="Test Modules"
        description="Synthetic description for verification"
        modules={demoModules}
      />,
    );

    const list = screen.getByTestId('product-modules-list');
    const items = within(list).getAllByRole('link');

    expect(list.tagName.toLowerCase()).toBe('ul');
    expect(items).toHaveLength(demoModules.length);

    demoModules.forEach((module, index) => {
      const icon = screen.getByAltText(`${module.name} icon`);
      expect(icon).toBeInstanceOf(HTMLImageElement);
      expect(items[index].getAttribute('href')).toBe(module.href);
    });
  });
});
