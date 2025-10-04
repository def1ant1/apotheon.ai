import React, { type FC } from 'react';

import { formatContactReachability, injectOperationalHoursCopy } from './ctaContactNote';

import type { HomepageResearchBanner } from '@content/homepage';

export interface ResearchBannerSectionProps {
  banner: HomepageResearchBanner;
}

const ResearchBannerSection: FC<ResearchBannerSectionProps> = ({ banner }) => {
  const descriptionId = React.useId();
  const contactId = React.useId();
  const headingId = React.useId();
  const secondaryCopy = injectOperationalHoursCopy(banner.secondaryText);
  const contactNote = formatContactReachability('Research partnerships');

  return (
    <section
      aria-labelledby={headingId}
      aria-describedby={`${descriptionId} ${contactId}`}
      className="overflow-hidden rounded-3xl border border-emerald-500/60 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8 shadow-xl ring-1 ring-emerald-500/20"
      data-analytics-region="homepage-research-banner"
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
            <p className="text-sm text-emerald-300/80 md:text-base">{secondaryCopy}</p>
          ) : null}
        </header>

        <p id={contactId} className="sr-only">
          {contactNote}
        </p>

        <a
          className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-400/70 bg-emerald-400 px-6 py-3 text-sm font-semibold tracking-wide text-slate-950 uppercase transition hover:bg-emerald-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200"
          data-analytics-id="homepage-research-banner-cta"
          data-testid="research-banner-cta"
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

export default ResearchBannerSection;
