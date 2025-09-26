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
}

export const WHITEPAPER_MANIFEST: ReadonlyArray<WhitepaperManifestEntry> = [
  {
    slug: 'apotheon-investor-brief',
    title: 'Apotheon.ai Investor Brief',
    summary:
      'Board-ready overview of revenue momentum, regulated AI moat, and automation platform economics for diligence teams.',
    industries: ['financial-services', 'healthcare', 'public-sector'],
    asset: {
      objectKey: 'whitepapers/apotheon-investor-brief.pdf',
      checksum: '8da50dab10a535fc2ece307fac2bdf7e2f054ca44688f8c0032216c15cb30475',
      contentType: 'application/pdf',
      pageCount: 18,
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
  },
  {
    slug: 'sovereign-ai-assurance',
    title: 'Sovereign AI Assurance Field Guide',
    summary:
      'Framework for deploying sovereign AI capabilities with verifiable lineage, policy enforcement, and mission-ready oversight.',
    industries: ['intelligence', 'public-sector', 'military'],
    asset: {
      objectKey: 'whitepapers/apotheon-sovereign-ai-assurance.pdf',
      checksum: 'db33b7391ee4987410d0e620921f225a8f75aa39d960c0c716194d97f84fa27e',
      contentType: 'application/pdf',
      pageCount: 32,
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
  },
  {
    slug: 'strategic-automation-playbook',
    title: 'Apotheon Strategic Automation Playbook',
    summary:
      'Board-ready automation guidance illustrating how regulated enterprises orchestrate Apotheon.ai rollouts without manual toil.',
    industries: ['financial-services', 'healthcare', 'government'],
    asset: {
      objectKey: 'whitepapers/apotheon-strategic-automation-playbook.pdf',
      checksum: 'db33b7391ee4987410d0e620921f225a8f75aa39d960c0c716194d97f84fa27e',
      contentType: 'application/pdf',
      pageCount: 36,
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
  },
] as const;

export const WHITEPAPER_MANIFEST_BY_SLUG = new Map(
  WHITEPAPER_MANIFEST.map((entry) => [entry.slug, entry] as const),
);

export const WHITEPAPER_SLUGS = WHITEPAPER_MANIFEST.map((entry) => entry.slug);
