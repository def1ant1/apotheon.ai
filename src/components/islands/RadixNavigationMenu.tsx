import * as NavigationMenu from '@radix-ui/react-navigation-menu';
import { Slot } from '@radix-ui/react-slot';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import React, {
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  type ComponentPropsWithoutRef,
  type ElementRef,
} from 'react';

import PrefetchController from './PrefetchController';
import { PREFETCH_ATTRIBUTE_PAYLOAD } from '../../utils/navigation/prefetch-constants';

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
        /**
         * BWCCUM sits ahead of Themis + Mnemosyne in the control mesh sequence, so we surface it
         * directly in global navigation. Keeping the slug aligned with /solutions/bwccum ensures the
         * sitemap generator, Pagefind indexer, and nav validator remain in sync.
         */
        id: 'bwccum',
        label: 'BWC-CUM Control Mesh',
        labelKey: 'navigation.groups.platform.links.bwccum.label',
        href: '/solutions/bwccum',
        description:
          'Autonomous control mesh that propagates policies and evidence across every lane.',
        descriptionKey: 'navigation.groups.platform.links.bwccum.description',
      },
      {
        /**
         * Automation guard: keep Mnemosyne copy in sync with the activation pillar slug so pagefind seeds
         * and sitemap automation stay deterministic.
         */
        id: 'mnemosyne',
        label: 'Mnemosyne Activation',
        labelKey: 'navigation.groups.platform.links.mnemosyne.label',
        href: '/solutions/mnemosyne',
        description: 'Real-time data activation pipelines governed by policy-aware workflows.',
        descriptionKey: 'navigation.groups.platform.links.mnemosyne.description',
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
        // 2024 IA requirement: keep the finance slug aligned with /industries/finance.
        id: 'finance',
        label: 'Financial Services',
        labelKey: 'navigation.groups.industries.links.financialServices.label',
        href: '/industries/finance',
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
    /**
     * Documentation surface links are curated to the living handbook that landed in issue #3.
     * Keeping the IA, architectural ledger, and overview adjacent here gives every team a
     * deterministic jumping-off point when onboarding or auditing product decisions.
     */
    id: 'docs',
    label: 'Docs',
    labelKey: 'navigation.groups.docs.label',
    description:
      'Operational handbook, architecture decisions, and IA references that ship with every release.',
    descriptionKey: 'navigation.groups.docs.description',
    links: [
      {
        id: 'handbook-overview',
        label: 'Handbook overview',
        labelKey: 'navigation.groups.docs.links.handbookOverview.label',
        href: '/docs/',
        description: 'Entry point into the curated handbook surfaced in issue #3.',
        descriptionKey: 'navigation.groups.docs.links.handbookOverview.description',
      },
      {
        id: 'architecture-ledger',
        label: 'Architecture decision ledger',
        labelKey: 'navigation.groups.docs.links.architectureLedger.label',
        href: '/docs/architecture/decisions',
        description: 'Traceability matrix for platform decisions and long-term tradeoffs.',
        descriptionKey: 'navigation.groups.docs.links.architectureLedger.description',
      },
      {
        id: 'marketing-ia',
        label: 'Marketing IA blueprint',
        labelKey: 'navigation.groups.docs.links.marketingIa.label',
        href: '/docs/content/information-architecture',
        description: 'End-to-end information architecture notes for the marketing surface.',
        descriptionKey: 'navigation.groups.docs.links.marketingIa.description',
      },
    ],
  },
  {
    /**
     * Research navigation surfaces the academic partnership hub alongside Trace Synthesis
     * enablement resources. Aligning the data structure with other groups means navigation
     * validators and Pagefind indexing automatically recognize the /research route whenever
     * marketing ships new MDX updates.
     */
    id: 'research',
    label: 'Research',
    labelKey: 'navigation.groups.research.label',
    description:
      'Academic partnerships, Trace Synthesis integrations, and sandbox provisioning guidance.',
    descriptionKey: 'navigation.groups.research.description',
    links: [
      {
        id: 'research-hub',
        label: 'Research partnerships hub',
        labelKey: 'navigation.groups.research.links.hub.label',
        href: '/research',
        description: 'Program overview, FEDGEN workflows, and publication guidance.',
        descriptionKey: 'navigation.groups.research.links.hub.description',
      },
      {
        id: 'research-nova',
        label: 'Nova research tenants',
        labelKey: 'navigation.groups.research.links.nova.label',
        href: '/solutions/nova',
        description: 'Isolation controls and export governance for academic workloads.',
        descriptionKey: 'navigation.groups.research.links.nova.description',
      },
      {
        id: 'research-whitepapers',
        label: 'Sovereign AI Assurance',
        labelKey: 'navigation.groups.research.links.whitepapers.label',
        href: '/about/white-papers',
        description: 'Download attestation playbooks and Trace Synthesis integration briefs.',
        descriptionKey: 'navigation.groups.research.links.whitepapers.description',
      },
    ],
  },
  {
    /**
     * Incident response guides stay isolated in their own menu bucket so security teams can hotlink
     * the exact playbook they need during incidents without parsing the broader handbook catalog.
     */
    id: 'security-runbooks',
    label: 'Security Runbooks',
    labelKey: 'navigation.groups.securityRunbooks.label',
    description:
      'Field-ready incident guides aligned with the security playbooks introduced in issue #3.',
    descriptionKey: 'navigation.groups.securityRunbooks.description',
    links: [
      {
        id: 'contact-abuse',
        label: 'Contact abuse containment',
        labelKey: 'navigation.groups.securityRunbooks.links.contactAbuse.label',
        href: '/docs/security/runbook-contact-abuse',
        description: 'Intake hardening and automation to neutralize form API abuse.',
        descriptionKey: 'navigation.groups.securityRunbooks.links.contactAbuse.description',
      },
      {
        id: 'csp-triage',
        label: 'CSP violation triage',
        labelKey: 'navigation.groups.securityRunbooks.links.cspTriage.label',
        href: '/docs/security/runbook-csp-triage',
        description: 'Rapid response checklist for Content Security Policy reports.',
        descriptionKey: 'navigation.groups.securityRunbooks.links.cspTriage.description',
      },
      {
        id: 'r2-incident',
        label: 'R2 incident response',
        labelKey: 'navigation.groups.securityRunbooks.links.r2Incident.label',
        href: '/docs/security/runbook-r2-incident',
        description: 'Recovery orchestration for whitepaper storage breaches.',
        descriptionKey: 'navigation.groups.securityRunbooks.links.r2Incident.description',
      },
    ],
  },
  {
    /**
     * Partner teams frequently request brand assets without needing the entire handbook. Surfacing
     * the managed SVG exports alongside the narrative style guide minimizes back-and-forth and
     * keeps design automation (e.g., ensure scripts) front-and-center.
     */
    id: 'brand-kit',
    label: 'Brand Kit',
    labelKey: 'navigation.groups.brandKit.label',
    description: 'Design system artifacts, palettes, and typography specimens for partner teams.',
    descriptionKey: 'navigation.groups.brandKit.description',
    links: [
      {
        id: 'brand-style-guide',
        label: 'Brand style guide',
        labelKey: 'navigation.groups.brandKit.links.brandStyleGuide.label',
        href: '/docs/brand/styleguide',
        description: 'Living style guide documenting the end-to-end experience system.',
        descriptionKey: 'navigation.groups.brandKit.links.brandStyleGuide.description',
      },
      {
        id: 'palette-assets',
        label: 'Palette assets',
        labelKey: 'navigation.groups.brandKit.links.paletteAssets.label',
        href: '/static/brand/palette-light.svg',
        description: 'Downloadable color matrices for light/dark product surfaces.',
        descriptionKey: 'navigation.groups.brandKit.links.paletteAssets.description',
      },
      {
        id: 'typography-specimen',
        label: 'Typography specimen',
        labelKey: 'navigation.groups.brandKit.links.typographySpecimen.label',
        href: '/static/brand/typography-scale.svg',
        description: 'Responsive type ramp assets for collateral and product UI.',
        descriptionKey: 'navigation.groups.brandKit.links.typographySpecimen.description',
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
  const rootRef = useRef<HTMLDivElement | null>(null);
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

  useEffect(() => {
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
       * Welcome tour integration: exposing a stable data attribute lets the onboarding island
       * spotlight the entire navigation surface without hardcoding DOM queries in multiple files.
       */
      data-welcome-tour-target="navigation-surface"
      /**
       * `aria-label` announces intent to screen readers while Radix handles the menu roles.
       * Tailwind tokens reference centralized design scales so we never hand-roll pixel values.
       */
      aria-label="Primary"
      className={rootClassName}
    >
      {/* Prefetch controller mounts here so desktop navigation links participate without extra wiring. */}
      <PrefetchController />
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
              {...(group.id === 'docs'
                ? {
                    'data-welcome-tour-target': 'docs-hub',
                  }
                : {})}
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
        <a
          {...PREFETCH_ATTRIBUTE_PAYLOAD}
          ref={forwardedRef}
          href={href}
          className="navigation-link"
        >
          {children}
        </a>
      </Slot>
    </NavigationMenu.Link>
  );
});

NavigationMenuLink.displayName = 'NavigationMenuLink';

export default RadixNavigationMenu;
