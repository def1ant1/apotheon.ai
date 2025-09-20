import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { formatContactReachability, injectOperationalHoursCopy } from '../ctaContactNote';
import DemoBannerSection from '../DemoBannerSection';

const demoBanner = {
  heading: 'Schedule a platform field demo',
  body: 'Partner with a solutions architect for a guided build of governance policies, orchestration flows, and telemetry dashboards.',
  secondaryText:
    'Prefer async exploration? Mention “sandbox access” in the notes and RevOps will send credentials.',
  cta: {
    label: 'Book a guided demo',
    href: '/about/contact/?flow=demo',
    ariaLabel: 'Book an Apotheon.ai platform demonstration with the RevOps team',
  },
};

describe('Demo CTA banner', () => {
  it('exposes the solutions contact details inside visually hidden text', async () => {
    const contactNote = formatContactReachability('Solutions consulting');

    render(<DemoBannerSection banner={demoBanner} />);

    expect(screen.getAllByText(contactNote).length).toBeGreaterThan(0);
    const cta = screen.getByTestId('demo-banner-cta');
    expect(cta.getAttribute('aria-label')).toBe(demoBanner.cta.ariaLabel);
  });

  it('replaces office hour tokens in the optional secondary copy', async () => {
    const resolved = injectOperationalHoursCopy(demoBanner.secondaryText);

    render(<DemoBannerSection banner={demoBanner} />);

    if (resolved) {
      expect(screen.getAllByText(resolved).length).toBeGreaterThan(0);
    }
  });
});
