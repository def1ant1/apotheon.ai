import { isAstroComponentFactory } from 'astro/runtime/server/render/astro/index.js';
import { describe, expect, it } from 'vitest';

import MilestoneCard from '../MilestoneCard.astro';
import Timeline from '../Timeline.astro';

describe('history timeline components', () => {
  it('expose Astro component factories for server-first rendering', () => {
    const components = [Timeline, MilestoneCard];

    components.forEach((component) => {
      expect(isAstroComponentFactory(component)).toBe(true);
    });
  });
});
