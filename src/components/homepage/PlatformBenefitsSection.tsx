import React, { type FC } from 'react';

import type { HomepageBenefit } from '@content/homepage';

export interface PlatformBenefitsSectionProps {
  benefits: ReadonlyArray<HomepageBenefit>;
}

const PlatformBenefitsSection: FC<PlatformBenefitsSectionProps> = ({ benefits }) => {
  const headingId = React.useId();
  const descriptionId = React.useId();

  return (
    <section
      aria-labelledby={headingId}
      aria-describedby={descriptionId}
      className="space-y-8 rounded-3xl border border-slate-800/70 bg-slate-950/60 p-8 shadow-xl ring-1 ring-slate-900/60"
      data-analytics-region="homepage-platform-benefits"
    >
      <header className="max-w-3xl space-y-3">
        <h2 id={headingId} className="text-3xl font-semibold text-white md:text-4xl">
          Platform outcomes enterprise teams expect
        </h2>
        <p id={descriptionId} className="text-base text-slate-300 md:text-lg">
          Quantified signals from design partners keep the narrative grounded. Refresh quarterly
          with the latest RevOps benchmarks to maintain credibility through fundraising cycles.
        </p>
      </header>

      <ul className="grid gap-6 md:grid-cols-2 xl:grid-cols-4" data-analytics-block="benefit-cards">
        {benefits.map((benefit) => (
          <li
            key={benefit.title}
            className="group flex h-full min-h-[260px] flex-col justify-between gap-4 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 shadow-lg ring-1 ring-slate-800/70 transition hover:border-sky-500/50 hover:ring-sky-500/40"
            data-analytics-id={`homepage-benefit-${benefit.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
          >
            <div className="space-y-3">
              <h3 className="text-xl font-semibold text-white">{benefit.title}</h3>
              <p className="text-sm leading-relaxed text-slate-400 md:text-base">
                {benefit.proofPoint}
              </p>
            </div>
            <p
              className="text-2xl font-bold text-sky-300 md:text-3xl"
              aria-label={`Result: ${benefit.metric}`}
            >
              {benefit.metric}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default PlatformBenefitsSection;
