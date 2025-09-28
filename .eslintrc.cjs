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
    '!.ladle/**/*',
    'scripts/utils/solutions-loader.d.ts',
    'config/security/**/*.d.ts',
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
        ignore: [
          '^astro:',
          '^@playwright/test$',
          '^vitest$',
          '^vitest/config$',
          '^@testing-library/',
          '^@radix-ui/react-dialog$',
          '^astro/dist/runtime/server/render/index.js$',
          '^@resvg/resvg-js$',
          '^satori$',
        ],
      },
    ],
  },

  overrides: [
    {
      // TypeScript (including React islands) gets type-aware linting + React hook safety nets.
      files: ['src/**/*.{ts,tsx}', 'workers/**/*.{ts,tsx}', 'config/**/*.{ts,tsx}'],
      excludedFiles: ['**/*.d.ts'],
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
      // Node-based automation scripts run under tsx with full type safety.
      files: ['scripts/**/*.ts'],
      excludedFiles: ['**/*.d.ts'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        project: projectTsconfig,
        tsconfigRootDir: __dirname,
      },
      plugins: ['@typescript-eslint'],
      extends: ['plugin:@typescript-eslint/recommended', 'plugin:@typescript-eslint/recommended-requiring-type-checking'],
      rules: {
        '@typescript-eslint/consistent-type-imports': [
          'warn',
          { prefer: 'type-imports', disallowTypeAnnotations: false },
        ],
        '@typescript-eslint/no-floating-promises': 'error',
        '@typescript-eslint/no-var-requires': 'error',
      },
    },
    {
      files: ['src/pages/**/*.{ts,tsx}', 'src/utils/blog.ts', 'src/utils/history.ts'],
      rules: {
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-unsafe-call': 'off',
        '@typescript-eslint/no-unsafe-return': 'off',
        '@typescript-eslint/no-unsafe-argument': 'off',
      },
    },
    {
      files: ['**/__tests__/**/*.{ts,tsx}', '**/*.test.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        project: projectTsconfig,
        tsconfigRootDir: __dirname,
      },
      rules: {
        '@typescript-eslint/no-unsafe-call': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-return': 'off',
        '@typescript-eslint/no-unsafe-argument': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/require-await': 'off',
      },
    },
    {
      files: ['.ladle/**/*.{ts,tsx}'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        project: path.resolve(__dirname, 'tsconfig.ladle.json'),
        tsconfigRootDir: __dirname,
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
        'react-hooks/exhaustive-deps': 'warn',
        'react-hooks/rules-of-hooks': 'error',
      },
    },
    {
      files: ['**/*.d.ts'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        // Disable project-bound type analysis so declaration shims do not require a tsconfig.
        project: false,
        tsconfigRootDir: __dirname,
      },
      rules: {
        'no-undef': 'off',
        'no-unused-vars': 'off',
        '@typescript-eslint/await-thenable': 'off',
        '@typescript-eslint/no-array-delete': 'off',
        '@typescript-eslint/no-base-to-string': 'off',
        '@typescript-eslint/no-duplicate-type-constituents': 'off',
        '@typescript-eslint/no-floating-promises': 'off',
        '@typescript-eslint/no-implied-eval': 'off',
        '@typescript-eslint/no-misused-promises': 'off',
        '@typescript-eslint/no-redundant-type-constituents': 'off',
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
    {
      files: ['astro.config.mjs', 'src/middleware/security.ts'],
      rules: {
        'import/extensions': [
          'error',
          'ignorePackages',
          {
            js: 'always',
            jsx: 'never',
            ts: 'never',
            tsx: 'never',
            astro: 'always',
            mdx: 'always',
          },
        ],
      },
    },
    {
      files: ['config/security/**/*.d.ts'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        project: false,
        tsconfigRootDir: __dirname,
      },
      rules: {},
    },
  ],
};
