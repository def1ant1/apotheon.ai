export const INDUSTRY_ICON_SLUGS = [
  'finance',
  'healthcare',
  'public-sector',
  'energy',
  'manufacturing',
  'transport',
] as const;

export type IndustryIconSlug = (typeof INDUSTRY_ICON_SLUGS)[number];
