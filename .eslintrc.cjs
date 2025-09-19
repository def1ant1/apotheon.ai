/**
 * Enterprise ESLint configuration aligned with Astro's hybrid content/application model.
 * The goal is to keep authoring ergonomic while ensuring security, accessibility,
 * and import hygiene at scale. Every section is annotated so future contributors can
 * reason about why a rule exists before tweaking it.
 */
const path = require('node:path');

/**
 * Centralize the TypeScript project reference. We reuse it in multiple overrides so it is
 * easy to update if the repo structure changes (for example, introducing packages/ workspaces).
 */
const projectTsconfig = path.resolve(__dirname, 'tsconfig.json');

module.exports = {
  // Keep ESLint scoped to this repository – avoids accidentally inheriting parent configs.
  root: true,

  // Enable browser + Node globals because Astro components run in both environments.
  env: { browser: true, es2023: true, node: true },

  // Modern syntax with native ES modules. Specific parsers are assigned inside overrides.
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },

  // Import plugin configuration doubles as documentation of what file types we expect.
  settings: {
    'import/resolver': {
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx', '.astro', '.mdx'],
      },
      typescript: {
        // Use the same tsconfig we ship to Astro/tsc for consistent path + type resolution.
        project: projectTsconfig,
      },
    },
    // Allow MDX fenced code blocks to inherit the repo rules instead of being skipped.
    'mdx/code-blocks': true,
  },

  // Base rule-set shared by every file type before more targeted overrides kick in.
  extends: ['eslint:recommended', 'plugin:import/recommended', 'plugin:import/typescript'],

  plugins: ['import', 'security'],

  // Ignore generated artefacts and vendor assets so linting stays fast and actionable.
  ignorePatterns: [
    '.astro/',
    'dist/',
    'node_modules/',
    'public/',
    'package-lock.json',
  ],

  // Organization-first rules that apply globally.
  rules: {
    // Keep module imports grouped and alphabetized. This dramatically reduces merge pain.
    'import/order': [
      'error',
      {
        groups: [
          'builtin',
          'external',
          'internal',
          ['parent', 'sibling', 'index'],
          'object',
          'type',
        ],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true },
      },
    ],
    'import/no-named-as-default': 'off',
    // Security plugin: enable high-signal rules explicitly for compatibility with ESLint 8.
    'security/detect-non-literal-fs-filename': 'error',
    'security/detect-non-literal-regexp': 'warn',
    'security/detect-non-literal-require': 'error',
    'security/detect-possible-timing-attacks': 'warn',
    'security/detect-unsafe-regex': 'error',
    // Security plugin is quite aggressive. We disable the highest-noise rule to avoid churn.
    'security/detect-object-injection': 'off',
    // Enforce explicit file extensions only when our tooling requires them (Astro + MDX stay explicit).
    'import/extensions': [
      'error',
      'ignorePackages',
      {
        js: 'never',
        jsx: 'never',
        ts: 'never',
        tsx: 'never',
        astro: 'always',
        mdx: 'always',
      },
    ],
    // Abort CI if someone adds an unresolved import – prevents runtime 500s in production.
    'import/no-unresolved': [
      'error',
      {
        ignore: ['^astro:'],
      },
    ],
  },

  overrides: [
    {
      // TypeScript (including React islands) gets type-aware linting + React hook safety nets.
      files: ['**/*.{ts,tsx}'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        project: projectTsconfig,
        tsconfigRootDir: __dirname,
        extraFileExtensions: ['.astro'],
      },
      plugins: ['@typescript-eslint', 'jsx-a11y', 'react-hooks'],
      extends: [
        'plugin:@typescript-eslint/recommended',
        'plugin:@typescript-eslint/recommended-requiring-type-checking',
        'plugin:jsx-a11y/strict',
        'plugin:react-hooks/recommended',
      ],
      rules: {
        '@typescript-eslint/consistent-type-imports': [
          'warn',
          { prefer: 'type-imports', disallowTypeAnnotations: false },
        ],
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        '@typescript-eslint/no-floating-promises': 'error',
        '@typescript-eslint/no-non-null-assertion': 'warn',
        '@typescript-eslint/no-empty-object-type': [
          'warn',
          { allowInterfaces: 'always', allowObjectTypes: 'always' },
        ],
        '@typescript-eslint/triple-slash-reference': 'off',
        // Hooks guardrails ensure React islands remain deterministic.
        'react-hooks/exhaustive-deps': 'warn',
        'react-hooks/rules-of-hooks': 'error',
      },
    },
    {
      // Astro single-file components combine HTML, frontmatter, scripts, and styles.
      files: ['**/*.astro'],
      // The Astro parser hands script blocks to @typescript-eslint for a consistent experience.
      parser: 'astro-eslint-parser',
      parserOptions: {
        parser: '@typescript-eslint/parser',
        project: projectTsconfig,
        tsconfigRootDir: __dirname,
        extraFileExtensions: ['.astro'],
      },
      globals: {
        Astro: 'readonly',
      },
      extends: ['plugin:astro/recommended', 'plugin:astro/jsx-a11y-strict'],
      rules: {
        // Inline HTML mutations make hydration unpredictable. Ban them outright.
        'astro/no-set-html-directive': 'error',
        // Keep CSS lean by flagging selectors that never match an element.
        'astro/no-unused-css-selector': 'warn',
      },
    },
    {
      // MDX content shares React semantics but lives in the content pipeline.
      files: ['**/*.mdx'],
      parser: 'eslint-mdx',
      extends: ['plugin:mdx/recommended'],
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      rules: {
        // Content authors often link to headings that resolve at runtime; keep lint gentle.
        'jsx-a11y/anchor-is-valid': 'off',
      },
    },
    {
      // Configuration and build scripts run in Node, so CommonJS is acceptable here.
      files: ['**/*.{cjs,mjs,js}'],
      env: { node: true },
      rules: {
        // Permit dev ergonomics inside tooling scripts.
        'import/no-extraneous-dependencies': 'off',
      },
    },
  ],
};
