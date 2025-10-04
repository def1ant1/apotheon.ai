import DemoBannerSection from '../../components/homepage/DemoBannerSection';
import InvestorBannerSection from '../../components/homepage/InvestorBannerSection';
import ResearchBannerSection from '../../components/homepage/ResearchBannerSection';
import { footerContact } from '../../components/navigation/contactMetadata';

import type { Meta, Story } from '@ladle/react';

const meta: Meta = {
  title: 'Homepage/CTA Banners',
};

export default meta;

const investorBanner = {
  heading: 'Investor relations briefing center',
  body: 'Download the diligence-ready deck, financial snapshot, and roadmap overview curated for institutional partners.',
  secondaryText: `Responses guaranteed within one business day during ${footerContact.officeHours}.`,
  cta: {
    label: 'Access investor materials',
    href: '/about/investors/',
    ariaLabel:
      'Navigate to the Apotheon.ai investor relations overview before requesting materials',
  },
};

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

const researchBanner = {
  heading: 'Research partnerships & sandboxes',
  body: 'Coordinate academic cohorts, FEDGEN integrations, and Trace Synthesis sandboxes without bespoke intake workflows.',
  secondaryText: `Research requests route to dedicated RevOps analysts during ${footerContact.officeHours}.`,
  cta: {
    label: 'Explore research hub',
    href: '/research',
    ariaLabel: 'Navigate to the Apotheon.ai research and academic partnerships hub',
  },
};

export const BannerShowcase: Story = () => (
  <article className="token-story">
    <header>
      <h1 className="token-story__title">Homepage CTA banners</h1>
      <p className="token-story__lede">
        Stories mirror the production Astro banners. Update <code>ctaBanners</code> in the homepage
        frontmatter to keep CTAs aligned with GTM campaigns and investor disclosures.
      </p>
    </header>

    <div className="space-y-10">
      <InvestorBannerSection banner={investorBanner} />
      <ResearchBannerSection banner={researchBanner} />
      <DemoBannerSection banner={demoBanner} />
    </div>

    <section className="details-explainer">
      <details open>
        <summary>Governance tips</summary>
        <ul>
          <li>
            When gradients change, re-run <code>npm run ladle:build</code> to confirm contrast
            tooling and Playwright snapshots stay honest.
          </li>
          <li>
            Accessible descriptions reuse <code>footerContact</code>. Update contact metadata in a
            single place and the banners refresh automatically.
          </li>
          <li>
            Keyboard support is enforced via <code>tests/e2e/homepage-cta-banners.spec.ts</code>;
            run the suite locally before merging.
          </li>
        </ul>
      </details>
    </section>
  </article>
);
Object.assign(BannerShowcase, { storyName: 'CTA banner deep-dive', meta: { width: 'full' } });
