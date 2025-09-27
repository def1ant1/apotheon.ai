import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

interface Frontmatter {
  eyebrow: string;
  headline: string;
  investorCta: {
    label: string;
    href: string;
    ariaLabel: string;
  };
  demoCta: {
    label: string;
    href: string;
    ariaLabel: string;
  };
  supportingBullets: Array<{
    icon: string;
    title: string;
    description: string;
  }>;
  heroMedia: {
    src: string;
    alt: string;
    width: number;
    height: number;
    preload: boolean;
  };
}

async function loadHomepageHeroFrontmatter(): Promise<Frontmatter> {
  const mdxPath = join(process.cwd(), 'src', 'content', 'homepage', 'landing.mdx');
  const raw = await readFile(mdxPath, 'utf8');
  const [, fm] = raw.split('---').map((segment) => segment.trim());
  return parse(fm) as Frontmatter;
}

describe('Homepage hero content contract', () => {
  it('exposes accessible CTAs for investors and demos', async () => {
    const hero = await loadHomepageHeroFrontmatter();

    expect(hero.investorCta).toMatchObject({
      label: expect.stringMatching(/investor/i),
      href: expect.stringContaining('/about/white-papers/?whitepaperSlug=apotheon-investor-brief'),
      ariaLabel: expect.stringMatching(/investor/i),
    });
    expect(hero.demoCta).toMatchObject({
      label: expect.stringMatching(/demo/i),
      href: expect.stringContaining('/'),
      ariaLabel: expect.stringMatching(/demo/i),
    });
  });

  it('defines hero media metadata for the image pipeline', async () => {
    const hero = await loadHomepageHeroFrontmatter();

    expect(hero.heroMedia).toMatchObject({
      src: expect.stringMatching(/hero-base\.png$/),
      alt: expect.stringContaining('Apotheon.ai'),
      width: expect.any(Number),
      height: expect.any(Number),
      preload: true,
    });
  });
});
