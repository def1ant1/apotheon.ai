import React, { type FC } from 'react';

import type { HomepagePillar } from '@content/homepage';

const ICON_BASE_PATH = '/static/icons/brand';

export interface AiosPillarsSectionProps {
  heading: string;
  description?: string;
  pillars: ReadonlyArray<HomepagePillar>;
}

/**
 * React component renders purely static markup so Astro can SSR it without shipping hydration
 * payloads. We colocate layout comments with the JSX so Ladle stories and unit tests stay in sync
 * with production styling while avoiding manual DOM duplication.
 */
const AiosPillarsSection: FC<AiosPillarsSectionProps> = ({ heading, description, pillars }) => {
  const headingId = React.useId();

  return (
    <section
      id="aios-pillars"
      aria-labelledby={headingId}
      className="space-y-8 rounded-3xl border border-slate-800/70 bg-slate-950/60 p-8 shadow-xl ring-1 ring-slate-900/60"
      data-analytics-region="homepage-aios-pillars"
    >
      <header className="max-w-3xl space-y-3">
        <h2 id={headingId} className="text-3xl font-semibold text-white md:text-4xl">
          {heading}
        </h2>
        {description ? <p className="text-base text-slate-300 md:text-lg">{description}</p> : null}
      </header>

      {/*
        Grid uses auto-fit with responsive column counts to keep cards fluid without manual
        breakpoint overrides. Tailwind utilities map to design tokens defined in
        tailwind.config.mjs—`bg-slate-*` pulls from the neutral surface ramp while `text-sky-*`
        references the accent hue used elsewhere on the homepage hero.
      */}
      <ul className="grid gap-6 md:grid-cols-2 xl:grid-cols-4" data-testid="aios-pillars-list">
        {pillars.map((pillar, index) => {
          const iconHref = `${ICON_BASE_PATH}/${pillar.icon}.svg`;
          return (
            <li key={pillar.label} className="group" data-index={index}>
              <article
                className="flex h-full flex-col gap-4 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 shadow-lg ring-1 ring-slate-800/70 transition focus-within:ring-sky-500/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-400"
                /*
                  Cards intentionally opt into keyboard focus so users relying on tab navigation can
                  pause on each value prop. We disable the lint guard locally because the pill does
                  not trigger JS behavior—it simply surfaces copy for screen reader review.
                */
                // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
                tabIndex={0}
                data-card="pillar"
                aria-label={`${pillar.label}: ${pillar.tagline}`}
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-12 w-12 flex-none items-center justify-center rounded-full bg-sky-500/10">
                    <img
                      src={iconHref}
                      width={48}
                      height={48}
                      loading="lazy"
                      decoding="async"
                      alt={`${pillar.label} icon`}
                      className="h-8 w-8"
                    />
                  </span>
                  <div>
                    <h3 className="text-xl font-semibold text-white">{pillar.label}</h3>
                    <p className="text-sm text-slate-300">{pillar.tagline}</p>
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-slate-400 md:text-base">
                  {pillar.longForm}
                </p>
              </article>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default AiosPillarsSection;
