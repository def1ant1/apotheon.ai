export interface WhitepaperManifestEntry {
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly industries: ReadonlyArray<string>;
  readonly asset: {
    readonly objectKey: string;
    readonly checksum: string;
    readonly contentType: string;
    readonly pageCount: number;
  };
  readonly gatingNotes: {
    readonly distribution: string;
    readonly reviewerChecklist: ReadonlyArray<string>;
    readonly complianceContacts: ReadonlyArray<{ team: string; email: string }>;
  };
  readonly lifecycle: {
    readonly draft: boolean;
    readonly archived: boolean;
    readonly embargoedUntil?: string;
  };
  readonly seo?: Record<string, unknown>;
}

export const WHITEPAPER_MANIFEST: ReadonlyArray<WhitepaperManifestEntry> = [
  {
    title: 'Apotheon.ai Investor Brief',
    summary:
      'Board-ready overview of revenue momentum, regulated AI moat, and automation platform economics for diligence teams.',
    industries: ['financial-services', 'healthcare', 'public-sector'],
    asset: {
      objectKey: 'whitepapers/apotheon-investor-brief.pdf',
      checksum: '2f3839aa2225181bf5a10a84ddcb46db80d5267d666292a3a08131bcf9900651',
      contentType: 'application/pdf',
      pageCount: 2,
    },
    gatingNotes: {
      distribution:
        "Position as the fastest path to understand Apotheon.ai's defensible pipeline mechanics, expansion levers, and compliance differentiators without an NDA.",
      reviewerChecklist: [
        'Confirm all ARR, GRR, and NRR references align with the latest RevOps board pack (update the appendix timestamp on drift).',
        'Validate competitive landscape statements against the approved intelligence brief to avoid disclosing embargoed field learnings.',
        'Ensure regulatory roadmap slides cite the live certification IDs from the trust center before shipping.',
        'Verify every investor CTA routes to the `/about/contact/?team=investor-relations` flow so analytics and automation stay linked.',
      ],
      complianceContacts: [
        {
          team: 'Investor Relations Desk',
          email: 'ir@apotheon.ai',
        },
        {
          team: 'Revenue Operations Analytics',
          email: 'revops@apotheon.ai',
        },
        {
          team: 'Security & Compliance Office',
          email: 'compliance@apotheon.ai',
        },
      ],
    },
    lifecycle: {
      draft: false,
      archived: false,
    },
    seo: {
      description:
        'Access the Apotheon.ai investor briefing highlighting revenue durability, automation moat, and compliance readiness for institutional diligence.',
    },
    slug: 'apotheon-investor-brief',
  },
  {
    title: 'Sovereign AI Assurance Field Guide',
    summary:
      'Framework for deploying sovereign AI capabilities with verifiable lineage, policy enforcement, and mission-ready oversight.',
    industries: ['intelligence', 'public-sector', 'military'],
    asset: {
      objectKey: 'whitepapers/apotheon-sovereign-ai-assurance.pdf',
      checksum: '38f25dafbbfc90d63c94843b05f05eea7f53c588f20fbe1a7d1f7adddd79ac67',
      contentType: 'application/pdf',
      pageCount: 2,
    },
    gatingNotes: {
      distribution:
        'Emphasize sovereign control, on-prem deployment options, and zero-trust telemetry; avoid suggesting Apotheon hosts classified workloads.',
      reviewerChecklist: [
        'Verify every control mapping aligns with the current DISA STIG appendix.',
        'Confirm supply-chain language references the approved SBOM policy statement.',
        'Ensure all diagrams reference sanitized architecture layers cleared by the security review board.',
      ],
      complianceContacts: [
        {
          team: 'Government Affairs Counsel',
          email: 'legal@apotheon.ai',
        },
        {
          team: 'Mission Assurance Office',
          email: 'mission@apotheon.ai',
        },
      ],
    },
    lifecycle: {
      draft: false,
      archived: false,
    },
    seo: {
      description:
        'Secure sovereign AI deployments with the Apotheon AI Assurance Field Guide covering policy enforcement and observability.',
    },
    slug: 'sovereign-ai-assurance',
  },
  {
    title: 'Apotheon Strategic Automation Playbook',
    summary:
      'Board-ready automation guidance illustrating how regulated enterprises orchestrate Apotheon.ai rollouts without manual toil.',
    industries: ['financial-services', 'healthcare', 'government'],
    asset: {
      objectKey: 'whitepapers/apotheon-strategic-automation-playbook.pdf',
      checksum: '41feba531b25c5bbde367e6c2e60887143c31d60be1e1997c78ba1adef269771',
      contentType: 'application/pdf',
      pageCount: 2,
    },
    gatingNotes: {
      distribution:
        'Align nurture copy around operational risk reduction and incident response automation; avoid promising turnkey compliance.',
      reviewerChecklist: [
        'Validate board metrics and quantified lift statements against current RevOps benchmark spreadsheet.',
        'Confirm platform screenshots match the current Atlas + Clio UI components.',
        'Ensure every mention of "automated remediation" includes the "human-on-the-loop" qualifier.',
      ],
      complianceContacts: [
        {
          team: 'Security & Trust',
          email: 'compliance@apotheon.ai',
        },
        {
          team: 'Regulated Industries PMO',
          email: 'pmo@apotheon.ai',
        },
      ],
    },
    lifecycle: {
      draft: false,
      archived: false,
      embargoedUntil: '2024-11-15T13:00:00.000Z',
    },
    seo: {
      description:
        'Download the Apotheon Strategic Automation Playbook to see how regulated enterprises orchestrate AI deployments with audit-ready guardrails.',
    },
    slug: 'strategic-automation-playbook',
  },
] as const;

export const WHITEPAPER_MANIFEST_BY_SLUG = new Map(
  WHITEPAPER_MANIFEST.map((entry) => [entry.slug, entry] as const),
);

export const WHITEPAPER_SLUGS = WHITEPAPER_MANIFEST.map((entry) => entry.slug);
