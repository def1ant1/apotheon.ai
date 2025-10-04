import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { formatContactReachability, injectOperationalHoursCopy } from '../ctaContactNote';
import ResearchBannerSection from '../ResearchBannerSection';

const researchBanner = {
  heading: 'Research partnerships & sandboxes',
  body: 'Coordinate academic cohorts, FEDGEN integrations, and Trace Synthesis sandboxes without bespoke intake workflows.',
  secondaryText: 'Research requests route to dedicated RevOps analysts during %officeHours%.',
  cta: {
    label: 'Explore research hub',
    href: '/research',
    ariaLabel: 'Navigate to the Apotheon.ai research and academic partnerships hub',
  },
};

const expectedEmail = 'hello@apotheon.ai';
const expectedPhone = '+1-206-555-0188';

describe('Research CTA banner', () => {
  it('links aria-describedby text to both the body copy and contact note', async () => {
    render(<ResearchBannerSection banner={researchBanner} />);

    const cta = screen.getByTestId('research-banner-cta');
    const describedBy = cta.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();

    const describedIds = describedBy?.split(' ') ?? [];
    describedIds.forEach((id: string) => {
      const node = document.getElementById(id);
      expect(node).not.toBeNull();
    });
  });

  it('mirrors contact metadata so assistive tech announces outreach details', async () => {
    const contactNote = formatContactReachability('Research partnerships');
    const secondaryCopy = injectOperationalHoursCopy(researchBanner.secondaryText);

    render(<ResearchBannerSection banner={researchBanner} />);

    expect(screen.getAllByText(researchBanner.heading).length).toBeGreaterThan(0);
    if (secondaryCopy) {
      expect(screen.getAllByText(secondaryCopy).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByText(contactNote).length).toBeGreaterThan(0);

    expect(contactNote).toContain(expectedEmail);
    expect(contactNote).toContain(expectedPhone);
  });
});
