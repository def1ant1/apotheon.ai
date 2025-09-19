/**
 * Centralized TypeScript helpers for working with the CSS variable token system.
 * React/Preact islands can import these maps to stay aligned with the Tailwind
 * configuration and the raw CSS definitions in `src/styles/tokens.css`.
 */

export type ThemeName = 'light' | 'dark';

/**
 * Utility record listing the supported `data-theme` attribute values. Keeping this
 * typed prevents divergent strings (e.g., `"Light"`) from slipping into islands.
 */
export const themeAttributes: Record<ThemeName, ThemeName> = {
  light: 'light',
  dark: 'dark',
};

/**
 * Returns the attribute bag (`{ 'data-theme': 'dark' }`) expected by our global
 * stylesheet. Useful when toggling theme scopes inside Astro slots or React
 * portals.
 */
export const getThemeAttribute = (theme: ThemeName): { 'data-theme': ThemeName } => ({
  'data-theme': theme,
});

/**
 * Token reference maps expose the raw CSS variable names so runtime logic can use
 * them directly (e.g., inline styles, CSS.registerProperty, chart libraries).
 */
export const colorTokens = {
  surface: {
    base: 'var(--color-surface-base)',
    raised: 'var(--color-surface-raised)',
    overlay: 'var(--color-surface-overlay)',
  },
  ink: {
    primary: 'var(--color-ink-primary)',
    secondary: 'var(--color-ink-secondary)',
    muted: 'var(--color-ink-muted)',
    inverted: 'var(--color-ink-inverted)',
  },
  accent: {
    brand: 'var(--color-accent-brand)',
    focus: 'var(--color-accent-focus)',
    success: 'var(--color-accent-success)',
    danger: 'var(--color-accent-danger)',
  },
  border: {
    subtle: 'var(--color-border-subtle)',
    strong: 'var(--color-border-strong)',
  },
  utility: {
    backdrop: 'var(--color-utility-backdrop)',
    skeleton: 'var(--color-utility-skeleton)',
  },
} as const;

export const spacingTokens = {
  space3xs: 'var(--space-3xs)',
  space2xs: 'var(--space-2xs)',
  spaceXs: 'var(--space-xs)',
  spaceSm: 'var(--space-sm)',
  spaceMd: 'var(--space-md)',
  spaceLg: 'var(--space-lg)',
  spaceXl: 'var(--space-xl)',
  space2xl: 'var(--space-2xl)',
  space3xl: 'var(--space-3xl)',
  gutterInline: 'var(--space-gutter-inline)',
  gutterBlock: 'var(--space-gutter-block)',
} as const;

export const typographyTokens = {
  display2xl: {
    size: 'var(--font-size-display-2xl)',
    lineHeight: 'var(--line-height-display-2xl)',
    letterSpacing: 'var(--letter-spacing-display)',
  },
  displayXl: {
    size: 'var(--font-size-display-xl)',
    lineHeight: 'var(--line-height-display-xl)',
    letterSpacing: 'var(--letter-spacing-display)',
  },
  titleLg: {
    size: 'var(--font-size-title-lg)',
    lineHeight: 'var(--line-height-title)',
    letterSpacing: 'var(--letter-spacing-tight)',
  },
  titleMd: {
    size: 'var(--font-size-title-md)',
    lineHeight: 'var(--line-height-title)',
    letterSpacing: 'var(--letter-spacing-tight)',
  },
  bodyLg: {
    size: 'var(--font-size-body-lg)',
    lineHeight: 'var(--line-height-body)',
    letterSpacing: 'var(--letter-spacing-normal)',
  },
  bodyMd: {
    size: 'var(--font-size-body-md)',
    lineHeight: 'var(--line-height-body)',
    letterSpacing: 'var(--letter-spacing-normal)',
  },
  bodySm: {
    size: 'var(--font-size-body-sm)',
    lineHeight: 'var(--line-height-body)',
    letterSpacing: 'var(--letter-spacing-normal)',
  },
  caption: {
    size: 'var(--font-size-caption)',
    lineHeight: 'var(--line-height-tight)',
    letterSpacing: 'var(--letter-spacing-wide)',
  },
} as const;

export const radiusTokens = {
  xs: 'var(--radius-xs)',
  sm: 'var(--radius-sm)',
  md: 'var(--radius-md)',
  lg: 'var(--radius-lg)',
  xl: 'var(--radius-xl)',
  doubleXl: 'var(--radius-2xl)',
  pill: 'var(--radius-pill)',
} as const;

export const shadowTokens = {
  elevation1: 'var(--shadow-elevation-1)',
  elevation2: 'var(--shadow-elevation-2)',
  elevation3: 'var(--shadow-elevation-3)',
} as const;

export type ColorTokenPath = typeof colorTokens;
export type SpacingTokenPath = typeof spacingTokens;
export type TypographyTokenPath = typeof typographyTokens;
export type RadiusTokenPath = typeof radiusTokens;
export type ShadowTokenPath = typeof shadowTokens;
