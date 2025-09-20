import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { render, screen, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

import ProductModulesSection from '../ProductModulesSection';

import type { HomepageModule } from '@content/homepage';

interface Frontmatter {
  modules: HomepageModule[];
}

async function loadHomepageModules(): Promise<HomepageModule[]> {
  const mdxPath = join(process.cwd(), 'src', 'content', 'homepage', 'landing.mdx');
  const raw = await readFile(mdxPath, 'utf8');
  const [, fm] = raw.split('---').map((segment) => segment.trim());
  const data = parse(fm) as Frontmatter;
  return data.modules;
}

describe('Product modules section', () => {
  it('renders anchored cards with matching href targets', async () => {
    const modules = await loadHomepageModules();

    render(
      <ProductModulesSection
        heading="Test Modules"
        description="Synthetic description for verification"
        modules={modules}
      />,
    );

    const list = screen.getByTestId('product-modules-list');
    const items = within(list).getAllByRole('link');

    expect(list.tagName.toLowerCase()).toBe('ul');
    expect(items).toHaveLength(modules.length);

    modules.forEach((module, index) => {
      const icon = screen.getByAltText(`${module.name} icon`);
      expect(icon).toBeInstanceOf(HTMLImageElement);
      expect(items[index].getAttribute('href')).toBe(module.href);
    });
  });
});
