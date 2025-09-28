// eslint-disable-next-line import/no-unresolved -- Asset generated via npm run ensure:homepage-hero-media.
import heroBase from '../../assets/homepage/hero-base.png';

import type { Meta, Story } from '@ladle/react';

const meta: Meta = {
  title: 'Homepage/Hero Illustration',
};

export default meta;

export const HeroVisualSystem: Story = () => (
  <article className="token-story">
    <header>
      <h1 className="token-story__title">Homepage hero visual system</h1>
      <p className="token-story__lede">
        Production artwork rendered at <code>1440×960</code> with matching AVIF/WebP derivatives.
        Designers can rerun
        <code>python scripts/design/render-homepage-hero.py</code> before{' '}
        <code>npm run ensure:homepage-hero-media</code> to regenerate the PNG procedurally.
      </p>
    </header>

    <figure className="hero-visual">
      <img
        src={heroBase.src}
        width={heroBase.width}
        height={heroBase.height}
        alt="Illustrated Apotheon.ai command center dashboard with floating team nodes syncing real-time metrics"
      />
      <figcaption>
        Contrast-checked for white H1 copy and cyan CTA buttons. Light bloom stays below 35%
        luminance so foreground text remains AAA-compliant.
      </figcaption>
    </figure>

    <section className="details-explainer">
      <details open>
        <summary>Implementation notes</summary>
        <ul>
          <li>
            Base PNG lives in <code>src/assets/homepage/hero-base.png</code> and is mirrored in the
            manifest for preload + LCP prioritization.
          </li>
          <li>
            Regenerate derivatives with <code>npm run ensure:homepage-hero-media</code>—the script
            stores dimensions and SHA-256 checksums automatically.
          </li>
          <li>
            Update <code>src/content/homepage/landing.mdx</code> when the narrative focus changes so
            alt text and copy stay in sync.
          </li>
        </ul>
      </details>
    </section>
  </article>
);

Object.assign(HeroVisualSystem, { storyName: 'Hero media QA', meta: { width: 'full' } });
