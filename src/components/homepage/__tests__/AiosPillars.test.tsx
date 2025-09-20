import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

import AiosPillarsSection from '../AiosPillarsSection';

import type { HomepagePillar } from '@content/homepage';

interface Frontmatter {
  pillars: HomepagePillar[];
}

async function loadHomepagePillars(): Promise<HomepagePillar[]> {
  const mdxPath = join(process.cwd(), 'src', 'content', 'homepage', 'landing.mdx');
  const raw = await readFile(mdxPath, 'utf8');
  const [, fm] = raw.split('---').map((segment) => segment.trim());
  const data = parse(fm) as Frontmatter;
  return data.pillars;
}

describe('AIOS pillars section', () => {
  it('renders one list item per pillar with descriptive alt text', async () => {
    const pillars = await loadHomepagePillars();

    render(
      <AiosPillarsSection
        heading="Test Pillars"
        description="Synthetic description for verification"
        pillars={pillars}
      />,
    );

    const list = screen.getByTestId('aios-pillars-list');
    const items = screen.getAllByRole('listitem');

    expect(list.tagName.toLowerCase()).toBe('ul');
    expect(items).toHaveLength(pillars.length);

    for (const pillar of pillars) {
      const icon = screen.getByAltText(`${pillar.label} icon`);
      expect(icon).toBeInstanceOf(HTMLImageElement);
    }
  });
});
