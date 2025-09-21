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
    slug: 'sovereign-ai-assurance',
    title: 'Sovereign AI Assurance Field Guide',
    summary:
      'Framework for deploying sovereign AI capabilities with verifiable lineage, policy enforcement, and mission-ready oversight.',
    industries: ['intelligence', 'public-sector', 'military'],
    asset: {
      objectKey: 'whitepapers/apotheon-sovereign-ai-assurance.pdf',
      checksum: '8da50dab10a535fc2ece307fac2bdf7e2f054ca44688f8c0032216c15cb30475',
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
      checksum: '8da50dab10a535fc2ece307fac2bdf7e2f054ca44688f8c0032216c15cb30475',
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
