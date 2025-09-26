import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { formatContactReachability, injectOperationalHoursCopy } from '../ctaContactNote';
import InvestorBannerSection from '../InvestorBannerSection';

const investorBanner = {
  heading: 'Investor relations briefing center',
  body: 'Download the diligence-ready deck, financial snapshot, and roadmap overview curated for institutional partners.',
  secondaryText: 'Responses guaranteed within one business day during %officeHours%.',
  cta: {
    label: 'Access investor materials',
    href: '/about/investors/',
    ariaLabel:
      'Navigate to the Apotheon.ai investor relations overview before requesting materials',
  },
};

const expectedEmail = 'hello@apotheon.ai';
const expectedPhone = '+1-206-555-0188';

describe('Investor CTA banner', () => {
  it('links aria-describedby text to both the body copy and contact note', async () => {
    render(<InvestorBannerSection banner={investorBanner} />);

    const cta = screen.getByTestId('investor-banner-cta');
    const describedBy = cta.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();

    const describedIds = describedBy?.split(' ') ?? [];
    describedIds.forEach((id: string) => {
      const node = document.getElementById(id);
      expect(node).not.toBeNull();
    });
  });

  it('mirrors contact metadata so assistive tech announces outreach details', async () => {
    const contactNote = formatContactReachability('Investor relations');
    const secondaryCopy = injectOperationalHoursCopy(investorBanner.secondaryText);

    render(<InvestorBannerSection banner={investorBanner} />);

    expect(screen.getAllByText(investorBanner.heading).length).toBeGreaterThan(0);
    if (secondaryCopy) {
      expect(screen.getAllByText(secondaryCopy).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByText(contactNote).length).toBeGreaterThan(0);

    expect(contactNote).toContain(expectedEmail);
    expect(contactNote).toContain(expectedPhone);
  });
});
