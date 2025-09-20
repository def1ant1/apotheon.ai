import React, { type FC } from 'react';

import type { HomepageModule } from '@content/homepage';

const ICON_BASE_PATH = '/static/icons/brand';

export interface ProductModulesSectionProps {
  heading: string;
  description?: string;
  modules: ReadonlyArray<HomepageModule>;
}

const ProductModulesSection: FC<ProductModulesSectionProps> = ({
  heading,
  description,
  modules,
}) => {
  const headingId = React.useId();

  return (
    <section
      id="product-modules"
      aria-labelledby={headingId}
      className="space-y-8 rounded-3xl border border-slate-800/70 bg-slate-950/60 p-8 shadow-xl ring-1 ring-slate-900/60"
      data-analytics-region="homepage-product-modules"
    >
      <header className="max-w-3xl space-y-3">
        <h2 id={headingId} className="text-3xl font-semibold text-white md:text-4xl">
          {heading}
        </h2>
        {description ? <p className="text-base text-slate-300 md:text-lg">{description}</p> : null}
      </header>

      {/*
        Modules render as anchors so keyboard users can traverse the grid naturally with Tab. We
        lean on Tailwind gap utilities for consistent spacing across breakpoints while letting the
        grid auto-flow between two and three columns depending on available width.
      */}
      <ul className="grid gap-6 md:grid-cols-2 xl:grid-cols-3" data-testid="product-modules-list">
        {modules.map((module, index) => {
          const iconHref = `${ICON_BASE_PATH}/${module.icon}.svg`;
          return (
            <li key={module.name} className="group" data-index={index}>
              <a
                className="flex h-full flex-col gap-4 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 shadow-lg ring-1 ring-slate-800/70 transition hover:border-sky-500/50 hover:ring-sky-500/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-400"
                href={module.href}
                data-card="module"
                aria-label={`${module.name}: ${module.summary}`}
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-12 w-12 flex-none items-center justify-center rounded-full bg-sky-500/10">
                    <img
                      src={iconHref}
                      width={48}
                      height={48}
                      loading="lazy"
                      decoding="async"
                      alt={`${module.name} icon`}
                      className="h-8 w-8"
                    />
                  </span>
                  <div>
                    <h3 className="text-xl font-semibold text-white">{module.name}</h3>
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-slate-400 md:text-base">
                  {module.summary}
                </p>
                <span className="mt-auto inline-flex items-center gap-2 text-sm font-semibold text-sky-300">
                  Explore module
                  <span aria-hidden className="text-lg">
                    →
                  </span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default ProductModulesSection;
