/**
 * Central registry driving `z.enum` validation for hero icon lookups.
 *
 * We intentionally keep this list colocated with the icon map so adding a new
 * industry only requires updating the raw SVG, running `npm run icons:build`,
 * and appending the slug here—no manual wiring inside templates.
 */
export const INDUSTRY_ICON_SLUGS = [
  'finance',
  'healthcare',
  'public-sector',
  'energy',
  'manufacturing',
  'transport',
  'law',
  'government',
  'military',
  'intelligence',
] as const;

export type IndustryIconSlug = (typeof INDUSTRY_ICON_SLUGS)[number];
