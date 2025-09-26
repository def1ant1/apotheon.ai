import * as NavigationMenu from '@radix-ui/react-navigation-menu';
import { Slot } from '@radix-ui/react-slot';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import React, { forwardRef, useMemo, type ComponentPropsWithoutRef, type ElementRef } from 'react';

/**
 * `RadixNavigationMenu` composes Radix primitives into an accessible primary navigation shell.
 *
 * Why Radix here?
 * - It gives us a fully managed focus model, keyboard handling, and ARIA wiring without shipping
 *   bespoke dropdown logic.
 * - The primitives degrade gracefully to semantic HTML, which means that even if JavaScript fails
 *   to hydrate the island the links remain reachable.
 * - Copious inline notes explain the integration so future teams can replicate the pattern without
 *   reverse engineering component internals.
 */
/**
 * Central navigation data is exported for Ladle stories and downstream products (e.g., SaaS
 * consoles) so they can stay aligned without copy/pasting array literals. Treat it as the single
 * source of truth for top-level IA buckets.
 */
export interface NavigationMenuLink {
  readonly id?: string;
  readonly label: string;
  readonly labelKey?: string;
  readonly href: string;
  readonly description: string;
  readonly descriptionKey?: string;
}

export interface NavigationMenuGroup {
  readonly id?: string;
  readonly label: string;
  readonly labelKey?: string;
  readonly description: string;
  readonly descriptionKey?: string;
  readonly links: ReadonlyArray<NavigationMenuLink>;
}

export const navigationMenuGroups: ReadonlyArray<NavigationMenuGroup> = [
  {
    id: 'platform',
    label: 'Platform',
    labelKey: 'navigation.groups.platform.label',
    description: 'Deep dives into the Apotheon.ai operating system and its modular AI surfaces.',
    descriptionKey: 'navigation.groups.platform.description',
    links: [
      {
        id: 'clio',
        label: 'Clio Orchestration',
        labelKey: 'navigation.groups.platform.links.clio.label',
        href: '/solutions/clio',
        description: 'Systems thinking behind our cognitive orchestration layer.',
        descriptionKey: 'navigation.groups.platform.links.clio.description',
      },
      {
        id: 'atlas',
        label: 'Atlas Activation',
        labelKey: 'navigation.groups.platform.links.atlas.label',
        href: '/solutions/atlas',
        description: 'Real-time data activation pipelines governed by policy-aware workflows.',
        descriptionKey: 'navigation.groups.platform.links.atlas.description',
      },
      {
        id: 'nova',
        label: 'Nova Workbench',
        labelKey: 'navigation.groups.platform.links.nova.label',
        href: '/solutions/nova',
        description: 'Secure experimentation playgrounds for shipping regulated AI features.',
        descriptionKey: 'navigation.groups.platform.links.nova.description',
      },
    ],
  },
  {
    id: 'industries',
    label: 'Industries',
    labelKey: 'navigation.groups.industries.label',
    description: 'Verticalized GTM journeys designed for regulated environments.',
    descriptionKey: 'navigation.groups.industries.description',
    links: [
      {
        id: 'healthcare',
        label: 'Healthcare',
        labelKey: 'navigation.groups.industries.links.healthcare.label',
        href: '/industries/healthcare',
        description: 'Augment clinical operations with AI guardrails and observability.',
        descriptionKey: 'navigation.groups.industries.links.healthcare.description',
      },
      {
        id: 'financial-services',
        label: 'Financial Services',
        labelKey: 'navigation.groups.industries.links.financialServices.label',
        href: '/industries/financial-services',
        description: 'Accelerate underwriting decisions without compromising compliance.',
        descriptionKey: 'navigation.groups.industries.links.financialServices.description',
      },
      {
        id: 'law',
        label: 'Legal Services',
        labelKey: 'navigation.groups.industries.links.legal.label',
        href: '/industries/law',
        description: 'Modernize confidential matter delivery with privileged AI workflows.',
        descriptionKey: 'navigation.groups.industries.links.legal.description',
      },
      {
        id: 'government',
        label: 'Government Digital Services',
        labelKey: 'navigation.groups.industries.links.government.label',
        href: '/industries/government',
        description: 'Rebuild constituent experiences with zero-trust automation and transparency.',
        descriptionKey: 'navigation.groups.industries.links.government.description',
      },
      {
        id: 'military',
        label: 'Defense & Military',
        labelKey: 'navigation.groups.industries.links.military.label',
        href: '/industries/military',
        description: 'Deploy IL5-ready mission systems with RMF automation and observability.',
        descriptionKey: 'navigation.groups.industries.links.military.description',
      },
      {
        id: 'intelligence',
        label: 'Intelligence',
        labelKey: 'navigation.groups.industries.links.intelligence.label',
        href: '/industries/intelligence',
        description: 'Fuse multi-source intelligence with ICD-aligned governance and automation.',
        descriptionKey: 'navigation.groups.industries.links.intelligence.description',
      },
      {
        id: 'public-sector',
        label: 'Public Sector Missions',
        labelKey: 'navigation.groups.industries.links.publicSector.label',
        href: '/industries/public-sector',
        description: 'Deliver mission-ready intelligence workflows at the edge.',
        descriptionKey: 'navigation.groups.industries.links.publicSector.description',
      },
    ],
  },
  {
    id: 'company',
    label: 'Company',
    labelKey: 'navigation.groups.company.label',
    description: 'Strategic context, investor narrative, and trust signals.',
    descriptionKey: 'navigation.groups.company.description',
    links: [
      {
        id: 'about',
        label: 'About Apotheon.ai',
        labelKey: 'navigation.groups.company.links.about.label',
        href: '/about/company',
        description: 'Research pedigree, team structure, and governance disciplines.',
        descriptionKey: 'navigation.groups.company.links.about.description',
      },
      {
        id: 'careers',
        label: 'Careers',
        labelKey: 'navigation.groups.company.links.careers.label',
        href: '/about/careers',
        description: 'Hiring roadmaps and the interview experience for prospective teammates.',
        descriptionKey: 'navigation.groups.company.links.careers.description',
      },
      {
        id: 'whitepapers',
        label: 'Whitepapers',
        labelKey: 'navigation.groups.company.links.whitepapers.label',
        href: '/about/white-papers',
        description: 'Download compliance-ready research and rollout playbooks.',
        descriptionKey: 'navigation.groups.company.links.whitepapers.description',
      },
      {
        id: 'history',
        label: 'History & Milestones',
        labelKey: 'navigation.groups.company.links.history.label',
        href: '/about/history',
        description: 'Audit the evidence-backed company timeline and sourcing discipline.',
        descriptionKey: 'navigation.groups.company.links.history.description',
      },
      {
        id: 'contact',
        label: 'Contact',
        labelKey: 'navigation.groups.company.links.contact.label',
        href: '/about/contact',
        description: 'Edge-secured intake routing leads to the Cloudflare Worker API.',
        descriptionKey: 'navigation.groups.company.links.contact.description',
      },
    ],
  },
];

