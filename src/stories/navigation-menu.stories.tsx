import RadixNavigationMenu, {
  navigationMenuGroups,
} from '../components/islands/RadixNavigationMenu';

import type { Meta, Story } from '@ladle/react';

const meta: Meta = {
  title: 'Components/Navigation/Radix Navigation Menu',
};

export default meta;

export const PrimaryNavigation: Story = () => (
  <article className="token-story">
    <header>
      <h1 className="token-story__title">Radix-powered enterprise navigation</h1>
      <p className="token-story__lede">
        The production navigation shell renders below exactly as it appears in{' '}
        <code>src/pages/index.astro</code>. Radix primitives provide focus management, keyboard
        interaction, and ARIA wiring without bespoke scripts. Use this story to validate copy
        changes with stakeholders before touching templates.
      </p>
    </header>

    <div className="details-explainer">
      <details open>
        <summary>Implementation guide</summary>
        <ul>
          <li>
            Data lives in <code>navigationMenuGroups</code>. Updating the array propagates to the
            Astro island and this Ladle story simultaneously, ensuring docs stay honest.
          </li>
          <li>
            Docs, Security Runbooks, and Brand Kit groups reference the handbook and asset pages
            introduced in issue #3—review them here before rolling the IA to production.
          </li>
          <li>
            Accessibility toggles (e.g., <kbd>Tab</kbd>, arrow keys) come from Radix. When QA signs
            off here the production build inherits the same behavior.
          </li>
          <li>
            Tailwind utility classes use semantic tokens (<code>bg-surface-raised</code>,{' '}
            <code>text-ink-secondary</code>) so light/dark parity is automatic.
          </li>
        </ul>
      </details>
    </div>

    <RadixNavigationMenu />
  </article>
);
Object.assign(PrimaryNavigation, {
  storyName: 'Primary navigation shell',
  meta: { width: 'large' },
});

export const InformationArchitectureBlueprint: Story = () => (
  <article className="token-story">
    <header>
      <h1 className="token-story__title">Navigation data blueprint</h1>
      <p className="token-story__lede">
        Enterprise teams often ask for a JSON schema describing the IA. This view renders the exact
        data structure consumed by the Radix component so product teams can diff changes in pull
        requests and route analytics accordingly.
      </p>
    </header>

    <section className="token-list">
      {navigationMenuGroups.map((group) => (
        <div key={group.label} className="token-list__item">
          <h2>{group.label}</h2>
          <p>{group.description}</p>
          <ul>
            {group.links.map((link) => (
              <li key={link.href}>
                <code>{link.href}</code> — {link.label}
                <br />
                <small>{link.description}</small>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>

    <section className="details-explainer">
      <h2>Rollout checklist</h2>
      <ol>
        <li>
          Update analytics tagging if any <code>href</code> changes.
        </li>
        <li>Coordinate with content design to maintain voice consistency across surfaces.</li>
        <li>
          Run <code>npm run ladle:ci</code> to capture accessibility regressions before merge.
        </li>
      </ol>
    </section>
  </article>
);
Object.assign(InformationArchitectureBlueprint, {
  storyName: 'IA data blueprint',
  meta: { width: 'large' },
});

const inlineMenuExample = navigationMenuGroups.map((group) => ({
  ...group,
  links: group.links.map((link) => ({
    ...link,
    href: `https://example.com${link.href}`,
  })),
}));

export const ExternalizedDataFeed: Story = () => (
  <article className="token-story">
    <header>
      <h1 className="token-story__title">Integrating remote IA feeds</h1>
      <p className="token-story__lede">
        Demonstrates how platform teams can hydrate the navigation menu from a CMS or API. Swap the{' '}
        <code>navigationMenuGroups</code>
        constant with a remote fetch (see notes below) to avoid redeploying the Astro site for
        editorial tweaks.
      </p>
    </header>

    <div className="details-explainer">
      <details open>
        <summary>Recommended pattern</summary>
        <p>
          Use a Worker or Edge Function to sanitize the upstream feed and cache the payload. In the
          React island, replace the hard-coded constant with a SWR hook that falls back to{' '}
          <code>navigationMenuGroups</code> when offline. Document the API contract here so partner
          teams can integrate without spelunking the repo.
        </p>
      </details>
    </div>

    <nav className="token-story__nav-preview">
      <ul>
        {inlineMenuExample.map((group) => (
          <li key={group.label}>
            <strong>{group.label}</strong>
            <ul>
              {group.links.map((link) => (
                <li key={link.href}>
                  <a href={link.href} rel="noreferrer">
                    {link.label}
                  </a>
                  <p>{link.description}</p>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </nav>
  </article>
);
Object.assign(ExternalizedDataFeed, {
  storyName: 'External IA feed (pseudo-code)',
  meta: { width: 'large' },
});
