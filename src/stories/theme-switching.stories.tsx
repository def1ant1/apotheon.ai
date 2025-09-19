import { useEffect, useMemo, useState, type FC } from 'react';

import { getThemeAttribute, themeAttributes, type ThemeName } from '../styles/tokens';

import type { Meta, Story } from '@ladle/react';

const meta: Meta = {
  title: 'Foundations/Theme Switching',
};

export default meta;

const ThemePreview: FC<{ theme: ThemeName }> = ({ theme }) => {
  const attribute = useMemo(() => getThemeAttribute(theme), [theme]);

  return (
    <section className="token-story__nav-preview" {...attribute}>
      <h2>Preview</h2>
      <p>
        This panel is rendered with <code>data-theme="{theme}"</code>. The global decorator imports
        the shared CSS so the experience matches production exactly.
      </p>
      <div className="token-flex token-flex--grid" style={{ marginTop: 'var(--space-md)' }}>
        <article className="token-list__item">
          <h3>Surface base</h3>
          <p>
            Background: <code>var(--color-surface-base)</code>
          </p>
        </article>
        <article className="token-list__item">
          <h3>Surface overlay</h3>
          <p>
            Background: <code>var(--color-surface-overlay)</code>
          </p>
        </article>
        <article className="token-list__item">
          <h3>Ink primary</h3>
          <p>
            Text color: <code>var(--color-ink-primary)</code>
          </p>
        </article>
      </div>
    </section>
  );
};

export const InteractiveThemePlayground: Story = () => {
  const [theme, setTheme] = useState<ThemeName>('light');

  useEffect(() => {
    localStorage.setItem('ladle-theme-preference', theme);
  }, [theme]);

  useEffect(() => {
    const stored = localStorage.getItem('ladle-theme-preference');
    if (stored === 'light' || stored === 'dark') {
      setTheme(stored);
    }
  }, []);

  return (
    <article className="token-story">
      <header>
        <h1 className="token-story__title">Theme orchestration &amp; persistence</h1>
        <p className="token-story__lede">
          Use the controls below to flip between light and dark mode. The state sync mirrors the
          production islands: we persist the preference in <code>localStorage</code> and fall back
          to system defaults when no value exists.
        </p>
      </header>

      <div className="details-explainer">
        <details open>
          <summary>Implementation SOP</summary>
          <ol>
            <li>
              Call <code>getThemeAttribute</code> with the desired theme and spread the result onto
              the container element.
            </li>
            <li>
              Persist the user choice in a storage layer that survives navigation (localStorage or
              cookies for SSR islands).
            </li>
            <li>
              Always respect <code>prefers-color-scheme</code> when no explicit preference is
              stored. Enterprise rollouts should communicate defaults in release notes.
            </li>
          </ol>
        </details>
      </div>

      <fieldset className="theme-picker">
        <legend className="visually-hidden">Theme picker</legend>
        <div className="token-list token-list--inline">
          {Object.keys(themeAttributes).map((key) => {
            const value = key as ThemeName;
            const isActive = value === theme;
            return (
              <div key={value} className="token-list__item token-list__item--radius">
                <label style={{ display: 'grid', gap: 'var(--space-2xs)' }}>
                  <input
                    type="radio"
                    name="theme"
                    value={value}
                    checked={isActive}
                    onChange={() => setTheme(value)}
                  />
                  <span>{value.toUpperCase()}</span>
                </label>
              </div>
            );
          })}
        </div>
      </fieldset>

      <ThemePreview theme={theme} />
    </article>
  );
};
Object.assign(InteractiveThemePlayground, {
  storyName: 'Interactive theme playground',
  meta: { width: 'large' },
});

export const ThemeEmbeddingChecklist: Story = () => (
  <article className="token-story">
    <header>
      <h1 className="token-story__title">Embedding themed components in partner apps</h1>
      <p className="token-story__lede">
        Follow this checklist when exporting React widgets (e.g., analytics dashboards) to other
        business units. The guidance keeps our tokens authoritative even when consumed outside
        Astro.
      </p>
    </header>

    <section className="token-shadow">
      <div className="details-explainer" style={{ display: 'grid', gap: 'var(--space-sm)' }}>
        <h2>Checklist</h2>
        <ul>
          <li>
            Ship <code>global.css</code> alongside the component bundle or expose a CDN-hosted
            variant. Document the import path in partner repos.
          </li>
          <li>
            Wrap the exported widget in a provider that accepts <code>ThemeName</code>. Consumers
            can opt into hard overrides or inherit from the nearest <code>data-theme</code>{' '}
            ancestor.
          </li>
          <li>
            Run <code>npm run ladle:build</code> before publishing to ensure tokens resolve
            correctly inside the standalone bundle.
          </li>
          <li>
            Use <code>npm run ladle:ci</code> during release trains. The Puppeteer + axe routine
            catches regressions in both themes without manual QA.
          </li>
        </ul>
      </div>
    </section>
  </article>
);
Object.assign(ThemeEmbeddingChecklist, {
  storyName: 'Embedding checklist',
  meta: { width: 'large' },
});
