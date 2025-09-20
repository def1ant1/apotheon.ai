import type { IndustryIconSlug } from '../../content/industries/iconSlugs';

/**
 * Shared data contracts for industry components. We replicate the schema shape here to
 * avoid pulling runtime dependencies on `astro:content` inside component tests while
 * keeping editors aligned with the frontmatter contract.
 */
export interface IndustryHeroContent {
  eyebrow: string;
  headline: string;
  copy: string;
  icon: IndustryIconSlug;
}

export interface IndustryPressure {
  title: string;
  description: string;
  metric?: string;
}

export interface IndustryComplianceHighlight {
  framework: string;
  highlight: string;
  evidence?: string;
}

export interface IndustrySolutionReference {
  slug: string;
  positioning: string;
  outcome?: string;
}

export interface IndustrySolutionSummary {
  slug: string;
  data: {
    title: string;
  };
}

export interface IndustryUseCase {
  title: string;
  persona: string;
  narrative: string;
  automationLevel?: string;
}

export interface IndustryCta {
  label: string;
  href: string;
  description?: string;
  ariaLabel?: string;
}

export interface IndustryCtaGroup {
  demo: IndustryCta;
  whitepaper: IndustryCta;
}
