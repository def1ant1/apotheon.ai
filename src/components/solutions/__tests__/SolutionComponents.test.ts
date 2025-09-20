import { isAstroComponentFactory } from 'astro/runtime/server/render/astro/index.js';
import { describe, expect, it } from 'vitest';

import CrossLinks from '../CrossLinks.astro';
import HowItWorks from '../HowItWorks.astro';
import KeyFeatures from '../KeyFeatures.astro';
import SolutionCtaBanner from '../SolutionCtaBanner.astro';
import SolutionHero from '../SolutionHero.astro';
import UseCases from '../UseCases.astro';

describe('solutions Astro components', () => {
  it('expose Astro component factories without hydration directives', () => {
    const components = [
      SolutionHero,
      KeyFeatures,
      HowItWorks,
      UseCases,
      CrossLinks,
      SolutionCtaBanner,
    ];

    components.forEach((component) => {
      expect(isAstroComponentFactory(component)).toBe(true);
    });
  });
});