export interface RadixNavigationMenuProps {
  /**
   * Optional override that lets Astro surfaces validate or filter navigation data before hydrating
   * the island. Keeping the prop read-only discourages mutation and ensures memoization remains
   * stable even when parents re-render.
   */
  readonly groups?: ReadonlyArray<NavigationMenuGroup>;
  /**
   * Consumers may merge bespoke layout utilities (e.g., flex direction on sticky headers) without
   * repeating the base `navigation-surface` class baked into the global stylesheet.
   */
  readonly className?: string;
}

export function RadixNavigationMenu({
  groups = navigationMenuGroups,
  className,
}: RadixNavigationMenuProps = {}) {
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  /**
   * Define navigation content as data first. This keeps the JSX lean and allows us to
   * generate both the trigger labels and panel content from a single source of truth.
   * Doing so avoids manual duplication whenever sections or routes evolve.
   */
  const menuGroups = useMemo(() => groups, [groups]);

  const rootClassName = useMemo(
    () =>
      ['navigation-surface', className]
        .filter((value): value is string => Boolean(value && value.trim().length > 0))
        .join(' '),
    [className],
  );

  React.useEffect(() => {
    const node = rootRef.current;
    if (!node) {
      return undefined;
    }

    node.setAttribute('data-navigation-ready', 'true');
    return () => {
      node.setAttribute('data-navigation-ready', 'false');
    };
  }, []);

  return (
    <NavigationMenu.Root
      ref={rootRef}
      data-navigation-ready="false"
      /**
       * `aria-label` announces intent to screen readers while Radix handles the menu roles.
       * Tailwind tokens reference centralized design scales so we never hand-roll pixel values.
       */
      aria-label="Primary"
      className={rootClassName}
    >
      <VisuallyHidden>
        {/*
         * Hidden descriptive text improves context for assistive tech without affecting layout.
         * We annotate the Radix viewport so that screen reader users know to expect fly-out panels.
         */}
        <span>Global sections with fly-out detail panels</span>
      </VisuallyHidden>

      <NavigationMenu.List className="navigation-list" style={{ gap: 'var(--space-lg)' }}>
        {menuGroups.map((group) => (
          <NavigationMenu.Item key={group.label}>
            <NavigationMenu.Trigger
              className="navigation-trigger group"
              style={{ minHeight: '3rem', paddingInline: 'var(--space-lg)' }}
            >
              {group.label}
              <span aria-hidden className="navigation-trigger__chevron">
                ▾
              </span>
            </NavigationMenu.Trigger>

            <NavigationMenu.Content className="navigation-content">
              <p className="navigation-content__description">{group.description}</p>

              <ul className="navigation-grid">
                {group.links.map((link) => (
                  <li key={link.label} className="navigation-grid__item">
                    <NavigationMenuLink href={link.href}>
                      <h3 className="navigation-grid__heading">{link.label}</h3>
                      <p className="navigation-grid__copy">{link.description}</p>
                    </NavigationMenuLink>
                  </li>
                ))}
              </ul>
            </NavigationMenu.Content>
          </NavigationMenu.Item>
        ))}
      </NavigationMenu.List>

      {/*
       * Indicator + Viewport are opt-in Radix primitives. They preserve focus outlines when the
       * menu animates in/out and provide a11y-friendly transitions without extra JavaScript.
       */}
      <NavigationMenu.Indicator className="navigation-indicator">
        <div className="navigation-indicator__arrow" />
      </NavigationMenu.Indicator>
      <NavigationMenu.Viewport className="navigation-viewport" />
    </NavigationMenu.Root>
  );
}

/**
 * Shared anchor element using Radix's Slot primitive so we can style consistent link shells while
 * retaining native anchor semantics and prefetch behaviour provided by Astro/React routers later.
 */
const NavigationMenuLink = forwardRef<
  ElementRef<typeof NavigationMenu.Link>,
  ComponentPropsWithoutRef<typeof NavigationMenu.Link> & { href: string }
>(function NavigationMenuLink({ children, href, ...props }, forwardedRef) {
  return (
    <NavigationMenu.Link asChild {...props}>
      <Slot>
        <a ref={forwardedRef} href={href} className="navigation-link">
          {children}
        </a>
      </Slot>
    </NavigationMenu.Link>
  );
});

NavigationMenuLink.displayName = 'NavigationMenuLink';

export default RadixNavigationMenu;
