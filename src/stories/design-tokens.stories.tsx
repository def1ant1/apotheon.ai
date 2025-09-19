import {
  colorTokens,
  spacingTokens,
  typographyTokens,
  radiusTokens,
  shadowTokens,
} from '../styles/tokens';

import type { Meta, Story } from '@ladle/react';

const meta: Meta = {
  title: 'Foundations/Design Tokens',
};

export default meta;

const tokenList = Object.entries(colorTokens).flatMap(([group, values]) =>
  Object.entries(values).map(([token, cssVariable]) => ({
    id: `${group}.${token}`,
    cssVariable,
  })),
);

const ColorSwatch = ({ cssVariable }: { cssVariable: string }) => (
  <span
    aria-hidden
    style={{
      display: 'inline-block',
      width: '3rem',
      height: '3rem',
      borderRadius: 'var(--radius-md)',
      background: `hsl(${cssVariable})`,
      boxShadow: 'var(--shadow-elevation-2)',
    }}
  />
);

export const ColorAtlas: Story = () => (
  <article className="token-story">
    <header>
      <h1 className="token-story__title">Color tokens → CSS variable contract</h1>
      <p className="token-story__lede">
        Every swatch is sourced from <code>src/styles/tokens.css</code> and surfaced here via the
        typed helpers in <code>tokens.ts</code>. Copywriting teams should link to this story from
        briefs when requesting new brand colors so engineering can estimate the full token impact.
      </p>
    </header>

    <details open>
      <summary>Rollout notes for enterprise adopters</summary>
      <ul>
        <li>
          The data structure powering this story mirrors the production navigation menu. Adjusting
          copy in <code>tokens.ts</code> keeps Radix islands, Tailwind utilities, and docs perfectly
          aligned—no one-off hex values.
        </li>
        <li>
          When adding a color token ensure the name follows the <code>group.intent</code>{' '}
          convention. This keeps the visual regression script aware of semantic intent (surface vs.
          accent).
        </li>
        <li>
          Accessibility gates: the automated <code>npm run ladle:ci</code> command injects axe-core
          against each story. If a new color pairing violates WCAG 2.2 AA the pipeline fails before
          the change merges.
        </li>
      </ul>
    </details>

    <section className="token-grid">
      {tokenList.map(({ id, cssVariable }) => (
        <div key={id} className="token-grid__item">
          <ColorSwatch cssVariable={cssVariable} />
          <dl>
            <dt>Token</dt>
            <dd>
              <code>{id}</code>
            </dd>
            <dt>CSS Variable</dt>
            <dd>
              <code>{cssVariable}</code>
            </dd>
          </dl>
        </div>
      ))}
    </section>
  </article>
);
ColorAtlas.storyName = 'Color atlas (light & dark ready)';
ColorAtlas.meta = { width: 'large' };

const spacingList = Object.entries(spacingTokens);
const radiusList = Object.entries(radiusTokens);
const shadowList = Object.entries(shadowTokens);

export const SpatialScale: Story = () => (
  <article className="token-story">
    <header>
      <h1 className="token-story__title">Spacing, radii, and elevation map</h1>
      <p className="token-story__lede">
        Layout rhythm translates one-to-one between Tailwind utilities and CSS custom properties.
        Designers can preview responsive stacks here before handing specs to engineering. The
        automation script in <code>scripts/ci/ladle-ci.mjs</code> asserts that every token renders
        to prevent regressions where a value is removed from <code>tokens.css</code> but still
        referenced in Tailwind.
      </p>
    </header>

    <section className="token-flex token-flex--grid">
      <div>
        <h2>Spacing</h2>
        <p>
          Each row previews the inline size, block size, and shorthand guidance. Use these scales
          for grid gutters, card padding, and responsive gaps.
        </p>
        <ul className="token-list">
          {spacingList.map(([token, cssVariable]) => (
            <li key={token} className="token-list__item">
              <span className="token-list__label">{token}</span>
              <span className="token-list__preview" style={{ width: cssVariable }} />
              <code>{cssVariable}</code>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2>Corner radii</h2>
        <p>
          Radii lock to brand primitives. When experimenting with new elevation treatments, change
          the tokens—not hard-coded pixels—to keep parity across marketing, dashboard, and worker
          portals.
        </p>
        <ul className="token-list token-list--inline">
          {radiusList.map(([token, cssVariable]) => (
            <li key={token} className="token-list__item token-list__item--radius">
              <span className="token-list__label">{token}</span>
              <span className="token-list__radius" style={{ borderRadius: cssVariable }} />
              <code>{cssVariable}</code>
            </li>
          ))}
        </ul>
      </div>
    </section>

    <section className="token-shadow">
      <h2>Elevation</h2>
      <p>
        Our component pipeline prefers semantic naming (<code>elevation1</code>) over pixel offsets.
        This keeps CSS custom properties human-readable and simplifies migrating to a design token
        registry (e.g., Figma Tokens, Specify) later.
      </p>
      <div className="token-shadow__grid">
        {shadowList.map(([token, cssVariable]) => (
          <figure key={token} className="token-shadow__item" style={{ boxShadow: cssVariable }}>
            <figcaption>
              <strong>{token}</strong>
              <code>{cssVariable}</code>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  </article>
);
SpatialScale.storyName = 'Spatial scale + elevation';
SpatialScale.meta = { width: 'large' };

const typographyList = Object.entries(typographyTokens);

export const TypographyRamp: Story = () => (
  <article className="token-story">
    <header>
      <h1 className="token-story__title">Typography ramp & implementation tips</h1>
      <p className="token-story__lede">
        Type ramps power marketing pages, dashboards, and long-form content alike. The preview below
        renders every token with notes on where to use it and which Tailwind utility maps to the
        variable. Embed this story into onboarding docs for new agencies or contractors.
      </p>
    </header>

    <section className="token-typography">
      {typographyList.map(([token, config]) => (
        <article key={token} className="token-typography__row">
          <header>
            <h2>{token}</h2>
            <p>
              Size: <code>{config.size}</code> · Line Height: <code>{config.lineHeight}</code> ·
              Letter Spacing: <code>{config.letterSpacing}</code>
            </p>
          </header>
          <p
            className="token-typography__specimen"
            style={{
              fontSize: `var(${config.size.replace('var(', '').replace(')', '')})`,
              lineHeight: `var(${config.lineHeight.replace('var(', '').replace(')', '')})`,
              letterSpacing: `var(${config.letterSpacing.replace('var(', '').replace(')', '')})`,
            }}
          >
            Apotheon orchestrates resilient AI ecosystems that respect air-gapped operations.
          </p>
          <aside>
            <h3>Implementation checklist</h3>
            <ul>
              <li>
                Confirm the token maps to a Tailwind utility via <code>tailwind.config.mjs</code>.
              </li>
              <li>
                Prefer semantic components (e.g., <code>&lt;h2&gt;</code> wrappers) over raw utility
                soup. This keeps screen-reader hierarchies intact.
              </li>
              <li>
                When embedding in Markdown/MDX, rely on remark plugins to inject these classes so
                editors never touch HTML.
              </li>
            </ul>
          </aside>
        </article>
      ))}
    </section>
  </article>
);
TypographyRamp.storyName = 'Typography ramp';
TypographyRamp.meta = { width: 'large' };
