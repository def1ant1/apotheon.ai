/**
 * lint-staged keeps our pre-commit hooks snappy by only touching files that changed.
 * The commands are ordered to maximize auto-fix potential while avoiding duplicate work.
 */
const eslintTargets = '**/*.{astro,js,jsx,ts,tsx,mdx}';
const styleTargets = '**/*.{css,pcss,scss,sass,astro}';
const prettierTargets = '**/*.{astro,css,html,js,json,md,mdx,ts,tsx,yaml,yml}';

export default {
  'assets/brand-icons/raw/**/*.svg': ['npm run icons:build'],
  [eslintTargets]: [
    "eslint --no-ignore --max-warnings=0 --fix --ignore-pattern '!.ladle/**/*' --ignore-pattern 'scripts/utils/**/*.d.ts'",
  ],
  [styleTargets]: ['stylelint --fix'],
  [prettierTargets]: ['prettier --write'],
};
