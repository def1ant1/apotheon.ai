import * as NavigationMenu from '@radix-ui/react-navigation-menu';
import { Slot } from '@radix-ui/react-slot';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { forwardRef, useMemo, type ComponentPropsWithoutRef, type ElementRef } from 'react';

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
  label: string;
  href: string;
  description: string;
}

export interface NavigationMenuGroup {
  label: string;
  description: string;
  links: ReadonlyArray<NavigationMenuLink>;
}

export const navigationMenuGroups: ReadonlyArray<NavigationMenuGroup> = [
  {
    label: 'Platform',
    description: 'Deep dives into the Apotheon.ai operating system and its modular AI surfaces.',
    links: [
      {
        label: 'Clio Orchestration',
        href: '/solutions/clio',
        description: 'Systems thinking behind our cognitive orchestration layer.',
      },
      {
        label: 'Atlas Activation',
        href: '/solutions/atlas',
        description: 'Real-time data activation pipelines governed by policy-aware workflows.',
      },
      {
        label: 'Nova Workbench',
        href: '/solutions/nova',
        description: 'Secure experimentation playgrounds for shipping regulated AI features.',
      },
    ],
  },
  {
    label: 'Industries',
    description: 'Verticalized GTM journeys designed for regulated environments.',
    links: [
      {
        label: 'Healthcare',
        href: '/industries/healthcare',
        description: 'Augment clinical operations with AI guardrails and observability.',
      },
      {
        label: 'Financial Services',
        href: '/industries/financial-services',
        description: 'Accelerate underwriting decisions without compromising compliance.',
      },
      {
        label: 'Legal Services',
        href: '/industries/law',
        description: 'Modernize confidential matter delivery with privileged AI workflows.',
      },
      {
        label: 'Government Digital Services',
        href: '/industries/government',
        description: 'Rebuild constituent experiences with zero-trust automation and transparency.',
      },
      {
        label: 'Defense & Military',
        href: '/industries/military',
        description: 'Deploy IL5-ready mission systems with RMF automation and observability.',
      },
      {
        label: 'Intelligence',
        href: '/industries/intelligence',
        description: 'Fuse multi-source intelligence with ICD-aligned governance and automation.',
      },
      {
        label: 'Public Sector Missions',
        href: '/industries/public-sector',
        description: 'Deliver mission-ready intelligence workflows at the edge.',
      },
    ],
  },
  {
    label: 'Company',
    description: 'Strategic context, investor narrative, and trust signals.',
    links: [
      {
        label: 'About Apotheon.ai',
        href: '/about/company',
        description: 'Research pedigree, team structure, and governance disciplines.',
      },
      {
        label: 'Careers',
        href: '/about/careers',
        description: 'Hiring roadmaps and the interview experience for prospective teammates.',
      },
      {
        label: 'Whitepapers',
        href: '/about/white-papers',
        description: 'Download compliance-ready research and rollout playbooks.',
      },
      {
        label: 'Contact',
        href: '/about/contact',
        description: 'Edge-secured intake routing leads to the Cloudflare Worker API.',
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

  return (
    <NavigationMenu.Root
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
