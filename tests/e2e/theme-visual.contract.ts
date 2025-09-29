import { themeAttributes, type ThemeName } from '../../src/styles/tokens';

/**
 * Central contract describing which marketing routes receive automated
 * light/dark snapshot coverage. Keeping the data in a standalone module lets
 * both the Playwright spec and CLI utilities evolve together without accidental
 * drift.
 */
export interface ThemeVisualRoute {
  readonly path: string;
  readonly slug: string;
}

/**
 * Marketing entry points chosen for their dense component coverage. The list
 * intentionally mixes hero-driven and long-form layouts so a single regeneration
 * cycle captures token regressions across critical templates. The matrix now
 * deliberately spans marketing, documentation, and dashboard surfaces so the
 * enterprise-grade experience remains observably consistent as contracts evolve.
 */
export const THEME_VISUAL_ROUTES: ThemeVisualRoute[] = [
  { path: '/', slug: 'homepage' }, // Marketing hero coverage safeguarding enterprise acquisition flows.
  { path: '/docs/', slug: 'docs-index' }, // Documentation navigation stress test validating knowledge base resiliency.
  { path: '/lead-viewer/', slug: 'lead-viewer-dashboard' }, // Authenticated dashboard shell protecting revenue operations telemetry.
];

/**
 * Themes are sourced from the canonical design token registry so future theme
 * additions automatically flow into the spec and regeneration scripts.
 */
export const THEME_VISUAL_THEMES = Object.keys(themeAttributes) as ThemeName[];
