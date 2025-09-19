/**
 * Stylelint keeps Astro's collocated CSS and Tailwind layers predictable. The config mirrors
 * how we author styles today: Tailwind-first utility classes with the option to sprinkle in
 * CSS Modules for bespoke components.
 */
module.exports = {
  // Base rule-sets bring in modern conventions plus Tailwind-specific heuristics.
  extends: ['stylelint-config-standard', 'stylelint-config-tailwindcss'],
  plugins: ['stylelint-order'],

  ignoreFiles: [
    '**/*.js',
    '**/*.cjs',
    '**/*.mjs',
    '**/*.ts',
    '**/*.tsx',
    '**/*.md',
    '**/*.mdx',
  ],

  rules: {
    // Allow Tailwind/PostCSS directives that stylelint-config-standard would otherwise flag.
    'at-rule-no-unknown': [
      true,
      {
        ignoreAtRules: ['tailwind', 'apply', 'layer', 'variants', 'responsive', 'screen'],
      },
    ],
    // Tailwind utilities and CSS Modules often share unconventional naming – keep linting flexible.
    'selector-class-pattern': null,
    // Preserve author-specified property groupings, but ensure CSS Modules comps stay on top.
    'order/properties-order': [
      [
        {
          properties: ['composes'],
        },
      ],
      {
        unspecified: 'bottomAlphabetical',
      },
    ],
    // Ensure color codes remain compact without sacrificing clarity.
    'color-hex-length': 'short',
    // Tailwind's @apply blocks often stack without blank lines; keep them compact.
    'declaration-empty-line-before': null,
  },

  overrides: [
    {
      // Enable Stylelint inside <style> blocks of Astro components.
      files: ['**/*.astro'],
      customSyntax: 'postcss-html',
    },
    {
      // CSS Modules sometimes need :global selectors for interoperability – keep them legal.
      files: ['**/*.module.css'],
      rules: {
        'selector-pseudo-class-no-unknown': [
          true,
          {
            ignorePseudoClasses: ['global', 'local'],
          },
        ],
      },
    },
  ],
};
