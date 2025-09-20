import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { test, expect, type Page, type Route } from '@playwright/test';
import { parse } from 'yaml';

interface HomepageHeroFrontmatter {
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
  heroMedia: {
    src: string;
    alt: string;
    preload: boolean;
  };
}

const homepageHeroFrontmatter = (() => {
  const mdxPath = join(process.cwd(), 'src', 'content', 'homepage', 'landing.mdx');
  const raw = readFileSync(mdxPath, 'utf8');
  const [, fm] = raw.split('---').map((segment) => segment.trim());
  return parse(fm) as HomepageHeroFrontmatter;
})();

const heroAssetFileName = homepageHeroFrontmatter.heroMedia.src;
if (!/^[a-z0-9-]+\.(png|jpg|jpeg|webp|avif)$/i.test(heroAssetFileName)) {
  throw new Error(`Unexpected hero asset filename: ${heroAssetFileName}`);
}
const heroAssetPath = join(process.cwd(), 'src', 'assets', 'homepage', heroAssetFileName);
// eslint-disable-next-line security/detect-non-literal-fs-filename -- Sanitized via regex guard above.
const heroImageBuffer = readFileSync(heroAssetPath);

test.describe('homepage hero', () => {
  test('renders CTAs, hero image, and preload hint', async ({ page }: { page: Page }) => {
    await page.route('**/_image**', async (route: Route) => {
      const url = new URL(route.request().url());
      const href = url.searchParams.get('href');
      if (!href) {
        return route.continue();
      }

      const format = url.searchParams.get('f');
      if (format && format !== 'png') {
        return route.continue();
      }

      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'image/png' },
        body: heroImageBuffer,
      });
    });

    await page.goto('/');

    const investorCta = page.getByRole('link', {
      name: homepageHeroFrontmatter.investorCta.ariaLabel,
    });
    const demoCta = page.getByRole('link', {
      name: homepageHeroFrontmatter.demoCta.ariaLabel,
    });

    await expect(investorCta).toBeVisible();
    await expect(demoCta).toBeVisible();

    const heroImage = page.locator(`img[alt="${homepageHeroFrontmatter.heroMedia.alt}"]`);
    await expect(heroImage).toBeVisible();
    await expect(heroImage).toHaveJSProperty('complete', true);
    const naturalWidth = await heroImage.evaluate((img: HTMLImageElement) => img.naturalWidth);
    expect(naturalWidth).toBeGreaterThan(0);

    const preloadLink = page.locator('link[rel="preload"][as="image"][type="image/avif"]');
    await expect(preloadLink).toHaveCount(homepageHeroFrontmatter.heroMedia.preload ? 1 : 0);
    if (homepageHeroFrontmatter.heroMedia.preload) {
      await expect(preloadLink).toHaveAttribute('imagesizes', /44vw|60vw/);
    }
  });
});
