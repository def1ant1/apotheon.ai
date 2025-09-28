import type { AnalyticsEvent } from './analytics';

/**
 * Audience + intent resolver
 * --------------------------
 *
 * This module centralizes how marketing surfaces (contact form, hero banners, docs landing, etc.)
 * interpret querystring parameters to tailor copy, CTAs, and analytics. The resolvers live in a
 * shared utility so every surface consumes identical logic—no more bespoke parsing in each
 * component. The heavy inline documentation exists so future operators immediately understand how
 * to register new roles or RevOps teams without spelunking through JSX.
 */

export type ContactIntent = 'demo' | 'partnership' | 'media' | 'careers' | 'investor' | 'support';

export const DEFAULT_INTENT: ContactIntent = 'demo';

/**
 * Analytics identifiers map directly into the Worker proxy (src/workers/analytics.ts).
 * Keeping the mapping colocated with the intent definitions makes it obvious which
 * journey a new preset should report under.
 */
export const INTENT_ANALYTICS_EVENT: Record<ContactIntent, AnalyticsEvent> = {
  demo: 'lead_demo',
  partnership: 'lead_demo',
  media: 'lead_demo',
  careers: 'lead_demo',
  investor: 'lead_investor',
  support: 'lead_demo',
};

export type AudienceRole = 'dev' | 'security' | 'exec';

export interface RoleExperienceCta {
  readonly label: string;
  readonly href: string;
  readonly ariaLabel: string;
  /** Optional analytics identifier so Playwright + downstream dataLayer hooks stay deterministic. */
  readonly analyticsId?: string;
}

export interface RoleExperiencePreset {
  readonly id: AudienceRole;
  readonly label: string;
  readonly description: string;
  readonly intent: ContactIntent;
  readonly analyticsEvent: AnalyticsEvent;
  /** Event fired whenever any surface renders the preset—consumed by the analytics Worker. */
  readonly experienceEvent: AnalyticsEvent;
  readonly hero: {
    readonly headline: string;
    readonly eyebrow: string;
    readonly supportingCopy: string;
    readonly primaryCta: RoleExperienceCta;
    readonly secondaryCta?: RoleExperienceCta;
  };
  readonly docs: {
    readonly title: string;
    readonly description: string;
    readonly href: string;
  };
  readonly contact: {
    readonly headline: string;
    readonly message: string;
    readonly bullets: readonly string[];
  };
}

/**
 * Role presets intentionally favor automation-heavy messaging. Each preset documents the
 * target persona, preferred CTA destinations, and even the contact form helper copy.
 */
