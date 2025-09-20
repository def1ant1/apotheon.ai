import React, { type FC } from 'react';

import { formatContactReachability, injectOperationalHoursCopy } from './ctaContactNote';

import type { HomepageInvestorBanner } from '@content/homepage';

export interface InvestorBannerSectionProps {
  banner: HomepageInvestorBanner;
}

const InvestorBannerSection: FC<InvestorBannerSectionProps> = ({ banner }) => {
  const descriptionId = React.useId();
  const contactId = React.useId();
  const headingId = React.useId();
  const secondaryCopy = injectOperationalHoursCopy(banner.secondaryText);
  const contactNote = formatContactReachability('Investor relations');

  return (
    <section
      aria-labelledby={headingId}
      aria-describedby={`${descriptionId} ${contactId}`}
      className="overflow-hidden rounded-3xl border border-slate-800/70 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8 shadow-xl ring-1 ring-slate-900/60"
      data-analytics-region="homepage-investor-banner"
    >
      <div className="space-y-6">
        <header className="space-y-3">
          <h2 id={headingId} className="text-3xl font-semibold text-white md:text-4xl">
            {banner.heading}
          </h2>
          <p id={descriptionId} className="text-base text-slate-300 md:text-lg">
            {banner.body}
          </p>
          {secondaryCopy ? (
            <p className="text-sm text-slate-400 md:text-base">{secondaryCopy}</p>
          ) : null}
        </header>

        <p id={contactId} className="sr-only">
          {contactNote}
        </p>

        <a
          className="inline-flex items-center justify-center gap-2 rounded-full border border-sky-400 bg-sky-500 px-6 py-3 text-sm font-semibold uppercase tracking-wide text-slate-950 transition hover:bg-sky-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
          data-analytics-id="homepage-investor-banner-cta"
          data-testid="investor-banner-cta"
          href={banner.cta.href}
          aria-label={banner.cta.ariaLabel}
          aria-describedby={`${descriptionId} ${contactId}`}
        >
          {banner.cta.label}
          <span aria-hidden className="text-lg">
            →
          </span>
        </a>
      </div>
    </section>
  );
};

export default InvestorBannerSection;
