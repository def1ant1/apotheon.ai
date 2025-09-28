import defaultConfig from 'tailwindcss/defaultConfig';
import defaultTheme from 'tailwindcss/defaultTheme';

/**
 * Tailwind needs an "opacity aware" color string so utilities like `bg-{token}/80`
 * keep functioning. We centralize the template string to eliminate duplication and
 * to ensure new semantic tokens stay consistent across the configuration.
 *
 * @param {string} variable CSS custom property name, e.g. `--color-surface-base`.
 * @returns {string} An `hsl(var(--foo) / <alpha-value>)` reference Tailwind can parse.
 */
const withOpacity = (variable) => `hsl(var(${variable}) / <alpha-value>)`;

/**
 * Colors, typography, radii, shadows, and spacing all route through the same
 * tokenized CSS variables defined in `src/styles/tokens.css`. The Tailwind layer
 * simply maps those variables into utility-friendly names so every Astro island
 * consumes the same design primitives regardless of where it lives.
 */
const semanticColors = {
  surface: {
    base: withOpacity('--color-surface-base'),
    raised: withOpacity('--color-surface-raised'),
    overlay: withOpacity('--color-surface-overlay')
  },
  ink: {
    primary: withOpacity('--color-ink-primary'),
    secondary: withOpacity('--color-ink-secondary'),
    inverted: withOpacity('--color-ink-inverted'),
    muted: withOpacity('--color-ink-muted')
  },
  accent: {
    brand: withOpacity('--color-accent-brand'),
    focus: withOpacity('--color-accent-focus'),
    success: withOpacity('--color-accent-success'),
    danger: withOpacity('--color-accent-danger')
  },
  border: {
    subtle: withOpacity('--color-border-subtle'),
    strong: withOpacity('--color-border-strong')
  },
  utility: {
    backdrop: withOpacity('--color-utility-backdrop'),
    skeleton: withOpacity('--color-utility-skeleton')
  }
};

/**
 * Typographic scale: the arrays follow Tailwind's `[size, { lineHeight, letterSpacing }]`
 * tuple convention. Every entry points to a CSS variable so editorial teams can
 * iterate on rhythm without touching the build.
 */
const typographyScale = {
  'display-2xl': ['var(--font-size-display-2xl)', { lineHeight: 'var(--line-height-display-2xl)', letterSpacing: 'var(--letter-spacing-display)' }],
  'display-xl': ['var(--font-size-display-xl)', { lineHeight: 'var(--line-height-display-xl)', letterSpacing: 'var(--letter-spacing-display)' }],
  'title-lg': ['var(--font-size-title-lg)', { lineHeight: 'var(--line-height-title)', letterSpacing: 'var(--letter-spacing-tight)' }],
  'title-md': ['var(--font-size-title-md)', { lineHeight: 'var(--line-height-title)', letterSpacing: 'var(--letter-spacing-tight)' }],
  'body-lg': ['var(--font-size-body-lg)', { lineHeight: 'var(--line-height-body)', letterSpacing: 'var(--letter-spacing-normal)' }],
  'body': ['var(--font-size-body-md)', { lineHeight: 'var(--line-height-body)', letterSpacing: 'var(--letter-spacing-normal)' }],
  'body-sm': ['var(--font-size-body-sm)', { lineHeight: 'var(--line-height-body)', letterSpacing: 'var(--letter-spacing-normal)' }],
  'caption': ['var(--font-size-caption)', { lineHeight: 'var(--line-height-tight)', letterSpacing: 'var(--letter-spacing-wide)' }]
};

/**
 * Spatial scale intentionally mirrors the token keys documented in the style guide.
 * We expose a curated subset to Tailwind to keep the utility surface area focused
 * on layout primitives (gutters, section spacing, etc.).
 */
const spatialScale = {
  'space-3xs': 'var(--space-3xs)',
  'space-2xs': 'var(--space-2xs)',
  'space-xs': 'var(--space-xs)',
  'space-sm': 'var(--space-sm)',
  'space-md': 'var(--space-md)',
  'space-lg': 'var(--space-lg)',
  'space-xl': 'var(--space-xl)',
  'space-2xl': 'var(--space-2xl)',
  'space-3xl': 'var(--space-3xl)',
  'gutter-inline': 'var(--space-gutter-inline)',
  'gutter-block': 'var(--space-gutter-block)'
};

/**
 * Radius tokens keep rounded corners consistent across frameworks. Components may
 * still opt into Tailwind's stock values, but the semantic aliases simplify
 * auditing across the design system.
 */
const radiusScale = {
  'radius-xs': 'var(--radius-xs)',
  'radius-sm': 'var(--radius-sm)',
  'radius-md': 'var(--radius-md)',
  'radius-lg': 'var(--radius-lg)',
  'radius-xl': 'var(--radius-xl)',
  'radius-2xl': 'var(--radius-2xl)',
  'radius-pill': 'var(--radius-pill)'
};

/**
 * Shadow recipes wrap raw `box-shadow` strings to align across components. These
 * reference CSS variables so native CSS (outside of Tailwind) can reuse the exact
 * same elevation tokens.
 */
const shadowScale = {
  'elevation-1': 'var(--shadow-elevation-1)',
  'elevation-2': 'var(--shadow-elevation-2)',
  'elevation-3': 'var(--shadow-elevation-3)',
  'focus-ring': '0 0 0 3px hsl(var(--color-accent-focus) / 0.35)'
};

/**
 * Tailwind CSS v4 promotes a preset-first mental model. We start from the
 * upstream defaults and layer our enterprise tokens on top so future upgrades
 * become a preset swap rather than manual copy/paste work.
 */
const config = {
  presets: [defaultConfig],
  /**
   * The `content` key graduated to an object in Tailwind v4. Keeping it explicit
   * helps new contributors understand where to extend extraction (e.g., Astro
   * MDX, markdown partials, or future CMS-driven entry points).
   */
  content: {
    files: ['src/**/*.{astro,html,md,mdx,js,jsx,ts,tsx}']
  },
  /**
   * We deliberately keep everything under `theme.extend` so Tailwind continues to
   * merge with upstream defaults. Each token block mirrors the CSS custom
   * properties declared in `src/styles/tokens.css`.
   */
  theme: {
    extend: {
      colors: semanticColors,
      fontSize: typographyScale,
      spacing: spatialScale,
      borderRadius: radiusScale,
      boxShadow: shadowScale,
      fontFamily: {
        /*
          System UI faces lead the stack so first paint uses fonts the OS already
          has cached. Optional variable fonts slot in next; if the Inter bundle
          finishes loading we upgrade without layout shift thanks to similar
          metrics. The legacy CSS custom property stays as a final hook for
          self-hosted fallbacks.
        */
        sans: [
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Inter Variable',
          'Inter',
          'var(--font-family-sans)',
          ...defaultTheme.fontFamily.sans
        ]
      }
    }
  },
  plugins: []
};

export default config;