export const ROLE_EXPERIENCE_PRESETS: Record<AudienceRole, RoleExperiencePreset> = {
  dev: {
    id: 'dev',
    label: 'Platform & AI engineers',
    description:
      'SDK walkthroughs, sandbox credential automation, and deployment guardrails for engineering squads shipping AI features.',
    intent: 'demo',
    analyticsEvent: 'lead_demo',
    experienceEvent: 'role_experience_impression',
    hero: {
      eyebrow: 'For builders',
      headline: 'Accelerate AI delivery without waiting on manual reviews',
      supportingCopy:
        'Developers land in the command center with CI-ready SDKs, infrastructure templates, and observability wiring so the first deploy happens in hours, not weeks.',
      primaryCta: {
        label: 'View the developer runbooks',
        href: '/docs/dev/workflows/',
        ariaLabel: 'Open the developer automation workflows in the handbook',
        analyticsId: 'homepage-hero-role-dev-primary',
      },
      secondaryCta: {
        label: 'Book a technical deep dive',
        href: '/contact/?team=solutions-engineering&role=dev',
        ariaLabel: 'Request a technical deep dive with the solutions engineering team',
        analyticsId: 'homepage-hero-role-dev-secondary',
      },
    },
    docs: {
      title: 'Developer acceleration lane',
      description:
        'Start with CI/CD blueprints, runtime policies, and SDK samples curated for engineers integrating Apotheon.ai microservices.',
      href: '/docs/dev/workflows/',
    },
    contact: {
      headline: 'Engineering enablement briefing',
      message:
        'Solutions engineering routes developer leads directly into the automation backlog. Mention your deployment target and stack so we can pre-stage sandbox credentials.',
      bullets: [
        'Sandbox API keys provisioned within one business hour.',
        'Pair with developer relations on CI templates and SDK instrumentation.',
        'Access AI quality guardrails and eval harness guidance upfront.',
      ],
    },
  },
  security: {
    id: 'security',
    label: 'Security & risk leaders',
    description:
      'Policy attestations, incident automation, and governance telemetry for security teams overseeing regulated AI workloads.',
    intent: 'support',
    analyticsEvent: 'lead_demo',
    experienceEvent: 'role_experience_impression',
    hero: {
      eyebrow: 'For security leads',
      headline: 'Enforce AI governance with automated attestations',
      supportingCopy:
        'Security teams plug into the compliance control plane with SOC evidence bundles, incident drill automation, and runtime guardrails wired into Apotheon.ai services.',
      primaryCta: {
        label: 'Review security automation guides',
        href: '/docs/security/incident-response/',
        ariaLabel: 'Open the security automation guides in the handbook',
        analyticsId: 'homepage-hero-role-security-primary',
      },
      secondaryCta: {
        label: 'Engage the security desk',
        href: '/contact/?role=security',
        ariaLabel: 'Contact the Apotheon.ai security desk for a readiness review',
        analyticsId: 'homepage-hero-role-security-secondary',
      },
    },
    docs: {
      title: 'Security automation deck',
      description:
        'Jump into tabletop templates, breach notification runbooks, and automated control attestations maintained by the security office.',
      href: '/docs/security/incident-response/',
    },
    contact: {
      headline: 'Security readiness consult',
      message:
        'Share your regulatory scope and vendor assessment needs. Our security desk assembles attestations and automates follow-ups through the shared control plane.',
      bullets: [
        'Instant access to SOC 2, ISO 27001, and AI risk policy packets.',
        'Automated follow-ups with audit trails via the compliance Worker.',
        'Joint review of incident automation playbooks tailored to your stack.',
      ],
    },
  },
  exec: {
    id: 'exec',
    label: 'Executive sponsors',
    description:
      'Strategic briefings, ROI dashboards, and delivery cadences for executives operationalizing Apotheon.ai across business units.',
    intent: 'demo',
    analyticsEvent: 'lead_investor',
    experienceEvent: 'role_experience_impression',
    hero: {
      eyebrow: 'For executives',
      headline: 'Operationalize AI impact across every business unit',
      supportingCopy:
        'Executives receive a guided rollout plan, KPIs tied to automation milestones, and RevOps orchestration so pilots convert into production launches quickly.',
      primaryCta: {
        label: 'Download the executive briefing',
        href: '/about/white-papers/?whitepaperSlug=apotheon-investor-brief#whitepaper-request',
        ariaLabel: 'Download the Apotheon.ai executive briefing',
        analyticsId: 'homepage-hero-role-exec-primary',
      },
      secondaryCta: {
        label: 'Schedule an executive alignment',
        href: '/contact/?team=investor-relations&role=exec',
        ariaLabel: 'Schedule an executive alignment with Apotheon.ai leadership',
        analyticsId: 'homepage-hero-role-exec-secondary',
      },
    },
    docs: {
      title: 'Executive orchestration kit',
      description:
        'Leverage portfolio governance templates, value realization scorecards, and stakeholder communication cadences vetted by RevOps.',
      href: '/docs/overview/why-apotheon/',
    },
    contact: {
      headline: 'Executive alignment session',
      message:
        'Our leadership team preps a tailored roadmap across GTM, security, and platform milestones. Include target regions and teams so we can assemble the right principals.',
      bullets: [
        'ROI dashboards instrumented to your success metrics.',
        'Stakeholder comms templates for rapid internal alignment.',
        'Pilot-to-production playbooks with RevOps coordination.',
      ],
    },
  },
};

const TEAM_INTENT_PRESETS: Record<
  string,
  {
    readonly intent: ContactIntent;
    readonly analyticsEvent: AnalyticsEvent;
  }
> = {
  /** Investors receive a dedicated journey with analytics instrumentation. */
  'investor-relations': { intent: 'investor', analyticsEvent: 'lead_investor' },
};

export interface IntentPresetResolution {
  readonly intent: ContactIntent;
  readonly analyticsEvent: AnalyticsEvent;
  readonly source: 'default' | 'team' | 'role';
  readonly team?: string;
  readonly role?: AudienceRole;
  readonly rolePreset?: RoleExperiencePreset;
}

export function normalizeSearchParams(
  search: string | URLSearchParams | null | undefined,
): URLSearchParams {
  if (search instanceof URLSearchParams) {
    return search;
  }
  if (typeof search === 'string') {
    return new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
  }
  return new URLSearchParams();
}

export function resolveIntentPresetFromSearch(
  search: string | URLSearchParams | null | undefined,
): IntentPresetResolution {
  const params = normalizeSearchParams(search);
  const teamParamRaw = params.get('team');
  const roleParamRaw = params.get('role');
  const teamParam = teamParamRaw ? teamParamRaw.trim().toLowerCase() : '';
  const roleParam = roleParamRaw ? roleParamRaw.trim().toLowerCase() : '';
  const rolePreset =
    (roleParam as AudienceRole | '') in ROLE_EXPERIENCE_PRESETS
      ? ROLE_EXPERIENCE_PRESETS[roleParam as AudienceRole]
      : undefined;

  if (teamParam && teamParam in TEAM_INTENT_PRESETS) {
    const preset = TEAM_INTENT_PRESETS[teamParam];
    return {
      intent: preset.intent,
      analyticsEvent: preset.analyticsEvent,
      source: 'team',
      team: teamParam,
      role: rolePreset?.id,
      rolePreset,
    };
  }

  if (rolePreset) {
    return {
      intent: rolePreset.intent,
      analyticsEvent: rolePreset.analyticsEvent,
      source: 'role',
      role: rolePreset.id,
      rolePreset,
    };
  }

  return {
    intent: DEFAULT_INTENT,
    analyticsEvent: INTENT_ANALYTICS_EVENT[DEFAULT_INTENT],
    source: 'default',
  };
}
